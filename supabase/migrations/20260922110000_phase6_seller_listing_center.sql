-- Phase 6: Seller Listing Center / Inventory
alter table public.products
  add column if not exists subcategory text,
  add column if not exists attributes jsonb not null default '{}'::jsonb,
  add column if not exists gst_rate numeric(5,2),
  add column if not exists shipping_details jsonb not null default '{}'::jsonb,
  add column if not exists return_policy text,
  add column if not exists package_weight_kg numeric(10,3),
  add column if not exists package_length_cm numeric(10,2),
  add column if not exists package_width_cm numeric(10,2),
  add column if not exists package_height_cm numeric(10,2),
  add column if not exists discount_percent numeric(5,2),
  add column if not exists rejection_reason text,
  add column if not exists approval_submitted_at timestamptz;

alter table public.products drop constraint if exists products_status_check;
alter table public.products add constraint products_status_check check (status = any (array['draft','active','inactive','pending_approval','rejected','archived']));
alter table public.products drop constraint if exists products_gst_rate_check;
alter table public.products add constraint products_gst_rate_check check (gst_rate is null or gst_rate between 0 and 100);
alter table public.products drop constraint if exists products_discount_percent_check;
alter table public.products add constraint products_discount_percent_check check (discount_percent is null or discount_percent between 0 and 100);
alter table public.products drop constraint if exists products_package_weight_check;
alter table public.products add constraint products_package_weight_check check (package_weight_kg is null or package_weight_kg >= 0);
alter table public.products drop constraint if exists products_package_dimensions_check;
alter table public.products add constraint products_package_dimensions_check check ((package_length_cm is null or package_length_cm >= 0) and (package_width_cm is null or package_width_cm >= 0) and (package_height_cm is null or package_height_cm >= 0));
create index if not exists products_seller_status_idx on public.products(seller_id,status,updated_at desc);
create index if not exists products_subcategory_idx on public.products(subcategory);

