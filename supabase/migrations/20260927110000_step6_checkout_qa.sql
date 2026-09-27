-- Step 6: align coupon preview pricing with secure order pricing and restrict private preferences RPC
create or replace function public.preview_coupon(p_items jsonb,p_coupon_code text)
returns table(subtotal numeric,eligible_subtotal numeric,discount_amount numeric,delivery_fee numeric,total numeric)
language plpgsql security definer set search_path to 'public'
as $function$
declare uid uuid:=auth.uid();codev text:=upper(trim(coalesce(p_coupon_code,'')));c public.coupons%rowtype;i jsonb;p public.products%rowtype;v public.product_variants%rowtype;pid uuid;vid uuid;qty integer;sub numeric(12,2):=0;eligible numeric(12,2):=0;disc numeric(12,2):=0;delivery numeric(12,2);first_order boolean;
begin
 if uid is null then raise exception 'Authentication required';end if;
 select * into c from public.coupons c0 where c0.code=codev and c0.is_active=true and c0.starts_at<=now() and(c0.expires_at is null or c0.expires_at>now())and(c0.usage_limit is null or c0.usage_count<c0.usage_limit)for share;
 if not found then raise exception 'Coupon is invalid or unavailable';end if;
 if(select count(*)from public.coupon_usages u where u.coupon_id=c.id and u.user_id=uid)>=c.per_user_limit then raise exception 'You have already used this coupon the maximum number of times';end if;
 select not exists(select 1 from public.orders where user_id=uid)into first_order;
 if c.first_order_only and not first_order then raise exception 'This coupon is only valid on a first order';end if;
 for i in select value from jsonb_array_elements(p_items)loop
  pid:=nullif(i->>'product_id','')::uuid;vid:=nullif(i->>'variant_id','')::uuid;qty:=greatest(coalesce((i->>'quantity')::integer,0),0);
  if pid is null or vid is null or qty<1 then raise exception 'Invalid cart item';end if;
  select * into p from public.products where id=pid and status='active';if not found then raise exception 'Product is unavailable';end if;
  select * into v from public.product_variants where id=vid and product_id=pid;if not found or v.stock<qty then raise exception 'Insufficient stock';end if;
  sub:=sub+public.get_flash_sale_effective_price(pid)*qty;
  if c.owner_type='seller' and p.seller_id<>c.seller_id then continue;end if;
  if c.scope_type='all'or(c.scope_type='products'and exists(select 1 from public.coupon_products cp where cp.coupon_id=c.id and cp.product_id=pid))or(c.scope_type='categories'and exists(select 1 from public.coupon_categories cc where cc.coupon_id=c.id and cc.category_id=p.category_id))then eligible:=eligible+public.get_flash_sale_effective_price(pid)*qty;end if;
 end loop;
 if sub<c.min_order_amount then raise exception 'Minimum order value for this coupon is ₹%',c.min_order_amount;end if;
 if eligible<=0 then raise exception 'This coupon does not apply to the items in your bag';end if;
 disc:=case when c.discount_type='percent'then eligible*c.discount_value/100 else least(c.discount_value,eligible)end;
 if c.max_discount_amount is not null then disc:=least(disc,c.max_discount_amount);end if;
 disc:=least(greatest(disc,0),eligible);
 delivery:=case when sub>=999 then 0 else 49 end;
 return query select sub,eligible,disc,delivery,sub-disc+delivery;
end;$function$;

revoke execute on function public.get_customer_delivery_preferences() from public;
grant execute on function public.get_customer_delivery_preferences() to authenticated;
