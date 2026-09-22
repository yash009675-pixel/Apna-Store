-- Phase 7: Inventory Center
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity_before integer not null,
  quantity_change integer not null,
  quantity_after integer not null,
  reason text not null check (reason in ('manual_adjustment','listing_update','bulk_update','order','return','restock','correction')),
  reference_id uuid,
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists inventory_movements_variant_created_idx on public.inventory_movements(product_variant_id, created_at desc);
create index if not exists inventory_movements_created_by_idx on public.inventory_movements(created_by, created_at desc);
alter table public.inventory_movements enable row level security;
drop policy if exists inventory_movements_authenticated_read on public.inventory_movements;
create policy inventory_movements_authenticated_read on public.inventory_movements for select to authenticated using (
  exists (
    select 1 from public.product_variants v
    join public.products p on p.id=v.product_id
    where v.id=product_variant_id
      and (p.seller_id=(select auth.uid()) or exists(select 1 from public.profiles me where me.id=(select auth.uid()) and me.role='admin'))
  )
);
create or replace function public.seller_adjust_inventory(p_variant_id uuid,p_delta integer,p_reason text default 'manual_adjustment',p_note text default null)
returns integer language plpgsql security definer set search_path=public as $function$
declare v_user uuid:=auth.uid(); v_role text; v_before integer; v_after integer;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select role into v_role from public.profiles where id=v_user;
 if v_role not in ('seller','admin') then raise exception 'Seller access required'; end if;
 if p_delta is null or p_delta=0 then raise exception 'Stock adjustment cannot be zero'; end if;
 if p_reason not in ('manual_adjustment','restock','correction','return') then raise exception 'Invalid inventory adjustment reason'; end if;
 select v.stock into v_before from public.product_variants v join public.products p on p.id=v.product_id where v.id=p_variant_id and (v_role='admin' or p.seller_id=v_user) for update;
 if v_before is null then raise exception 'Variant access denied'; end if;
 v_after:=v_before+p_delta;
 if v_after<0 then raise exception 'Stock cannot become negative'; end if;
 update public.product_variants set stock=v_after where id=p_variant_id;
 insert into public.inventory_movements(product_variant_id,quantity_before,quantity_change,quantity_after,reason,note,created_by)
 values(p_variant_id,v_before,p_delta,v_after,p_reason,nullif(btrim(p_note),''),v_user);
 return v_after;
end;$function$;
revoke all on function public.seller_adjust_inventory(uuid,integer,text,text) from public,anon;
grant execute on function public.seller_adjust_inventory(uuid,integer,text,text) to authenticated;