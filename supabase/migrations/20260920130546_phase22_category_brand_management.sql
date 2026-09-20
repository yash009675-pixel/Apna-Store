alter table public.categories
  add column if not exists is_active boolean not null default true,
  add column if not exists sort_order integer not null default 0;

update public.categories
set is_active = true,
    sort_order = case lower(name)
      when 'women' then 10
      when 'men' then 20
      when 'kids' then 30
      when 'footwear' then 40
      else 100
    end;

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.products
  add column if not exists brand_id uuid references public.brands(id);

create index if not exists products_brand_id_idx on public.products(brand_id);
create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists categories_active_sort_idx on public.categories(is_active, sort_order, name);
create index if not exists brands_active_sort_idx on public.brands(is_active, sort_order, name);

alter table public.brands enable row level security;

drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories
for select to anon, authenticated
using (is_active or private.is_admin());

drop policy if exists brands_public_read on public.brands;
create policy brands_public_read on public.brands
for select to anon, authenticated
using (is_active or private.is_admin());

drop policy if exists brands_admin_insert on public.brands;
create policy brands_admin_insert on public.brands
for insert to authenticated
with check (private.is_admin());

drop policy if exists brands_admin_update on public.brands;
create policy brands_admin_update on public.brands
for update to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists brands_admin_delete on public.brands;
create policy brands_admin_delete on public.brands
for delete to authenticated
using (private.is_admin());

grant select on public.brands to anon, authenticated;
grant insert, update, delete on public.brands to authenticated;

create or replace function public.admin_list_categories()
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_role text; v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id=v_uid;
  if v_role <> 'admin' then raise exception 'Admin access required'; end if;
  select coalesce(jsonb_agg(row_to_json(x) order by x.sort_order, x.name), '[]'::jsonb) into v_result
  from (select c.id,c.name,c.slug,c.is_active,c.sort_order,c.created_at,(select count(*) from public.products p where p.category_id=c.id) as product_count from public.categories c) x;
  return v_result;
end
$$;

