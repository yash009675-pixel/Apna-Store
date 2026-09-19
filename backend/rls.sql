-- APNA STORE — ROW LEVEL SECURITY
-- Run after backend/schema.sql in Supabase SQL Editor.
-- These policies are designed for a browser client using the publishable key.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_seller()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('seller','admin')
  );
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.wishlists enable row level security;
alter table public.reviews enable row level security;

-- Profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert to authenticated
with check (id = auth.uid() and role = 'customer');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (id = auth.uid() and role = 'customer')
);

-- Categories
drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories
for select to anon, authenticated
using (true);

drop policy if exists "categories_admin_write" on public.categories;
create policy "categories_admin_write" on public.categories
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Products
drop policy if exists "products_public_read_active" on public.products;
create policy "products_public_read_active" on public.products
for select to anon, authenticated
using (status = 'active' or public.is_admin() or (seller_id = auth.uid() and public.is_seller()));

drop policy if exists "products_seller_insert" on public.products;
create policy "products_seller_insert" on public.products
for insert to authenticated
with check (
  public.is_admin()
  or (public.is_seller() and seller_id = auth.uid())
);

drop policy if exists "products_seller_update" on public.products;
create policy "products_seller_update" on public.products
for update to authenticated
using (public.is_admin() or (public.is_seller() and seller_id = auth.uid()))
with check (public.is_admin() or (public.is_seller() and seller_id = auth.uid()));

drop policy if exists "products_seller_delete" on public.products;
create policy "products_seller_delete" on public.products
for delete to authenticated
using (public.is_admin() or (public.is_seller() and seller_id = auth.uid()));

-- Product variants
drop policy if exists "variants_public_read_active" on public.product_variants;
create policy "variants_public_read_active" on public.product_variants
for select to anon, authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = product_id and (
      p.status = 'active'
      or public.is_admin()
      or (p.seller_id = auth.uid() and public.is_seller())
    )
  )
);

drop policy if exists "variants_seller_insert" on public.product_variants;
create policy "variants_seller_insert" on public.product_variants
for insert to authenticated
with check (
  public.is_admin()
  or (
    public.is_seller()
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.seller_id = auth.uid()
    )
  )
);

drop policy if exists "variants_seller_update" on public.product_variants;
create policy "variants_seller_update" on public.product_variants
for update to authenticated
using (
  public.is_admin()
  or (
    public.is_seller()
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.seller_id = auth.uid()
    )
  )
)
with check (
  public.is_admin()
  or (
    public.is_seller()
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.seller_id = auth.uid()
    )
  )
);

drop policy if exists "variants_seller_delete" on public.product_variants;
create policy "variants_seller_delete" on public.product_variants
for delete to authenticated
using (
  public.is_admin()
  or (
    public.is_seller()
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.seller_id = auth.uid()
    )
  )
);

-- Addresses
drop policy if exists "addresses_own" on public.addresses;
create policy "addresses_own" on public.addresses
for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

-- Orders
drop policy if exists "orders_read_own" on public.orders;
create policy "orders_read_own" on public.orders
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update" on public.orders
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Order items
drop policy if exists "order_items_read_own" on public.order_items;
create policy "order_items_read_own" on public.order_items
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.orders o
    where o.id = order_id and o.user_id = auth.uid()
  )
);

drop policy if exists "order_items_insert_own" on public.order_items;
create policy "order_items_insert_own" on public.order_items
for insert to authenticated
with check (
  exists (
    select 1 from public.orders o
    where o.id = order_id and o.user_id = auth.uid()
  )
);

-- Wishlist
drop policy if exists "wishlist_own" on public.wishlists;
create policy "wishlist_own" on public.wishlists
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Reviews
drop policy if exists "reviews_public_read" on public.reviews;
create policy "reviews_public_read" on public.reviews
for select to anon, authenticated
using (true);

drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own" on public.reviews
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "reviews_update_own" on public.reviews;
create policy "reviews_update_own" on public.reviews
for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "reviews_delete_own" on public.reviews;
create policy "reviews_delete_own" on public.reviews
for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Create a customer profile automatically when a new Auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.phone, ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- NOTE:
-- Seller/admin role promotion must be performed by a trusted admin/backend.
-- Never let a public signup request choose its own seller/admin role.
