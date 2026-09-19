-- APNA STORE — SECURE ORDER CREATION + INVENTORY
-- Production order creation for authenticated customers.
-- Applied to Supabase as migration: secure_order_creation_and_inventory.

create or replace function public.create_order_secure(
  p_items jsonb,
  p_shipping jsonb,
  p_payment_method text default 'cod'
)
returns table(order_id uuid, order_number text, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(12,2) := 0;
  v_delivery_fee numeric(12,2);
  v_total numeric(12,2);
  v_item jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_qty integer;
  v_product_id uuid;
  v_variant_id uuid;
  v_unit_price numeric(12,2);
  v_address_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;
  if jsonb_typeof(p_shipping) <> 'object' then raise exception 'Shipping address is required'; end if;
  if coalesce(trim(p_shipping->>'full_name'),'')='' or coalesce(trim(p_shipping->>'phone'),'')='' or
     coalesce(trim(p_shipping->>'address_line'),'')='' or coalesce(trim(p_shipping->>'city'),'')='' or
     coalesce(trim(p_shipping->>'state'),'')='' or coalesce(trim(p_shipping->>'pincode'),'')='' then
    raise exception 'Complete shipping address is required';
  end if;
  if p_payment_method <> 'cod' then raise exception 'Unsupported payment method'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_product_id := nullif(v_item->>'product_id','')::uuid;
    v_variant_id := nullif(v_item->>'variant_id','')::uuid;
    v_qty := greatest(coalesce((v_item->>'quantity')::integer,0),0);
    if v_product_id is null or v_qty < 1 then raise exception 'Invalid cart item'; end if;

    select * into v_product from public.products
    where id=v_product_id and status='active' for update;
    if not found then raise exception 'Product is unavailable'; end if;

    if v_variant_id is not null then
      select * into v_variant from public.product_variants
      where id=v_variant_id and product_id=v_product_id for update;
      if not found then raise exception 'Invalid product variant'; end if;
      if v_variant.stock < v_qty then raise exception 'Insufficient stock for %',v_product.name; end if;
    end if;
    v_subtotal := v_subtotal + (v_product.price * v_qty);
  end loop;

  v_delivery_fee := case when v_subtotal >= 999 then 0 else 49 end;
  v_total := v_subtotal + v_delivery_fee;
  v_order_number := 'APNA-' || upper(substr(encode(gen_random_bytes(6),'hex'),1,8));

  insert into public.addresses(user_id,full_name,phone,address_line,city,state,pincode,is_default)
  values(v_user_id,trim(p_shipping->>'full_name'),trim(p_shipping->>'phone'),
         trim(p_shipping->>'address_line'),trim(p_shipping->>'city'),trim(p_shipping->>'state'),
         trim(p_shipping->>'pincode'),false)
  returning id into v_address_id;

  insert into public.orders(user_id,order_number,status,payment_status,subtotal,delivery_fee,total,shipping_address)
  values(v_user_id,v_order_number,'placed','cod',v_subtotal,v_delivery_fee,v_total,
         p_shipping || jsonb_build_object('address_id',v_address_id))
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_product_id := nullif(v_item->>'product_id','')::uuid;
    v_variant_id := nullif(v_item->>'variant_id','')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    select * into v_product from public.products where id=v_product_id and status='active' for update;

    if v_variant_id is not null then
      update public.product_variants
      set stock=stock-v_qty
      where id=v_variant_id and product_id=v_product_id and stock>=v_qty;
      if not found then raise exception 'Stock changed for %; please try again',v_product.name; end if;
    end if;

    insert into public.order_items(order_id,product_id,variant_id,product_name,unit_price,quantity)
    values(v_order_id,v_product_id,v_variant_id,v_product.name,v_product.price,v_qty);
  end loop;

  return query select v_order_id,v_order_number,v_total;
end;
$$;

revoke all on function public.create_order_secure(jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.create_order_secure(jsonb,jsonb,text) to authenticated;
