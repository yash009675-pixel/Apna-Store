-- Phase 14: Coupon System
-- Source of truth for the coupon schema and secure RPC layer deployed to Supabase.
-- Existing Phase 7 coupons are preserved and upgraded in-place.

alter table public.coupons
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists owner_type text default 'platform',
  add column if not exists seller_id uuid references public.profiles(id) on delete cascade,
  add column if not exists scope_type text default 'all',
  add column if not exists per_user_limit integer default 1,
  add column if not exists first_order_only boolean default false,
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists updated_at timestamptz default now();

update public.coupons
set name=coalesce(name,code),
    owner_type=coalesce(owner_type,'platform'),
    scope_type=coalesce(scope_type,'all'),
    per_user_limit=coalesce(per_user_limit,1),
    first_order_only=coalesce(first_order_only,false),
    updated_at=coalesce(updated_at,created_at);

alter table public.coupons
  alter column name set not null,
  alter column owner_type set not null,
  alter column scope_type set not null,
  alter column per_user_limit set not null,
  alter column first_order_only set not null,
  alter column updated_at set not null;

alter table public.coupons drop constraint if exists coupons_owner_type_check;
alter table public.coupons add constraint coupons_owner_type_check check(owner_type in ('platform','seller'));
alter table public.coupons drop constraint if exists coupons_scope_type_check;
alter table public.coupons add constraint coupons_scope_type_check check(scope_type in ('all','products','categories'));
alter table public.coupons drop constraint if exists coupons_per_user_limit_check;
alter table public.coupons add constraint coupons_per_user_limit_check check(per_user_limit>0);
alter table public.coupons drop constraint if exists coupons_seller_owner_check;
alter table public.coupons add constraint coupons_seller_owner_check check((owner_type='platform' and seller_id is null) or (owner_type='seller' and seller_id is not null));

create table if not exists public.coupon_products(
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key(coupon_id,product_id)
);
create table if not exists public.coupon_categories(
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key(coupon_id,category_id)
);
create table if not exists public.coupon_usages(
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  discount_amount numeric(12,2) not null check(discount_amount>=0),
  eligible_amount numeric(12,2) not null default 0 check(eligible_amount>=0),
  created_at timestamptz not null default now()
);

create index if not exists coupons_active_window_idx on public.coupons(is_active,starts_at,expires_at);
create index if not exists coupons_seller_id_idx on public.coupons(seller_id);
create index if not exists coupon_products_product_id_idx on public.coupon_products(product_id);
create index if not exists coupon_categories_category_id_idx on public.coupon_categories(category_id);
create index if not exists coupon_usages_coupon_id_idx on public.coupon_usages(coupon_id,created_at desc);
create index if not exists coupon_usages_user_coupon_idx on public.coupon_usages(user_id,coupon_id,created_at desc);

alter table public.coupons enable row level security;
alter table public.coupon_products enable row level security;
alter table public.coupon_categories enable row level security;
alter table public.coupon_usages enable row level security;

-- Secure management and checkout RPCs are defined in the deployed migration.
-- Direct table writes are revoked; customer coupon validation/order application
-- is server-side so discount limits cannot be trusted from the browser.

revoke insert,update,delete on public.coupons,public.coupon_products,public.coupon_categories,public.coupon_usages from authenticated,anon;
