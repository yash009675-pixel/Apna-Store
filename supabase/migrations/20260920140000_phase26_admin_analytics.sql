-- Phase 26: server-backed admin analytics
create or replace function public.admin_get_analytics(p_start_at timestamptz default now() - interval '30 days', p_end_at timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_start timestamptz := coalesce(p_start_at, now() - interval '30 days');
  v_end timestamptz := coalesce(p_end_at, now());
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then raise exception 'Admin access required'; end if;
  if v_end <= v_start then raise exception 'Invalid analytics date range'; end if;
  if v_end - v_start > interval '366 days' then raise exception 'Analytics range cannot exceed 366 days'; end if;
  select jsonb_build_object(
    'range', jsonb_build_object('start_at',v_start,'end_at',v_end),
    'overview', jsonb_build_object(
      'orders',(select count(*) from public.orders o where o.created_at>=v_start and o.created_at<v_end),
      'customers',(select count(distinct o.user_id) from public.orders o where o.created_at>=v_start and o.created_at<v_end and o.user_id is not null),
      'products_sold',(select coalesce(sum(oi.quantity),0) from public.order_items oi join public.orders o on o.id=oi.order_id where o.created_at>=v_start and o.created_at<v_end),
      'gross_sales',(select coalesce(sum(o.total),0) from public.orders o where o.created_at>=v_start and o.created_at<v_end and o.status not in ('cancelled','returned')),
      'discounts',(select coalesce(sum(o.discount_amount),0) from public.orders o where o.created_at>=v_start and o.created_at<v_end),
      'average_order_value',(select coalesce(avg(o.total),0) from public.orders o where o.created_at>=v_start and o.created_at<v_end and o.status not in ('cancelled','returned')),
      'delivered_orders',(select count(*) from public.orders o where o.created_at>=v_start and o.created_at<v_end and o.delivery_status='delivered'),
      'return_requests',(select count(*) from public.return_requests r where r.requested_at>=v_start and r.requested_at<v_end)),
    'daily_sales',coalesce((select jsonb_agg(jsonb_build_object('date',d::date,'orders',coalesce(x.orders,0),'sales',coalesce(x.sales,0)) order by d) from generate_series(date_trunc('day',v_start),date_trunc('day',v_end-interval '1 microsecond'),interval '1 day') d left join (select date_trunc('day',o.created_at) d,count(*) orders,coalesce(sum(o.total) filter (where o.status not in ('cancelled','returned')),0) sales from public.orders o where o.created_at>=v_start and o.created_at<v_end group by 1) x on x.d=d),'[]'::jsonb),
    'order_statuses',coalesce((select jsonb_agg(jsonb_build_object('status',status,'count',cnt) order by cnt desc) from (select o.status,count(*) cnt from public.orders o where o.created_at>=v_start and o.created_at<v_end group by o.status) s),'[]'::jsonb),
    'top_products',coalesce((select jsonb_agg(jsonb_build_object('product_id',product_id,'product_name',product_name,'quantity',quantity,'sales',sales) order by sales desc) from (select oi.product_id,max(oi.product_name) product_name,sum(oi.quantity) quantity,sum(oi.unit_price*oi.quantity) sales from public.order_items oi join public.orders o on o.id=oi.order_id where o.created_at>=v_start and o.created_at<v_end and o.status not in ('cancelled','returned') group by oi.product_id order by sales desc limit 10) t),'[]'::jsonb),
    'seller_funnel',jsonb_build_object(
      'applications',(select count(*) from public.seller_applications s where s.submitted_at>=v_start and s.submitted_at<v_end),
      'approved',(select count(*) from public.seller_applications s where s.submitted_at>=v_start and s.submitted_at<v_end and s.status='approved'),
      'active_sellers',(select count(*) from public.profiles p where p.role='seller'))
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.admin_get_analytics(timestamptz,timestamptz) from public, anon;
grant execute on function public.admin_get_analytics(timestamptz,timestamptz) to authenticated;