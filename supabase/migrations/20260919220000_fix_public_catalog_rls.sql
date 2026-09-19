-- Allow public catalog browsing without invoking private role helpers for anon.
-- Keep seller/admin authorization checks on authenticated access paths.

DROP POLICY IF EXISTS products_read_allowed ON public.products;

CREATE POLICY products_public_read
ON public.products
FOR SELECT
TO anon
USING (status = 'active');

CREATE POLICY products_authenticated_read
ON public.products
FOR SELECT
TO authenticated
USING (
  status = 'active'
  OR private.is_admin()
  OR (
    seller_id = (SELECT auth.uid())
    AND private.is_seller()
  )
);

DROP POLICY IF EXISTS variants_read_allowed ON public.product_variants;

CREATE POLICY variants_public_read
ON public.product_variants
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = product_variants.product_id
      AND p.status = 'active'
  )
);

CREATE POLICY variants_authenticated_read
ON public.product_variants
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = product_variants.product_id
      AND (
        p.status = 'active'
        OR private.is_admin()
        OR (
          p.seller_id = (SELECT auth.uid())
          AND private.is_seller()
        )
      )
  )
);