create or replace function public.admin_save_category(p_category_id uuid,p_name text,p_is_active boolean,p_sort_order integer default 0)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_role text; v_id uuid; v_slug text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id=v_uid;
  if v_role <> 'admin' then raise exception 'Admin access required'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 2 and 80 then raise exception 'Category name must be 2 to 80 characters'; end if;
  v_slug := left(regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'), 100);
  if v_slug = '' then raise exception 'Category name must contain letters or numbers'; end if;
  if p_category_id is null then
    if exists(select 1 from public.categories where lower(name)=lower(btrim(p_name)) or slug=v_slug) then raise exception 'Category already exists'; end if;
    insert into public.categories(name,slug,is_active,sort_order) values(btrim(p_name),v_slug,coalesce(p_is_active,true),greatest(coalesce(p_sort_order,0),0)) returning id into v_id;
  else
    if not exists(select 1 from public.categories where id=p_category_id) then raise exception 'Category not found'; end if;
    if exists(select 1 from public.categories where id<>p_category_id and (lower(name)=lower(btrim(p_name)) or slug=v_slug)) then raise exception 'Another category already uses that name'; end if;
    update public.categories set name=btrim(p_name),slug=v_slug,is_active=coalesce(p_is_active,true),sort_order=greatest(coalesce(p_sort_order,0),0) where id=p_category_id returning id into v_id;
  end if;
  return v_id;
end
$$;

create or replace function public.admin_delete_category(p_category_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_role text; v_count bigint;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id=v_uid;
  if v_role <> 'admin' then raise exception 'Admin access required'; end if;
  select count(*) into v_count from public.products where category_id=p_category_id;
  if v_count > 0 then raise exception 'Category is linked to % product(s). Deactivate it instead.', v_count; end if;
  delete from public.categories where id=p_category_id;
  return found;
end
$$;

create or replace function public.admin_list_brands()
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_role text; v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id=v_uid;
  if v_role <> 'admin' then raise exception 'Admin access required'; end if;
  select coalesce(jsonb_agg(row_to_json(x) order by x.sort_order, x.name), '[]'::jsonb) into v_result
  from (select b.id,b.name,b.slug,b.is_active,b.sort_order,b.created_at,(select count(*) from public.products p where p.brand_id=b.id) as product_count from public.brands b) x;
  return v_result;
end
$$;

create or replace function public.admin_save_brand(p_brand_id uuid,p_name text,p_is_active boolean,p_sort_order integer default 0)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_role text; v_id uuid; v_slug text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id=v_uid;
  if v_role <> 'admin' then raise exception 'Admin access required'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 2 and 80 then raise exception 'Brand name must be 2 to 80 characters'; end if;
  v_slug := left(regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'), 100);
  if v_slug = '' then raise exception 'Brand name must contain letters or numbers'; end if;
  if p_brand_id is null then
    if exists(select 1 from public.brands where lower(name)=lower(btrim(p_name)) or slug=v_slug) then raise exception 'Brand already exists'; end if;
    insert into public.brands(name,slug,is_active,sort_order) values(btrim(p_name),v_slug,coalesce(p_is_active,true),greatest(coalesce(p_sort_order,0),0)) returning id into v_id;
  else
    if not exists(select 1 from public.brands where id=p_brand_id) then raise exception 'Brand not found'; end if;
    if exists(select 1 from public.brands where id<>p_brand_id and (lower(name)=lower(btrim(p_name)) or slug=v_slug)) then raise exception 'Another brand already uses that name'; end if;
    update public.brands set name=btrim(p_name),slug=v_slug,is_active=coalesce(p_is_active,true),sort_order=greatest(coalesce(p_sort_order,0),0) where id=p_brand_id returning id into v_id;
  end if;
  return v_id;
end
$$;

create or replace function public.admin_delete_brand(p_brand_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_role text; v_count bigint;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id=v_uid;
  if v_role <> 'admin' then raise exception 'Admin access required'; end if;
  select count(*) into v_count from public.products where brand_id=p_brand_id;
  if v_count > 0 then raise exception 'Brand is linked to % product(s). Deactivate it instead.', v_count; end if;
  delete from public.brands where id=p_brand_id;
  return found;
end
$$;

revoke execute on function public.admin_list_categories() from anon, public;
revoke execute on function public.admin_save_category(uuid,text,boolean,integer) from anon, public;
revoke execute on function public.admin_delete_category(uuid) from anon, public;
revoke execute on function public.admin_list_brands() from anon, public;
revoke execute on function public.admin_save_brand(uuid,text,boolean,integer) from anon, public;
revoke execute on function public.admin_delete_brand(uuid) from anon, public;
grant execute on function public.admin_list_categories() to authenticated;
grant execute on function public.admin_save_category(uuid,text,boolean,integer) to authenticated;
grant execute on function public.admin_delete_category(uuid) to authenticated;
grant execute on function public.admin_list_brands() to authenticated;
grant execute on function public.admin_save_brand(uuid,text,boolean,integer) to authenticated;
grant execute on function public.admin_delete_brand(uuid) to authenticated;

create or replace function public.seller_save_product(p_product_id uuid,p_name text,p_description text,p_price numeric,p_compare_at_price numeric,p_status text,p_category_id uuid,p_brand_id uuid,p_variants jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_user uuid:=auth.uid(); v_role text; v_id uuid:=p_product_id; v jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id=v_user;
  if v_role not in ('seller','admin') then raise exception 'Seller access required'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 2 and 160 then raise exception 'Invalid product name'; end if;
  if p_price is null or p_price<0 then raise exception 'Invalid price'; end if;
  if p_compare_at_price is not null and p_compare_at_price<p_price then raise exception 'Compare price cannot be below selling price'; end if;
  if p_status not in ('draft','active','inactive') then raise exception 'Invalid status'; end if;
  if p_category_id is not null and not exists(select 1 from public.categories where id=p_category_id and is_active) then raise exception 'Selected category is not active'; end if;
  if p_brand_id is not null and not exists(select 1 from public.brands where id=p_brand_id and is_active) then raise exception 'Selected brand is not active'; end if;
  if p_product_id is not null then
    if not exists(select 1 from public.products where id=p_product_id and (v_role='admin' or seller_id=v_user)) then raise exception 'Product access denied'; end if;
    update public.products set name=btrim(p_name),description=nullif(btrim(coalesce(p_description,'')),''),price=p_price,compare_at_price=p_compare_at_price,status=p_status,category_id=p_category_id,brand_id=p_brand_id,updated_at=now() where id=p_product_id;
    delete from public.product_variants where product_id=p_product_id;
  else
    insert into public.products(seller_id,name,slug,description,price,compare_at_price,status,category_id,brand_id)
    values(v_user,btrim(p_name),left(regexp_replace(lower(btrim(p_name)),'[^a-z0-9]+','-','g'),150)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,8),nullif(btrim(coalesce(p_description,'')),''),p_price,p_compare_at_price,p_status,p_category_id,p_brand_id)
    returning id into v_id;
  end if;
  for v in select * from jsonb_array_elements(coalesce(p_variants,'[]'::jsonb)) loop
    if coalesce((v->>'stock')::int,0)<0 then raise exception 'Invalid stock'; end if;
    insert into public.product_variants(product_id,size,color,sku,stock) values(v_id,nullif(btrim(v->>'size'),''),nullif(btrim(v->>'color'),''),nullif(btrim(v->>'sku'),''),(v->>'stock')::int);
  end loop;
  return v_id;
end
$$;

revoke execute on function public.seller_save_product(uuid,text,text,numeric,numeric,text,uuid,jsonb) from anon, authenticated, public;
revoke execute on function public.seller_save_product(uuid,text,text,numeric,numeric,text,uuid,uuid,jsonb) from anon, public;
grant execute on function public.seller_save_product(uuid,text,text,numeric,numeric,text,uuid,uuid,jsonb) to authenticated;
