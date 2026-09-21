-- Phase 0 security/performance cleanup: remove the duplicate products(category_id) index.
-- products_category_id_idx remains as the canonical index.
DROP INDEX IF EXISTS public.products_category_idx;
