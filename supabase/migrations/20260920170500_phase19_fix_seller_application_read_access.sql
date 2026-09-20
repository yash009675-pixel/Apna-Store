-- Phase 19: restore authenticated customer read access for seller applications.
-- Submission remains server-side through submit_seller_application().
grant select on table public.seller_applications to authenticated;

drop policy if exists seller_applications_read_own on public.seller_applications;
create policy seller_applications_read_own
on public.seller_applications
for select
to authenticated
using (user_id = auth.uid());
