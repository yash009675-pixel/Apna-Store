-- Phase 8: Seller Order Management
alter table public.orders add column if not exists seller_order_status text;
update public.orders set seller_order_status=case
 when status='pending' then 'New' when status='confirmed' then 'Accepted'
 when status='processing' then 'Packing' when status='shipped' then 'Shipped'
 when status='delivered' then 'Delivered' when status='cancelled' then 'Cancelled'
 else 'New' end
where seller_order_status is null;
alter table public.orders drop constraint if exists orders_seller_order_status_check;
alter table public.orders add constraint orders_seller_order_status_check check (seller_order_status in ('New','Accepted','Packing','Ready for Pickup','Pickup Scheduled','Picked Up','Shipped','In Transit','Out for Delivery','Delivered','Cancelled','Return','Exchange','RTO'));
create index if not exists orders_seller_order_status_idx on public.orders(seller_order_status);
create table if not exists public.seller_order_status_events (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 status text not null check (status in ('New','Accepted','Packing','Ready for Pickup','Pickup Scheduled','Picked Up','Shipped','In Transit','Out for Delivery','Delivered','Cancelled','Return','Exchange','RTO')),
 note text,
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
create index if not exists seller_order_status_events_order_idx on public.seller_order_status_events(order_id,created_at desc);
alter table public.seller_order_status_events enable row level security;
drop policy if exists seller_order_status_events_read on public.seller_order_status_events;
create policy seller_order_status_events_read on public.seller_order_status_events for select to authenticated using (
 exists(select 1 from public.order_items oi join public.products p on p.id=oi.product_id where oi.order_id=seller_order_status_events.order_id and (p.seller_id=(select auth.uid()) or exists(select 1 from public.profiles me where me.id=(select auth.uid()) and me.role='admin')))
);
create or replace function public.seller_set_order_status(p_order_id uuid,p_status text,p_note text default null)
returns boolean language plpgsql security definer set search_path=public as $function$
declare v_uid uuid:=auth.uid(); v_role text; v_status text; 
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 select role into v_role from public.profiles where id=v_uid;
 if v_role not in ('seller','admin') then raise exception 'Seller access required'; end if;
 if p_status not in ('New','Accepted','Packing','Ready for Pickup','Pickup Scheduled','Picked Up','Shipped','In Transit','Out for Delivery','Delivered','Cancelled','Return','Exchange','RTO') then raise exception 'Invalid seller order status'; end if;
 if not exists(select 1 from public.order_items oi join public.products p on p.id=oi.product_id where oi.order_id=p_order_id and (v_role='admin' or p.seller_id=v_uid)) then raise exception 'Order access denied'; end if;
 update public.orders set seller_order_status=p_status,
   status=case when p_status='New' then 'pending' when p_status='Accepted' then 'confirmed' when p_status='Packing' then 'processing' when p_status in ('Shipped','In Transit','Out for Delivery') then 'shipped' when p_status='Delivered' then 'delivered' when p_status='Cancelled' then 'cancelled' else status end,
   delivery_status=case when p_status='Out for Delivery' then 'out_for_delivery' when p_status='Delivered' then 'delivered' when p_status='Cancelled' then 'cancelled' when p_status in ('Shipped','In Transit') then 'shipped' else delivery_status end
 where id=p_order_id;
 insert into public.seller_order_status_events(order_id,status,note,created_by) values(p_order_id,p_status,nullif(btrim(p_note),''),v_uid);
 return true;
end;$function$;
revoke all on function public.seller_set_order_status(uuid,text,text) from public,anon;
grant execute on function public.seller_set_order_status(uuid,text,text) to authenticated;