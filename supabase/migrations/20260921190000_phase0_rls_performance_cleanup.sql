-- Phase 0 RLS performance cleanup. Mirrors the live Supabase migrations applied during Phase 0.
alter policy notifications_read_own on public.notifications using (user_id = (select auth.uid()));
alter policy notifications_update_own on public.notifications using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy payment_transactions_owner_read on public.payment_transactions using (user_id = (select auth.uid()));
alter policy seller_applications_read_own on public.seller_applications using (user_id = (select auth.uid()));
drop policy if exists seller_applications_select_own on public.seller_applications;

drop policy if exists marketing_campaigns_public_read on public.marketing_campaigns;
drop policy if exists marketing_campaigns_admin_read on public.marketing_campaigns;
create policy marketing_campaigns_anon_read on public.marketing_campaigns
for select to anon
using (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
create policy marketing_campaigns_authenticated_read on public.marketing_campaigns
for select to authenticated
using (
  (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
  or (select private.is_admin())
);

drop policy if exists seller_applications_admin_read on public.seller_applications;
drop policy if exists seller_applications_read_own on public.seller_applications;
create policy seller_applications_authenticated_read on public.seller_applications
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
);