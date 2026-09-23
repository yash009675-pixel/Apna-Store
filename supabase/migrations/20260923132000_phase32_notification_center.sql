-- Phase 32: Notification Center
-- Extends the existing in-app notification system with role/category metadata,
-- user-owned in-app preferences, and a secure multi-channel delivery queue.
-- External Email/SMS/WhatsApp delivery is never marked sent without a real provider.

begin;

alter table public.notifications
  add column if not exists category text not null default 'system',
  add column if not exists audience_role text;

update public.notifications
set category = case
  when type in ('order_placed','order_confirmed','order_status','order_cancelled') then 'order'
  when type in ('payment','payment_success','payment_failed') then 'payment'
  when type in ('shipment','shipment_created','shipment_status','out_for_delivery') then 'shipment'
  when type in ('delivery','delivered','delivery_exception') then 'delivery'
  when type in ('return','return_requested','return_approved','return_rejected') then 'return'
  when type in ('refund','refund_status') then 'refund'
  when type in ('offer','offers','campaign','campaign_update') then 'offers'
  when type in ('low_stock','growth_alert') then 'growth'
  when type in ('pickup','pickup_scheduled','pickup_failed') then 'pickup'
  when type in ('listing_approval','listing_rejected','listing_approved') then 'listing'
  when type in ('seller_application','seller_application_update','seller_issue') then 'seller'
  when type in ('support','support_escalation') then 'support'
  when type in ('fraud','risk','fraud_risk') then 'fraud_risk'
  else 'system'
end;

update public.notifications n
set audience_role = p.role
from public.profiles p
where p.id = n.user_id
  and n.audience_role is distinct from p.role;

alter table public.notifications
  add constraint notifications_category_check
  check (category in ('order','payment','shipment','delivery','return','refund','offers','new_order','low_stock','pickup','listing','campaign','growth','critical','courier','seller','support','fraud_risk','system'));

alter table public.notifications
  add constraint notifications_audience_role_check
  check (audience_role is null or audience_role in ('customer','seller','admin'));

create index if not exists notifications_user_category_idx
  on public.notifications (user_id, category, created_at desc);

create table if not exists public.notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('in_app','email','sms','whatsapp')),
  category text not null check (category in ('order','payment','shipment','delivery','return','refund','offers','new_order','low_stock','pickup','listing','campaign','growth','critical','courier','seller','support','fraud_risk','system')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, channel, category)
);

alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon;
grant select, insert, update, delete on public.notification_preferences to authenticated;

drop policy if exists notification_preferences_read_own on public.notification_preferences;
create policy notification_preferences_read_own on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists notification_preferences_insert_own on public.notification_preferences;
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists notification_preferences_delete_own on public.notification_preferences;
create policy notification_preferences_delete_own on public.notification_preferences
  for delete to authenticated using (user_id = (select auth.uid()));

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check (channel in ('in_app','email','sms','whatsapp')),
  status text not null default 'pending' check (status in ('pending','queued','sent','failed','skipped')),
  provider_message_id text,
  error_message text,
  attempted_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (notification_id, channel)
);

alter table public.notification_deliveries enable row level security;
revoke all on public.notification_deliveries from anon, authenticated;
grant all on public.notification_deliveries to service_role;

create index if not exists notification_deliveries_status_idx on public.notification_deliveries(status, created_at);
create index if not exists notification_deliveries_notification_idx on public.notification_deliveries(notification_id, channel);

create or replace function public.set_notification_preference(p_channel text,p_category text,p_enabled boolean)
returns public.notification_preferences
language sql security invoker volatile set search_path=public,pg_temp
as $$
  insert into public.notification_preferences(user_id,channel,category,enabled,updated_at)
  values ((select auth.uid()),p_channel,p_category,p_enabled,now())
  on conflict(user_id,channel,category)
  do update set enabled=excluded.enabled,updated_at=now()
  returning *;
$$;

revoke all on function public.set_notification_preference(text,text,boolean) from public, anon;
grant execute on function public.set_notification_preference(text,text,boolean) to authenticated;

commit;
