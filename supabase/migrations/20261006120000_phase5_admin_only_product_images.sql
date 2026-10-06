-- Phase 5 hardening: product image management is exclusively admin-operated.
-- Public storefront reads remain limited to images of active products. The
-- product-images bucket stays public for storefront delivery; this migration
-- does not recreate the bucket or alter its contents/settings.

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Remove every existing policy on this one table before defining the intended
-- read/write boundary. This prevents an older permissive or seller policy from
-- being OR-combined with the admin-only policies below.
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_images'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.product_images', policy_row.policyname);
  END LOOP;
END
$$;

CREATE POLICY product_images_public_read
  ON public.product_images
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.products AS p
      WHERE p.id = product_images.product_id
        AND p.status = 'active'
    )
  );

CREATE POLICY product_images_authenticated_read
  ON public.product_images
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.products AS p
      WHERE p.id = product_images.product_id
        AND (p.status = 'active' OR private.is_admin())
    )
  );

CREATE POLICY product_images_admin_insert
  ON public.product_images
  FOR INSERT
  TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY product_images_admin_update
  ON public.product_images
  FOR UPDATE
  TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY product_images_admin_delete
  ON public.product_images
  FOR DELETE
  TO authenticated
  USING (private.is_admin());

-- Replace only product-image Storage policies. Other buckets and their policies
-- are left untouched. Public URL downloads continue to work because the bucket
-- itself remains public; management/list access is admin-only.
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND left(policyname, length('product_images_')) = 'product_images_'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_row.policyname);
  END LOOP;
END
$$;

CREATE POLICY product_images_admin_read
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'product-images' AND private.is_admin());

CREATE POLICY product_images_upload
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND private.is_admin());

CREATE POLICY product_images_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND private.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND private.is_admin());

CREATE POLICY product_images_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND private.is_admin());

-- Removing a product variant should detach its image, not cascade-delete the
-- image record and orphan its Storage object. The image remains a general image.
DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.product_images'::regclass
      AND confrelid = 'public.product_variants'::regclass
      AND contype = 'f'
      AND array_length(conkey, 1) = 1
      AND conkey[1] = (
        SELECT attnum
        FROM pg_attribute
        WHERE attrelid = 'public.product_images'::regclass
          AND attname = 'variant_id'
          AND NOT attisdropped
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.product_images DROP CONSTRAINT %I',
      constraint_row.conname
    );
  END LOOP;
END
$$;

ALTER TABLE public.product_images
  ADD CONSTRAINT product_images_variant_id_fkey
  FOREIGN KEY (variant_id)
  REFERENCES public.product_variants(id)
  ON DELETE SET NULL;

-- Primary selection and reordering are single authenticated-admin transactions.
CREATE OR REPLACE FUNCTION public.admin_set_product_primary_image(
  p_product_id uuid,
  p_image_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  IF p_product_id IS NULL OR p_image_id IS NULL THEN
    RAISE EXCEPTION 'Product and image IDs are required';
  END IF;

  PERFORM 1
  FROM public.product_images
  WHERE product_id = p_product_id
  FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1
    FROM public.product_images
    WHERE id = p_image_id
      AND product_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'Image does not belong to this product';
  END IF;

  -- Keep the partial unique index valid while making the whole change atomic.
  UPDATE public.product_images
  SET is_primary = false
  WHERE product_id = p_product_id
    AND is_primary;

  UPDATE public.product_images
  SET is_primary = true
  WHERE id = p_image_id
    AND product_id = p_product_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reorder_product_images(
  p_product_id uuid,
  p_image_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  expected_count integer;
  requested_count integer;
  distinct_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  IF p_product_id IS NULL OR p_image_ids IS NULL THEN
    RAISE EXCEPTION 'Product ID and ordered image IDs are required';
  END IF;

  PERFORM 1
  FROM public.product_images
  WHERE product_id = p_product_id
  FOR UPDATE;

  SELECT count(*)::integer
  INTO expected_count
  FROM public.product_images
  WHERE product_id = p_product_id;

  requested_count := cardinality(p_image_ids);

  SELECT count(DISTINCT requested.image_id)::integer
  INTO distinct_count
  FROM unnest(p_image_ids) AS requested(image_id);

  IF requested_count <> expected_count OR distinct_count <> requested_count THEN
    RAISE EXCEPTION 'Image order must contain every product image exactly once';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_image_ids) AS requested(image_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.product_images AS image_row
      WHERE image_row.id = requested.image_id
        AND image_row.product_id = p_product_id
    )
  ) THEN
    RAISE EXCEPTION 'Image order contains an image from another product';
  END IF;

  UPDATE public.product_images AS image_row
  SET sort_order = requested.image_order::integer - 1
  FROM unnest(p_image_ids) WITH ORDINALITY AS requested(image_id, image_order)
  WHERE image_row.id = requested.image_id
    AND image_row.product_id = p_product_id;

  RETURN expected_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_product_primary_image(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_product_primary_image(uuid, uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.admin_reorder_product_images(uuid, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reorder_product_images(uuid, uuid[])
  TO authenticated;
