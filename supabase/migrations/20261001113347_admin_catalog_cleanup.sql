-- Single-owner Apna Store: admin-only catalog/inventory RPCs.
create or replace function public.admin_save_listing(p_product_id uuid,p_name text,p_description text,p_price numeric,p_compare_at_price numeric,p_discount_percent numeric,p_status text,p_category_id uuid,p_subcategory text,p_brand_id uuid,p_attributes jsonb,p_gst_rate numeric,p_shipping_details jsonb,p_return_policy text,p_package_weight_kg numeric,p_package_length_cm numeric,p_package_width_cm numeric,p_package_height_cm numeric,p_variants jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid:=p_product_id; v jsonb; v_vid uuid; v_ids uuid[]:='{}';
begin
 if not exists(select 1 from profiles where id=auth.uid() and role='admin') then raise exception 'Admin access required'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 2 and 160 then raise exception 'Invalid product name'; end if;
 if p_price is null or p_price<0 then raise exception 'Invalid price'; end if;
 if p_compare_at_price is not null and p_compare_at_price<p_price then raise exception 'MRP cannot be below selling price'; end if;
 if p_discount_percent is not null and (p_discount_percent<0 or p_discount_percent>100) then raise exception 'Invalid discount'; end if;
 if p_gst_rate is not null and (p_gst_rate<0 or p_gst_rate>100) then raise exception 'Invalid GST rate'; end if;
 if p_status not in ('draft','active','inactive','pending_approval','rejected','archived') then raise exception 'Invalid listing status'; end if;
 if p_category_id is not null and not exists(select 1 from categories where id=p_category_id and is_active) then raise exception 'Selected category is not active'; end if;
 if p_brand_id is not null and not exists(select 1 from brands where id=p_brand_id and is_active) then raise exception 'Selected brand is not active'; end if;
 if p_product_id is null then
   insert into products(seller_id,name,slug,description,price,compare_at_price,discount_percent,status,category_id,subcategory,brand_id,attributes,gst_rate,shipping_details,return_policy,package_weight_kg,package_length_cm,package_width_cm,package_height_cm,approval_submitted_at)
   values(auth.uid(),btrim(p_name),left(regexp_replace(lower(btrim(p_name)),'[^a-z0-9]+','-','g'),150)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,8),nullif(btrim(coalesce(p_description,'')),''),p_price,p_compare_at_price,p_discount_percent,p_status,p_category_id,nullif(btrim(coalesce(p_subcategory,'')),''),p_brand_id,coalesce(p_attributes,'{}'::jsonb),p_gst_rate,coalesce(p_shipping_details,'{}'::jsonb),nullif(btrim(coalesce(p_return_policy,'')),''),p_package_weight_kg,p_package_length_cm,p_package_width_cm,p_package_height_cm,case when p_status='pending_approval' then now() end) returning id into v_id;
 else
   if not exists(select 1 from products where id=p_product_id) then raise exception 'Product access denied'; end if;
   update products set name=btrim(p_name),description=nullif(btrim(coalesce(p_description,'')),''),price=p_price,compare_at_price=p_compare_at_price,discount_percent=p_discount_percent,status=p_status,category_id=p_category_id,subcategory=nullif(btrim(coalesce(p_subcategory,'')),''),brand_id=p_brand_id,attributes=coalesce(p_attributes,'{}'),gst_rate=p_gst_rate,shipping_details=coalesce(p_shipping_details,'{}'),return_policy=nullif(btrim(coalesce(p_return_policy,'')),''),package_weight_kg=p_package_weight_kg,package_length_cm=p_package_length_cm,package_width_cm=p_package_width_cm,package_height_cm=p_package_height_cm,updated_at=now() where id=p_product_id;
 end if;
 for v in select * from jsonb_array_elements(coalesce(p_variants,'[]')) loop
   v_vid:=nullif(v->>'id','')::uuid;
   if v_vid is not null and exists(select 1 from product_variants where id=v_vid and product_id=v_id) then
     update product_variants set size=nullif(btrim(v->>'size'),''),color=nullif(btrim(v->>'color'),''),sku=nullif(btrim(v->>'sku'),''),stock=greatest(0,coalesce((v->>'stock')::int,0)) where id=v_vid;
   else
     insert into product_variants(product_id,size,color,sku,stock) values(v_id,nullif(btrim(v->>'size'),''),nullif(btrim(v->>'color'),''),nullif(btrim(v->>'sku'),''),greatest(0,coalesce((v->>'stock')::int,0))) returning id into v_vid;
   end if;
   v_ids:=array_append(v_ids,v_vid);
 end loop;
 delete from product_variants where product_id=v_id and not(id=any(v_ids));
 return v_id;
end $$;

create or replace function public.admin_set_listing_status(p_product_id uuid,p_status text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from profiles where id=auth.uid() and role='admin') then raise exception 'Admin access required'; end if;
 if p_status not in ('draft','active','inactive','pending_approval','rejected','archived') then raise exception 'Invalid listing status'; end if;
 update products set status=p_status,updated_at=now() where id=p_product_id;
 if not found then raise exception 'Product not found'; end if; return true;
