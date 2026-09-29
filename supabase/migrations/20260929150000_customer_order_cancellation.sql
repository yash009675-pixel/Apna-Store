create or replace function public.customer_cancel_order(p_order_id uuid, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_seller_status text;
  v_payment_status text;
  v_total numeric(12,2);
  v_item record;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select status,seller_order_status,payment_status,total into v_status,v_seller_status,v_payment_status,v_total
  from public.orders where id=p_order_id and user_id=v_uid for update;
  if not found then raise exception 'Order not found'; end if;
  if coalesce(v_seller_status,'') not in ('','New','Accepted','Packing')
     or coalesce(v_status,'') not in ('placed','pending','confirmed','processing') then
    raise exception 'This order can no longer be cancelled';
  end if;
  for v_item in select variant_id,quantity from public.order_items where order_id=p_order_id and variant_id is not null loop
    update public.product_variants set stock=stock+v_item.quantity where id=v_item.variant_id;
  end loop;
  if lower(coalesce(v_payment_status,'')) in ('paid','captured') then
    perform public.refund_order_to_wallet(p_order_id,v_total);
    update public.orders set status='cancelled',seller_order_status='Cancelled',delivery_status='cancelled',payment_status='refunded',updated_at=now() where id=p_order_id;
  else
    update public.orders set status='cancelled',seller_order_status='Cancelled',delivery_status='cancelled',updated_at=now() where id=p_order_id;
  end if;
  insert into public.seller_order_status_events(order_id,status,note,created_by)
  values(p_order_id,'Cancelled',nullif(btrim(coalesce(p_reason,'')),''),v_uid);
  return true;
end;
$$;

revoke all on function public.customer_cancel_order(uuid,text) from public;
grant execute on function public.customer_cancel_order(uuid,text) to authenticated;