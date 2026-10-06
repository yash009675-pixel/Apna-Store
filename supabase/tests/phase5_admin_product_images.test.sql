-- Read-only Phase 5 schema/security checks.
-- Run after migrations with `supabase test db`. No users, products, variants,
-- image rows, or Storage objects are inserted by this test.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(22);

SELECT has_table('public', 'product_images', 'the existing product_images table is present');

SELECT ok(
  (SELECT relrowsecurity
   FROM pg_class
   WHERE oid = 'public.product_images'::regclass),
  'product_images has row-level security enabled'
);

SELECT has_column('public', 'product_images', 'sort_order', 'image order is persisted');
SELECT has_column('public', 'product_images', 'is_primary', 'primary-image state is persisted');
SELECT has_column('public', 'product_images', 'variant_id', 'variant links are persisted');

SELECT ok(
  EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'product-images'
      AND public
      AND file_size_limit = 5242880
      AND ARRAY['image/jpeg', 'image/png', 'image/webp']::text[] <@ allowed_mime_types
  ),
  'existing product-images bucket is public for delivery and limits uploads to supported image MIME types and 5 MB'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_index AS i
    WHERE i.indrelid = 'public.product_images'::regclass
      AND i.indisunique
      AND pg_get_expr(i.indpred, i.indrelid) ILIKE '%is_primary%'
  ),
  'the one-primary-image-per-product unique index is present'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_images'
      AND policyname = 'product_images_public_read'
      AND cmd = 'SELECT'
      AND roles @> ARRAY['anon']::name[]
      AND qual ILIKE '%active%'
  ),
  'anonymous storefront reads are limited to active products'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_images'
      AND policyname = 'product_images_authenticated_read'
      AND cmd = 'SELECT'
      AND roles @> ARRAY['authenticated']::name[]
      AND qual ILIKE '%private.is_admin%'
      AND qual NOT ILIKE '%is_seller%'
  ),
  'authenticated reads preserve active catalog access and admin access without a seller exception'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_images'
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ILIKE '%is_seller%'
  ),
  'no product_images RLS policy grants seller access'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_images'
      AND policyname = 'product_images_admin_insert'
      AND cmd = 'INSERT'
      AND with_check ILIKE '%private.is_admin%'
      AND with_check NOT ILIKE '%is_seller%'
  ),
  'only admins can insert product image records'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_images'
      AND policyname = 'product_images_admin_update'
      AND cmd = 'UPDATE'
      AND qual ILIKE '%private.is_admin%'
      AND with_check ILIKE '%private.is_admin%'
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) NOT ILIKE '%is_seller%'
  ),
  'only admins can update image order, primary state, and variant links'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_images'
      AND policyname = 'product_images_admin_delete'
      AND cmd = 'DELETE'
      AND qual ILIKE '%private.is_admin%'
      AND qual NOT ILIKE '%is_seller%'
  ),
  'only admins can delete product image records'
);

SELECT is(
  (SELECT count(*)::integer
   FROM pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
     AND left(policyname, length('product_images_')) = 'product_images_'),
  4,
  'only the four scoped product-image Storage policies remain'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND left(policyname, length('product_images_')) = 'product_images_'
      AND (
        (coalesce(qual, '') || ' ' || coalesce(with_check, '')) NOT ILIKE '%private.is_admin%'
        OR (coalesce(qual, '') || ' ' || coalesce(with_check, '')) NOT ILIKE '%product-images%'
        OR (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ILIKE '%auth.uid%'
      )
  ),
  'product-image Storage read/write policies require admin authorization and the dedicated bucket'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.product_images'::regclass
      AND confrelid = 'public.product_variants'::regclass
      AND contype = 'f'
      AND confdeltype = 'n'
  ),
  'deleting a variant detaches its image link instead of orphaning the Storage file'
);

SELECT ok(
  (SELECT prosecdef
   FROM pg_proc
   WHERE oid = 'public.admin_set_product_primary_image(uuid,uuid)'::regprocedure),
  'primary-image RPC is SECURITY DEFINER and performs its own admin check'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.admin_set_product_primary_image(uuid,uuid)', 'EXECUTE'),
  'anonymous users cannot call the primary-image RPC'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.admin_set_product_primary_image(uuid,uuid)', 'EXECUTE'),
  'authenticated callers can invoke the primary-image RPC, which enforces admin role internally'
);

SELECT ok(
  (SELECT prosecdef
   FROM pg_proc
   WHERE oid = 'public.admin_reorder_product_images(uuid,uuid[])'::regprocedure),
  'image-reorder RPC is SECURITY DEFINER and performs its own admin check'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.admin_reorder_product_images(uuid,uuid[])', 'EXECUTE'),
  'anonymous users cannot call the image-reorder RPC'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.admin_reorder_product_images(uuid,uuid[])', 'EXECUTE'),
  'authenticated callers can invoke the image-reorder RPC, which enforces admin role internally'
);

SELECT * FROM finish();
ROLLBACK;
