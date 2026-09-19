-- Phase 0 authorization boundary checks.
-- Run with a privileged SQL connection only; these are inspection assertions,
-- not application authorization themselves.

-- 1. Exposed customer profile/order/product tables must have RLS enabled.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'profiles','products','product_variants','orders','order_items','addresses','wishlists','reviews'
  )
order by c.relname;

-- 2. Customer signup must not grant seller/admin by default.
select tgname
from pg_trigger
where tgrelid = 'auth.users'::regclass
  and not tgisinternal
order by tgname;

-- 3. Role helpers must remain SECURITY DEFINER and live outside public.
select
  n.nspname as schema_name,
  p.proname,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and p.proname in ('is_admin','is_seller')
order by p.proname;

-- 4. Checkout RPC is intentionally callable by authenticated customers,
-- but not by anonymous visitors.
select
  has_function_privilege(
    'anon',
    'public.create_order_secure(jsonb,jsonb,text)',
    'EXECUTE'
  ) as anon_can_checkout,
  has_function_privilege(
    'authenticated',
    'public.create_order_secure(jsonb,jsonb,text)',
    'EXECUTE'
  ) as authenticated_can_checkout;

-- 5. Inspect role-based policies on seller/admin-sensitive resources.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles','products','product_variants','orders')
order by tablename, policyname;
