create or replace function public.get_seller_orders(
 p_status text default null,
 p_delivery_status text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_role text; v_result jsonb;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 select role into v_role from public.profiles where id=v_uid;
 if v_role not in ('seller','admin') then raise exception 'Seller access required'; end if;
 select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc),'[]'::jsonb) into v_result
 from (
   select o.id,o.order_number,o.status,o.payment_method,o.payment_status,o.delivery_status,o.tracking_provider,o.tracking_number,o.estimated_delivery_date,o.subtotal,o.discount_amount,o.delivery_fee,o.total,o.created_at,
          coalesce((select jsonb_agg(jsonb_build_object('product_name',oi.product_name,'quantity',oi.quantity,'unit_price',oi.unit_price,'product_id',oi.product_id,'variant_id',oi.variant_id)) from public.order_items oi join public.products pp on pp.id=oi.product_id where oi.order_id=o.id and (v_role='admin' or pp.seller_id=v_uid)),'[]'::jsonb) items
   from public.orders o
   where (p_status is null or o.status=p_status)
     and (p_delivery_status is null or o.delivery_status=p_delivery_status)
     and (v_role='admin' or exists(select 1 from public.order_items oi join public.products pp on pp.id=oi.product_id where oi.order_id=o.id and pp.seller_id=v_uid))
 ) x;
 return v_result;
end $$;
revoke all on function public.get_seller_orders(text,text) from public,anon;
grant execute on function public.get_seller_orders(text,text) to authenticated;

create or replace function public.update_seller_order_status(p_order_id uuid,p_status text,p_delivery_status text default null,p_tracking_provider text default null,p_tracking_number text default null) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_role text;
begin
 select role into v_role from public.profiles where id=v_uid;
 if v_uid is null or v_role not in ('seller','admin') then raise exception 'Seller access required'; end if;
 if p_status not in ('pending','confirmed','processing','shipped','delivered','cancelled') then raise exception 'Invalid order status'; end if;
 if p_delivery_status is not null and p_delivery_status not in ('pending','processing','shipped','out_for_delivery','delivered','cancelled','returned') then raise exception 'Invalid delivery status'; end if;
 if not exists(select 1 from public.order_items oi join public.products pp on pp.id=oi.product_id where oi.order_id=p_order_id and (v_role='admin' or pp.seller_id=v_uid)) then raise exception 'Order access denied'; end if;
 update public.orders set status=p_status,delivery_status=coalesce(p_delivery_status,delivery_status),tracking_provider=coalesce(nullif(btrim(p_tracking_provider),''),tracking_provider),tracking_number=coalesce(nullif(btrim(p_tracking_number),''),tracking_number),shipped_at=case when coalesce(p_delivery_status,delivery_status)='shipped' and shipped_at is null then now() else shipped_at end,out_for_delivery_at=case when coalesce(p_delivery_status,delivery_status)='out_for_delivery' and out_for_delivery_at is null then now() else out_for_delivery_at end,delivered_at=case when coalesce(p_delivery_status,delivery_status)='delivered' and delivered_at is null then now() else delivered_at end where id=p_order_id;
 return true;
end $$;
revoke all on function public.update_seller_order_status(uuid,text,text,text,text) from public,anon;
grant execute on function public.update_seller_order_status(uuid,text,text,text,text) to authenticated;