drop function if exists public.seller_save_listing(uuid,text,text,numeric,numeric,numeric,text,uuid,text,uuid,jsonb,numeric,jsonb,text,numeric,numeric,numeric,numeric,jsonb);
create or replace function public.seller_save_listing(
  p_product_id uuid, p_name text, p_description text, p_price numeric, p_compare_at_price numeric,
  p_discount_percent numeric, p_status text, p_category_id uuid, p_subcategory text, p_brand_id uuid,
  p_attributes jsonb, p_gst_rate numeric, p_shipping_details jsonb, p_return_policy text,
  p_package_weight_kg numeric, p_package_length_cm numeric, p_package_width_cm numeric,
  p_package_height_cm numeric, p_variants jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid(); v_role text; v_id uuid := p_product_id; v jsonb; v_ids uuid[] := '{}'; v_variant_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id=v_user;
  if v_role not in ('seller','admin') then raise exception 'Seller access required'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 2 and 160 then raise exception 'Invalid product name'; end if;
  if p_price is null or p_price < 0 then raise exception 'Invalid price'; end if;
  if p_compare_at_price is not null and p_compare_at_price < p_price then raise exception 'MRP cannot be below selling price'; end if;
  if p_discount_percent is not null and (p_discount_percent < 0 or p_discount_percent > 100) then raise exception 'Invalid discount'; end if;
  if p_gst_rate is not null and (p_gst_rate < 0 or p_gst_rate > 100) then raise exception 'Invalid GST rate'; end if;
  if p_status not in ('draft','active','inactive','pending_approval','rejected','archived') then raise exception 'Invalid listing status'; end if;
  if p_category_id is not null and not exists(select 1 from public.categories where id=p_category_id and is_active) then raise exception 'Selected category is not active'; end if;
  if p_brand_id is not null and not exists(select 1 from public.brands where id=p_brand_id and is_active) then raise exception 'Selected brand is not active'; end if;
  if p_product_id is not null then
    if not exists(select 1 from public.products where id=p_product_id and (v_role='admin' or seller_id=v_user)) then raise exception 'Product access denied'; end if;
    update public.products set name=btrim(p_name),description=nullif(btrim(coalesce(p_description,'')),''),price=p_price,compare_at_price=p_compare_at_price,discount_percent=p_discount_percent,status=p_status,category_id=p_category_id,subcategory=nullif(btrim(coalesce(p_subcategory,'')),''),brand_id=p_brand_id,attributes=coalesce(p_attributes,'{}'::jsonb),gst_rate=p_gst_rate,shipping_details=coalesce(p_shipping_details,'{}'::jsonb),return_policy=nullif(btrim(coalesce(p_return_policy,'')),''),package_weight_kg=p_package_weight_kg,package_length_cm=p_package_length_cm,package_width_cm=p_package_width_cm,package_height_cm=p_package_height_cm,updated_at=now(),approval_submitted_at=case when p_status='pending_approval' then now() else approval_submitted_at end,rejection_reason=case when p_status='pending_approval' then null else rejection_reason end where id=p_product_id;
  else
    insert into public.products(seller_id,name,slug,description,price,compare_at_price,discount_percent,status,category_id,subcategory,brand_id,attributes,gst_rate,shipping_details,return_policy,package_weight_kg,package_length_cm,package_width_cm,package_height_cm,approval_submitted_at)
    values(v_user,btrim(p_name),left(regexp_replace(lower(btrim(p_name)),'[^a-z0-9]+','-','g'),150)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,8),nullif(btrim(coalesce(p_description,'')),''),p_price,p_compare_at_price,p_discount_percent,p_status,p_category_id,nullif(btrim(coalesce(p_subcategory,'')),''),p_brand_id,coalesce(p_attributes,'{}'::jsonb),p_gst_rate,coalesce(p_shipping_details,'{}'::jsonb),nullif(btrim(coalesce(p_return_policy,'')),''),p_package_weight_kg,p_package_length_cm,p_package_width_cm,p_package_height_cm,case when p_status='pending_approval' then now() else null end)
    returning id into v_id;
  end if;
  for v in select * from jsonb_array_elements(coalesce(p_variants,'[]'::jsonb)) loop
    v_variant_id := nullif(v->>'id','')::uuid;
    if v_variant_id is not null and exists(select 1 from public.product_variants where id=v_variant_id and product_id=v_id) then
      update public.product_variants set size=nullif(btrim(v->>'size'),''),color=nullif(btrim(v->>'color'),''),sku=nullif(btrim(v->>'sku'),''),stock=greatest(0,coalesce((v->>'stock')::int,0)) where id=v_variant_id;
      v_ids := array_append(v_ids,v_variant_id);
    else
      insert into public.product_variants(product_id,size,color,sku,stock) values(v_id,nullif(btrim(v->>'size'),''),nullif(btrim(v->>'color'),''),nullif(btrim(v->>'sku'),''),greatest(0,coalesce((v->>'stock')::int,0))) returning id into v_variant_id;
      v_ids := array_append(v_ids,v_variant_id);
    end if;
  end loop;
  delete from public.product_variants where product_id=v_id and not (id = any(v_ids));
  return v_id;
end;
$$;
revoke execute on function public.seller_save_listing(uuid,text,text,numeric,numeric,numeric,text,uuid,text,uuid,jsonb,numeric,jsonb,text,numeric,numeric,numeric,numeric,jsonb) from anon;
grant execute on function public.seller_save_listing(uuid,text,text,numeric,numeric,numeric,text,uuid,text,uuid,jsonb,numeric,jsonb,text,numeric,numeric,numeric,numeric,jsonb) to authenticated;

create or replace function public.seller_set_listing_status(p_product_id uuid,p_status text) returns boolean
language plpgsql security definer set search_path=public
as $$
declare v_user uuid:=auth.uid(); v_role text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id=v_user;
  if v_role not in ('seller','admin') then raise exception 'Seller access required'; end if;
  if p_status not in ('draft','active','inactive','pending_approval','rejected','archived') then raise exception 'Invalid listing status'; end if;
  update public.products set status=p_status,approval_submitted_at=case when p_status='pending_approval' then now() else approval_submitted_at end,rejection_reason=case when p_status='pending_approval' then null else rejection_reason end,updated_at=now() where id=p_product_id and (v_role='admin' or seller_id=v_user);
  if not found then raise exception 'Product access denied'; end if;
  return true;
end;
$$;
revoke execute on function public.seller_set_listing_status(uuid,text) from anon;
grant execute on function public.seller_set_listing_status(uuid,text) to authenticated;

