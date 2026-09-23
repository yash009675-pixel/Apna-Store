create table if not exists public.seller_store_profiles (
  seller_id uuid primary key references public.profiles(id) on delete cascade,
  store_name text not null check (length(btrim(store_name)) between 2 and 120),
  logo_url text,
  about text not null default '' check (length(about) <= 2000),
  store_policies text not null default '' check (length(store_policies) <= 4000),
  return_policy text not null default '' check (length(return_policy) <= 4000),
  shipping_information text not null default '' check (length(shipping_information) <= 4000),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seller_store_profiles_published_idx on public.seller_store_profiles (is_published, seller_id);
alter table public.seller_store_profiles enable row level security;
drop policy if exists seller_store_profiles_public_read on public.seller_store_profiles;
create policy seller_store_profiles_public_read on public.seller_store_profiles for select to anon, authenticated using (is_published = true or ((select auth.uid()) = seller_id));
drop policy if exists seller_store_profiles_owner_insert on public.seller_store_profiles;
create policy seller_store_profiles_owner_insert on public.seller_store_profiles for insert to authenticated with check ((select auth.uid()) = seller_id and private.is_seller());
drop policy if exists seller_store_profiles_owner_update on public.seller_store_profiles;
create policy seller_store_profiles_owner_update on public.seller_store_profiles for update to authenticated using ((select auth.uid()) = seller_id and private.is_seller()) with check ((select auth.uid()) = seller_id and private.is_seller());
drop policy if exists seller_store_profiles_owner_delete on public.seller_store_profiles;
create policy seller_store_profiles_owner_delete on public.seller_store_profiles for delete to authenticated using ((select auth.uid()) = seller_id and private.is_seller());
revoke all on public.seller_store_profiles from anon;
revoke all on public.seller_store_profiles from authenticated;
grant select on public.seller_store_profiles to anon, authenticated;
grant insert, update, delete on public.seller_store_profiles to authenticated;

create or replace function public.get_seller_store(p_seller_id uuid)
returns jsonb language sql stable security invoker
set search_path = public, private, pg_temp
as $$
with s as (select seller_id,store_name,logo_url,about,store_policies,return_policy,shipping_information,updated_at from public.seller_store_profiles where seller_id=p_seller_id and is_published=true),
ps as (select count(*)::int product_count from public.products where seller_id=p_seller_id and status='active'),
rs as (select count(*)::int review_count,coalesce(round(avg(r.rating)::numeric,1),0)::numeric rating from public.reviews r join public.products p on p.id=r.product_id where p.seller_id=p_seller_id),
revs as (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'rating',r.rating,'title',r.title,'body',r.body,'verified_purchase',r.verified_purchase,'created_at',r.created_at) order by r.created_at desc),'[]'::jsonb) reviews from (select r.* from public.reviews r join public.products p on p.id=r.product_id where p.seller_id=p_seller_id order by r.created_at desc limit 20) r)
select case when s.seller_id is null then null else jsonb_build_object('seller_id',s.seller_id,'store_name',s.store_name,'logo_url',s.logo_url,'about',s.about,'store_policies',s.store_policies,'return_policy',s.return_policy,'shipping_information',s.shipping_information,'product_count',ps.product_count,'followers',0,'rating',rs.rating,'review_count',rs.review_count,'reviews',revs.reviews,'updated_at',s.updated_at) end from s cross join ps cross join rs cross join revs;
$$;
grant execute on function public.get_seller_store(uuid) to anon, authenticated;