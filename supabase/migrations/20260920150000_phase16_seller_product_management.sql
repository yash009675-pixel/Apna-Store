create or replace function public.seller_save_product(
 p_product_id uuid,p_name text,p_description text,p_price numeric,p_compare_at_price numeric,p_status text,p_category_id uuid,p_variants jsonb
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid(); v_role text; v_id uuid:=p_product_id; v jsonb;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select role into v_role from public.profiles where id=v_user;
 if v_role not in ('seller','admin') then raise exception 'Seller access required'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 2 and 160 then raise exception 'Invalid product name'; end if;
 if p_price is null or p_price<0 then raise exception 'Invalid price'; end if;
 if p_compare_at_price is not null and p_compare_at_price<p_price then raise exception 'Compare price cannot be below selling price'; end if;
 if p_status not in ('draft','active','inactive') then raise exception 'Invalid status'; end if;
 if p_product_id is not null then
   if not exists(select 1 from public.products where id=p_product_id and (v_role='admin' or seller_id=v_user)) then raise exception 'Product access denied'; end if;
   update public.products set name=btrim(p_name),description=nullif(btrim(coalesce(p_description,'')),''),price=p_price,compare_at_price=p_compare_at_price,status=p_status,category_id=p_category_id where id=p_product_id;
   delete from public.product_variants where product_id=p_product_id;
 else
   insert into public.products(seller_id,name,slug,description,price,compare_at_price,status,category_id)
   values(v_user,btrim(p_name),left(regexp_replace(lower(btrim(p_name)),'[^a-z0-9]+','-','g'),150)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,8),nullif(btrim(coalesce(p_description,'')),''),p_price,p_compare_at_price,p_status,p_category_id) returning id into v_id;
 end if;
 for v in select * from jsonb_array_elements(coalesce(p_variants,'[]'::jsonb)) loop
   if coalesce((v->>'stock')::int,0)<0 then raise exception 'Invalid stock'; end if;
   insert into public.product_variants(product_id,size,color,sku,stock)
   values(v_id,nullif(btrim(v->>'size'),''),nullif(btrim(v->>'color'),''),nullif(btrim(v->>'sku'),''),(v->>'stock')::int);
 end loop;
 return v_id;
end $$;
revoke all on function public.seller_save_product(uuid,text,text,numeric,numeric,text,uuid,jsonb) from public,anon;
grant execute on function public.seller_save_product(uuid,text,text,numeric,numeric,text,uuid,jsonb) to authenticated;