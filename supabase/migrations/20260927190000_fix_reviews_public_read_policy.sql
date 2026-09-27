drop policy if exists reviews_public_read on public.reviews;

create policy reviews_public_read on public.reviews
for select to anon
using (moderation_status = 'approved');

create policy reviews_authenticated_read on public.reviews
for select to authenticated
using (
  moderation_status = 'approved'
  or user_id = (select auth.uid())
  or private.is_admin()
);
