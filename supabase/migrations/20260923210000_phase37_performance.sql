-- Phase 37 performance: support paginated active storefront reads.
create index if not exists products_active_created_idx
on public.products (created_at asc, id asc)
where status = 'active';