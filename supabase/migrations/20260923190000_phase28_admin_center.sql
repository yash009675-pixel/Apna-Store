-- Phase 28 — Admin Center
-- Real database-backed admin dashboard. No seeded/fake business metrics.

create or replace function public.admin_get_center_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select jsonb_build_object(
    'gmv', coalesce((select sum(o.total) from public.orders o where o.status <> 'cancelled'),0),
    'sales', coalesce((select sum(o.subtotal) from public.orders o where o.status <> 'cancelled'),0),
    'orders', coalesce((select count(*) from public.orders),0),
    'customers', coalesce((select count(*) from public.profiles where role='customer'),0),
    'sellers', coalesce((select count(*) from public.profiles where role='seller'),0),
    'products', coalesce((select count(*) from public.products),0),
    'shipments', coalesce((select count(*) from public.shipments),0),
    'returns', coalesce((select count(*) from public.return_requests),0),
    'refunds', coalesce((select count(*) from public.return_requests where refund_status is not null),0),
    'support_tickets', coalesce((select count(*) from public.support_tickets),0),
    'revenue', coalesce((select sum(pt.amount) from public.payment_transactions pt where lower(coalesce(pt.status,'')) in ('success','succeeded','paid','captured')),0)
  )
  where private.is_admin();
$$;

revoke execute on function public.admin_get_center_dashboard() from public;
revoke execute on function public.admin_get_center_dashboard() from anon;
grant execute on function public.admin_get_center_dashboard() to authenticated;