-- Phase 20: secure seller earnings metrics and prevent exposing full multi-seller order totals.
create or replace function public.get_seller_earnings_metrics()
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_uid uuid:=auth.uid(); v_role text; v_result jsonb;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 select role into v_role from public.profiles where id=v_uid;
 if v_role not in ('seller','admin') then raise exception 'Seller access required'; end if;
 with seller_lines as (
   select oi.order_id,oi.quantity,oi.unit_price,o.status,o.delivery_status,
          (oi.quantity*oi.unit_price) as line_total
   from public.order_items oi join public.orders o on o.id=oi.order_id
   join public.products p on p.id=oi.product_id
   where v_role='admin' or p.seller_id=v_uid
 ), agg as (
   select coalesce(sum(line_total),0) gross_earnings,
          coalesce(sum(line_total) filter(where status in ('confirmed','processing','shipped','delivered')),0) confirmed_earnings,
          coalesce(sum(line_total) filter(where delivery_status='delivered'),0) delivered_earnings,
          count(distinct order_id) order_count,
          count(distinct order_id) filter(where delivery_status='delivered') delivered_order_count,
          count(*) line_count
   from seller_lines
 )
 select jsonb_build_object('gross_earnings',gross_earnings,'confirmed_earnings',confirmed_earnings,'delivered_earnings',delivered_earnings,'order_count',order_count,'delivered_order_count',delivered_order_count,'line_count',line_count,'payout_status','not_configured') into v_result from agg;
 return v_result;
end $$;
revoke all on function public.get_seller_earnings_metrics() from public,anon;
grant execute on function public.get_seller_earnings_metrics() to authenticated;

create or replace function public.get_seller_orders(p_status text default null,p_delivery_status text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_role text; v_result jsonb;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 select role into v_role from public.profiles where id=v_uid;
 if v_role not in ('seller','admin') then raise exception 'Seller access required'; end if;
 select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc),'[]'::jsonb) into v_result
 from (
   select o.id,o.order_number,o.status,o.payment_method,o.payment_status,o.delivery_status,o.tracking_provider,o.tracking_number,o.estimated_delivery_date,
   coalesce((select sum(oi.quantity*oi.unit_price) from public.order_items oi join public.products pp on pp.id=oi.product_id where oi.order_id=o.id and (v_role='admin' or pp.seller_id=v_uid)),0) seller_total,o.created_at,
   coalesce((select jsonb_agg(jsonb_build_object('product_name',oi.product_name,'quantity',oi.quantity,'unit_price',oi.unit_price,'product_id',oi.product_id,'variant_id',oi.variant_id)) from public.order_items oi join public.products pp on pp.id=oi.product_id where oi.order_id=o.id and (v_role='admin' or pp.seller_id=v_uid)),'[]'::jsonb) items
   from public.orders o
   where (p_status is null or o.status=p_status) and (p_delivery_status is null or o.delivery_status=p_delivery_status)
   and (v_role='admin' or exists(select 1 from public.order_items oi join public.products pp on pp.id=oi.product_id where oi.order_id=o.id and pp.seller_id=v_uid))
 ) x;
 return v_result;
end $$;
revoke all on function public.get_seller_orders(text,text) from public,anon;
grant execute on function public.get_seller_orders(text,text) to authenticated;