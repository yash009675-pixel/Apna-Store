-- Phase 32: Courier / logistics foundation
-- Provider credentials are intentionally kept in Supabase Edge Function secrets.
-- This migration only creates the server-side shipment model and read access.

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  return_request_id uuid references public.return_requests(id) on delete set null,
  seller_id uuid references public.profiles(id) on delete set null,
  direction text not null default 'outbound' check (direction in ('outbound','return','rto')),
  provider text not null,
  provider_order_id text,
  provider_shipment_id text,
  awb_number text,
  pickup_id text,
  status text not null default 'created' check (status in ('created','manifested','pickup_scheduled','picked_up','in_transit','out_for_delivery','delivered','pickup_failed','delivery_failed','rto_initiated','rto_delivered','cancelled','exception')),
  tracking_url text,
  label_url text,
  invoice_url text,
  manifest_url text,
  estimated_delivery_date date,
  weight_grams integer check (weight_grams is null or weight_grams > 0),
  length_cm numeric check (length_cm is null or length_cm > 0),
  width_cm numeric check (width_cm is null or width_cm > 0),
  height_cm numeric check (height_cm is null or height_cm > 0),
  package_count integer not null default 1 check (package_count > 0),
  cod_amount numeric not null default 0 check (cod_amount >= 0),
  shipping_charge numeric not null default 0 check (shipping_charge >= 0),
  raw_provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists shipments_provider_awb_unique on public.shipments(provider, awb_number) where awb_number is not null;
create index if not exists shipments_order_id_idx on public.shipments(order_id);
create index if not exists shipments_seller_id_idx on public.shipments(seller_id);
create index if not exists shipments_return_request_id_idx on public.shipments(return_request_id);
create index if not exists shipments_status_idx on public.shipments(status);

create table if not exists public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  event_code text,
  status text not null,
  description text,
  location text,
  event_at timestamptz not null,
  raw_provider_event text,
  created_at timestamptz not null default now()
);
create index if not exists shipment_events_shipment_event_at_idx on public.shipment_events(shipment_id, event_at desc);

create table if not exists public.shipping_pickups (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  provider text not null,
  provider_pickup_id text,
  pickup_status text not null default 'requested' check (pickup_status in ('requested','scheduled','picked_up','failed','cancelled')),
  scheduled_at timestamptz,
  picked_up_at timestamptz,
  instructions text,
  raw_provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shipping_pickups_shipment_id_idx on public.shipping_pickups(shipment_id);
create unique index if not exists shipping_pickups_provider_id_unique on public.shipping_pickups(provider, provider_pickup_id) where provider_pickup_id is not null;

alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;
alter table public.shipping_pickups enable row level security;

revoke all on public.shipments from anon;
revoke all on public.shipment_events from anon;
revoke all on public.shipping_pickups from anon;
grant select on public.shipments to authenticated;
grant select on public.shipment_events to authenticated;
grant select on public.shipping_pickups to authenticated;

drop policy if exists shipments_customer_select on public.shipments;
create policy shipments_customer_select on public.shipments for select to authenticated using (
  exists (select 1 from public.orders o where o.id = shipments.order_id and o.user_id = (select auth.uid()))
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  or seller_id = (select auth.uid())
);

drop policy if exists shipment_events_customer_select on public.shipment_events;
create policy shipment_events_customer_select on public.shipment_events for select to authenticated using (
  exists (
    select 1 from public.shipments s join public.orders o on o.id = s.order_id
    where s.id = shipment_events.shipment_id
      and (o.user_id = (select auth.uid()) or s.seller_id = (select auth.uid())
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  )
);

drop policy if exists shipping_pickups_customer_select on public.shipping_pickups;
create policy shipping_pickups_customer_select on public.shipping_pickups for select to authenticated using (
  exists (
    select 1 from public.shipments s join public.orders o on o.id = s.order_id
    where s.id = shipping_pickups.shipment_id
      and (o.user_id = (select auth.uid()) or s.seller_id = (select auth.uid())
        or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  )
);

create or replace function public.set_shipping_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists shipments_set_updated_at on public.shipments;
create trigger shipments_set_updated_at before update on public.shipments for each row execute function public.set_shipping_updated_at();
drop trigger if exists shipping_pickups_set_updated_at on public.shipping_pickups;
create trigger shipping_pickups_set_updated_at before update on public.shipping_pickups for each row execute function public.set_shipping_updated_at();

revoke all on function public.set_shipping_updated_at() from public, anon, authenticated;

comment on table public.shipments is 'Courier shipments for outbound orders, customer returns, and RTO. Provider credentials stay in Edge Function secrets.';
comment on table public.shipment_events is 'Courier tracking timeline events synchronized from the provider.';
comment on table public.shipping_pickups is 'Courier pickup requests and pickup references linked to shipments.';