create or replace function public.seller_delete_listing(p_product_id uuid) returns boolean
language plpgsql security definer set search_path=public
as $$
declare v_user uuid:=auth.uid(); v_role text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id=v_user;
  if v_role not in ('seller','admin') then raise exception 'Seller access required'; end if;
  delete from public.products where id=p_product_id and (v_role='admin' or seller_id=v_user);
  if not found then raise exception 'Product access denied or product cannot be deleted because it is referenced by an order'; end if;
  return true;
end;
$$;
revoke execute on function public.seller_delete_listing(uuid) from anon;
grant execute on function public.seller_delete_listing(uuid) to authenticated;

create or replace function public.seller_duplicate_listing(p_product_id uuid) returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_user uuid:=auth.uid(); v_role text; p public.products%rowtype; new_id uuid; v public.product_variants%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id=v_user;
  if v_role not in ('seller','admin') then raise exception 'Seller access required'; end if;
  select * into p from public.products where id=p_product_id and (v_role='admin' or seller_id=v_user);
  if not found then raise exception 'Product access denied'; end if;
  insert into public.products(seller_id,name,slug,description,price,compare_at_price,discount_percent,status,category_id,subcategory,brand_id,attributes,gst_rate,shipping_details,return_policy,package_weight_kg,package_length_cm,package_width_cm,package_height_cm)
  values(p.seller_id,p.name||' Copy',left(regexp_replace(lower(p.name||'-copy'),'[^a-z0-9]+','-','g'),150)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,8),p.description,p.price,p.compare_at_price,p.discount_percent,'draft',p.category_id,p.subcategory,p.brand_id,p.attributes,p.gst_rate,p.shipping_details,p.return_policy,p.package_weight_kg,p.package_length_cm,p.package_width_cm,p.package_height_cm) returning id into new_id;
  for v in select * from public.product_variants where product_id=p_product_id order by created_at loop
    insert into public.product_variants(product_id,size,color,sku,stock) values(new_id,v.size,v.color,case when v.sku is null then null else v.sku||'-COPY-'||substr(replace(gen_random_uuid()::text,'-',''),1,6) end,v.stock);
  end loop;
  return new_id;
end;
$$;
revoke execute on function public.seller_duplicate_listing(uuid) from anon;
grant execute on function public.seller_duplicate_listing(uuid) to authenticated;

create or replace function public.seller_bulk_update_listings(p_product_ids uuid[],p_stock integer default null,p_price numeric default null,p_discount_percent numeric default null,p_status text default null) returns integer
language plpgsql security definer set search_path=public
as $$
declare v_user uuid:=auth.uid(); v_role text; changed integer:=0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id=v_user;
  if v_role not in ('seller','admin') then raise exception 'Seller access required'; end if;
  if coalesce(array_length(p_product_ids,1),0)=0 then return 0; end if;
  if p_stock is not null and p_stock<0 then raise exception 'Stock cannot be negative'; end if;
  if p_price is not null and p_price<0 then raise exception 'Price cannot be negative'; end if;
  if p_discount_percent is not null and (p_discount_percent<0 or p_discount_percent>100) then raise exception 'Discount must be between 0 and 100'; end if;
  if p_status is not null and p_status not in ('draft','active','inactive','pending_approval','rejected','archived') then raise exception 'Invalid listing status'; end if;
  update public.products set price=coalesce(p_price,price),discount_percent=coalesce(p_discount_percent,discount_percent),status=coalesce(p_status,status),approval_submitted_at=case when p_status='pending_approval' then now() else approval_submitted_at end,updated_at=now()
  where id=any(p_product_ids) and (v_role='admin' or seller_id=v_user);
  get diagnostics changed=row_count;
  if p_stock is not null then
    update public.product_variants set stock=p_stock where product_id=any(p_product_ids) and exists(select 1 from public.products p where p.id=product_variants.product_id and (v_role='admin' or p.seller_id=v_user));
  end if;
  return changed;
end;
$$;
revoke execute on function public.seller_bulk_update_listings(uuid[],integer,numeric,numeric,text) from anon;
grant execute on function public.seller_bulk_update_listings(uuid[],integer,numeric,numeric,text) to authenticated;