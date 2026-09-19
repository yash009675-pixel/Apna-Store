-- APNA STORE — RLS TESTS
-- Run with: supabase test db
-- These tests use a transaction and roll back all test users/data.

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
values
  ('11111111-1111-1111-1111-111111111111','authenticated','authenticated','rls-test-one@example.invalid','{"full_name":"RLS Test One"}',now(),now(),now()),
  ('22222222-2222-2222-2222-222222222222','authenticated','authenticated','rls-test-two@example.invalid','{"full_name":"RLS Test Two"}',now(),now(),now());

set local role anon;

select results_eq(
  $$select count(*)::bigint from public.products$$,
  $$values (8::bigint)$$,
  'anon can read the current active product catalog'
);

select results_eq(
  $$select count(*)::bigint from public.categories$$,
  $$values (4::bigint)$$,
  'anon can read public categories'
);

select results_eq(
  $$select count(*)::bigint from public.profiles$$,
  $$values (0::bigint)$$,
  'anon cannot read customer profiles'
);

select throws_ok(
  $$insert into public.products(name,slug,price,status)
    values ('RLS blocked','rls-blocked',1,'draft')$$,
  '42501',
  'anon cannot create products'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}';

select results_eq(
  $$select count(*)::bigint from public.profiles$$,
  $$values (1::bigint)$$,
  'customer can read only their own profile'
);

select results_eq(
  $$select role from public.profiles where id='11111111-1111-1111-1111-111111111111'$$,
  $$values ('customer'::text)$$,
  'new auth users receive the customer role'
);

select throws_ok(
  $$update public.profiles
    set role='seller'
    where id='11111111-1111-1111-1111-111111111111'$$,
  '42501',
  'customer cannot self-promote to seller'
);

select results_eq(
  $$select count(*)::bigint from public.products$$,
  $$values (8::bigint)$$,
  'authenticated customer can read active products'
);

select * from finish();
rollback;
