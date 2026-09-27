-- Fix public catalog RLS for signed-out storefront visitors.
-- Keep inactive categories restricted to admins without invoking the admin helper for anon.

drop policy if exists "categories_public_read" on public.categories;
drop policy if exists "categories_admin_read" on public.categories;

create policy "categories_public_read"
on public.categories
for select
to anon, authenticated
using (is_active);

create policy "categories_admin_read"
on public.categories
for select
to authenticated
using (private.is_admin());