end $$;

create or replace function public.admin_delete_listing(p_product_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from profiles where id=auth.uid() and role='admin') then raise exception 'Admin access required'; end if;
 delete from products where id=p_product_id;
 if not found then raise exception 'Product cannot be deleted or does not exist'; end if; return true;
end $$;

create or replace function public.admin_duplicate_listing(p_product_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare p products%rowtype; n uuid; v product_variants%rowtype;
begin
 if not exists(select 1 from profiles where id=auth.uid() and role='admin') then raise exception 'Admin access required'; end if;
 select * into p from products where id=p_product_id; if not found then raise exception 'Product not found'; end if;
 insert into products(seller_id,name,slug,description,price,compare_at_price,discount_percent,status,category_id,subcategory,brand_id,attributes,gst_rate,shipping_details,return_policy,package_weight_kg,package_length_cm,package_width_cm,package_height_cm) values(p.seller_id,p.name||' Copy',left(regexp_replace(lower(p.name||'-copy'),'[^a-z0-9]+','-','g'),150)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,8),p.description,p.price,p.compare_at_price,p.discount_percent,'draft',p.category_id,p.subcategory,p.brand_id,p.attributes,p.gst_rate,p.shipping_details,p.return_policy,p.package_weight_kg,p.package_length_cm,p.package_width_cm,p.package_height_cm) returning id into n;
 for v in select * from product_variants where product_id=p_product_id order by created_at loop
  insert into product_variants(product_id,size,color,sku,stock) values(n,v.size,v.color,case when v.sku is null then null else v.sku||'-COPY-'||substr(replace(gen_random_uuid()::text,'-',''),1,6) end,v.stock);
 end loop; return n;
end $$;

create or replace function public.admin_bulk_update_listings(p_product_ids uuid[],p_stock integer default null,p_price numeric default null,p_discount_percent numeric default null,p_status text default null) returns integer language plpgsql security definer set search_path=public as $$
declare changed integer:=0;
begin
 if not exists(select 1 from profiles where id=auth.uid() and role='admin') then raise exception 'Admin access required'; end if;
 if p_stock is not null and p_stock<0 then raise exception 'Stock cannot be negative'; end if;
 if p_price is not null and p_price<0 then raise exception 'Price cannot be negative'; end if;
 if p_discount_percent is not null and (p_discount_percent<0 or p_discount_percent>100) then raise exception 'Discount must be between 0 and 100'; end if;
 if p_status is not null and p_status not in ('draft','active','inactive','pending_approval','rejected','archived') then raise exception 'Invalid listing status'; end if;
 update products set price=coalesce(p_price,price),discount_percent=coalesce(p_discount_percent,discount_percent),status=coalesce(p_status,status),updated_at=now() where id=any(p_product_ids); get diagnostics changed=row_count;
 if p_stock is not null then update product_variants set stock=p_stock where product_id=any(p_product_ids); end if; return changed;
end $$;

create or replace function public.admin_adjust_inventory(p_variant_id uuid,p_delta integer,p_reason text default 'manual_adjustment',p_note text default null) returns integer language plpgsql security definer set search_path=public as $$
declare before_stock integer; after_stock integer;
begin
 if not exists(select 1 from profiles where id=auth.uid() and role='admin') then raise exception 'Admin access required'; end if;
 if p_delta is null or p_delta=0 then raise exception 'Stock adjustment cannot be zero'; end if;
 if p_reason not in ('manual_adjustment','restock','correction','return') then raise exception 'Invalid inventory adjustment reason'; end if;
 select stock into before_stock from product_variants where id=p_variant_id for update; if before_stock is null then raise exception 'Variant not found'; end if;
 after_stock:=before_stock+p_delta; if after_stock<0 then raise exception 'Stock cannot become negative'; end if;
 update product_variants set stock=after_stock where id=p_variant_id;
 insert into inventory_movements(product_variant_id,quantity_before,quantity_change,quantity_after,reason,note,created_by) values(p_variant_id,before_stock,p_delta,after_stock,p_reason,nullif(btrim(p_note),''),auth.uid());
 return after_stock;
end $$;

grant execute on function public.admin_save_listing(uuid,text,text,numeric,numeric,numeric,text,uuid,text,uuid,jsonb,numeric,jsonb,text,numeric,numeric,numeric,numeric,jsonb) to authenticated;
grant execute on function public.admin_set_listing_status(uuid,text) to authenticated;
grant execute on function public.admin_delete_listing(uuid) to authenticated;
grant execute on function public.admin_duplicate_listing(uuid) to authenticated;
grant execute on function public.admin_bulk_update_listings(uuid[],integer,numeric,numeric,text) to authenticated;
grant execute on function public.admin_adjust_inventory(uuid,integer,text,text) to authenticated;