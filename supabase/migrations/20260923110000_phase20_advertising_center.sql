-- Phase 20: Advertising Center
create table if not exists public.ad_campaigns (
 id uuid primary key default gen_random_uuid(), seller_id uuid not null references public.profiles(id) on delete cascade,
 name text not null, status text not null default 'draft' check (status in ('draft','active','paused','completed')),
 daily_budget numeric(12,2) not null check (daily_budget > 0), total_budget numeric(12,2) not null check (total_budget >= daily_budget),
 starts_at timestamptz not null, ends_at timestamptz not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (ends_at > starts_at)
);
create table if not exists public.ad_campaign_products (campaign_id uuid not null references public.ad_campaigns(id) on delete cascade, product_id uuid not null references public.products(id) on delete cascade, primary key(campaign_id,product_id));
create table if not exists public.ad_campaign_categories (campaign_id uuid not null references public.ad_campaigns(id) on delete cascade, category_id uuid not null references public.categories(id) on delete cascade, primary key(campaign_id,category_id));
create table if not exists public.ad_campaign_keywords (campaign_id uuid not null references public.ad_campaigns(id) on delete cascade, keyword text not null check(char_length(btrim(keyword)) between 2 and 80), primary key(campaign_id,keyword));
create table if not exists public.ad_events (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.ad_campaigns(id) on delete cascade, event_type text not null check(event_type in('impression','click')), product_id uuid references public.products(id) on delete set null, session_id text, created_at timestamptz not null default now());
create table if not exists public.ad_spend_entries (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.ad_campaigns(id) on delete cascade, amount numeric(12,2) not null check(amount>0), source text not null, reference text, created_at timestamptz not null default now());
alter table public.ad_campaigns enable row level security;
alter table public.ad_campaign_products enable row level security;
alter table public.ad_campaign_categories enable row level security;
alter table public.ad_campaign_keywords enable row level security;
alter table public.ad_events enable row level security;
alter table public.ad_spend_entries enable row level security;
create index if not exists idx_ad_campaigns_seller_status on public.ad_campaigns(seller_id,status,starts_at,ends_at);
create index if not exists idx_ad_events_campaign_type_created on public.ad_events(campaign_id,event_type,created_at);
create index if not exists idx_ad_spend_campaign_created on public.ad_spend_entries(campaign_id,created_at);

-- Privileged RPCs are the only write/read surface for campaign management.
-- Public catalog functions intentionally expose only active sponsored products and validated ad events.


create or replace function public.seller_list_ad_campaigns()
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_role text; v_result jsonb;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 select role into v_role from public.profiles where id=v_uid;
 if v_role not in ('seller','admin') then raise exception 'Seller access required'; end if;
 select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc),'[]'::jsonb) into v_result
 from (select c.id,c.name,c.status,c.daily_budget,c.total_budget,c.starts_at,c.ends_at,c.created_at,
 (select count(*) from public.ad_events e where e.campaign_id=c.id and e.event_type='impression') impressions,
 (select count(*) from public.ad_events e where e.campaign_id=c.id and e.event_type='click') clicks,
 coalesce((select sum(s.amount) from public.ad_spend_entries s where s.campaign_id=c.id),0) spend,
 0::bigint orders,null::numeric roas,
 coalesce((select jsonb_agg(ap.product_id) from public.ad_campaign_products ap where ap.campaign_id=c.id),'[]'::jsonb) product_ids,
 coalesce((select jsonb_agg(ac.category_id) from public.ad_campaign_categories ac where ac.campaign_id=c.id),'[]'::jsonb) category_ids,
 coalesce((select jsonb_agg(ak.keyword) from public.ad_campaign_keywords ak where ak.campaign_id=c.id),'[]'::jsonb) keywords
 from public.ad_campaigns c where v_role='admin' or c.seller_id=v_uid) x;
 return v_result;
end $$;

create or replace function public.seller_save_ad_campaign(p_campaign_id uuid,p_name text,p_daily_budget numeric,p_total_budget numeric,p_starts_at timestamptz,p_ends_at timestamptz,p_status text,p_product_ids uuid[] default '{}',p_category_ids uuid[] default '{}',p_keywords text[] default '{}')
returns uuid language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_role text; v_id uuid; v_owner uuid;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 select role into v_role from public.profiles where id=v_uid;
 if v_role not in ('seller','admin') then raise exception 'Seller access required'; end if;
 if char_length(btrim(coalesce(p_name,''))) not between 2 and 120 then raise exception 'Campaign name must be 2 to 120 characters'; end if;
 if p_daily_budget is null or p_daily_budget<=0 then raise exception 'Daily budget must be greater than zero'; end if;
 if p_total_budget is null or p_total_budget<p_daily_budget then raise exception 'Total budget must be at least the daily budget'; end if;
 if p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at then raise exception 'End time must be after start time'; end if;
 if p_status not in ('draft','active','paused') then raise exception 'Invalid campaign status'; end if;
 if coalesce(array_length(p_product_ids,1),0)+coalesce(array_length(p_category_ids,1),0)+coalesce(array_length(p_keywords,1),0)=0 then raise exception 'Add at least one product, category, or keyword target'; end if;
 if v_role='seller' and exists(select 1 from unnest(coalesce(p_product_ids,'{}')) pid where not exists(select 1 from public.products p where p.id=pid and p.seller_id=v_uid)) then raise exception 'You can only advertise your own products'; end if;
 if p_campaign_id is null then
   insert into public.ad_campaigns(seller_id,name,daily_budget,total_budget,starts_at,ends_at,status) values(v_uid,btrim(p_name),p_daily_budget,p_total_budget,p_starts_at,p_ends_at,p_status) returning id into v_id;
 else
   select seller_id into v_owner from public.ad_campaigns where id=p_campaign_id;
   if v_owner is null or (v_role<>'admin' and v_owner<>v_uid) then raise exception 'Campaign not found or not authorized'; end if;
   update public.ad_campaigns set name=btrim(p_name),daily_budget=p_daily_budget,total_budget=p_total_budget,starts_at=p_starts_at,ends_at=p_ends_at,status=p_status,updated_at=now() where id=p_campaign_id returning id into v_id;
 end if;
 delete from public.ad_campaign_products where campaign_id=v_id;
 delete from public.ad_campaign_categories where campaign_id=v_id;
 delete from public.ad_campaign_keywords where campaign_id=v_id;
 insert into public.ad_campaign_products select v_id,x from unnest(coalesce(p_product_ids,'{}')) x on conflict do nothing;
 insert into public.ad_campaign_categories select v_id,x from unnest(coalesce(p_category_ids,'{}')) x on conflict do nothing;
 insert into public.ad_campaign_keywords select v_id,btrim(x) from unnest(coalesce(p_keywords,'{}')) x where char_length(btrim(x)) between 2 and 80 on conflict do nothing;
 return v_id;
end $$;

create or replace function public.seller_delete_ad_campaign(p_campaign_id uuid)
returns boolean language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_role text;
begin
 select role into v_role from public.profiles where id=v_uid;
 if v_uid is null or v_role not in ('seller','admin') then raise exception 'Seller access required'; end if;
 delete from public.ad_campaigns where id=p_campaign_id and (seller_id=v_uid or v_role='admin');
 return found;
end $$;

create or replace function public.public_get_sponsored_products(p_query text default '',p_category_id uuid default null,p_limit integer default 4)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_result jsonb;
begin
 select coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb) into v_result from (
 select p.id,p.name,p.slug,p.price,p.category_id,c.name category,cpn.id campaign_id
 from public.products p join public.categories c on c.id=p.category_id join public.ad_campaigns cpn on cpn.status='active' and now() between cpn.starts_at and cpn.ends_at
 where p.status='active' and (exists(select 1 from public.ad_campaign_products ap where ap.campaign_id=cpn.id and ap.product_id=p.id) or exists(select 1 from public.ad_campaign_categories ac where ac.campaign_id=cpn.id and ac.category_id=p.category_id) or (nullif(btrim(p_query),'') is not null and exists(select 1 from public.ad_campaign_keywords ak where ak.campaign_id=cpn.id and lower(p_query) like '%'||lower(ak.keyword)||'%')))
 order by cpn.created_at desc,p.created_at desc limit greatest(1,least(coalesce(p_limit,4),12))) x;
 return v_result;
end $$;

create or replace function public.public_track_ad_event(p_campaign_id uuid,p_event_type text,p_product_id uuid default null,p_session_id text default null)
returns uuid language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_id uuid;
begin
 if p_event_type not in ('impression','click') then raise exception 'Invalid ad event'; end if;
 if not exists(select 1 from public.ad_campaigns where id=p_campaign_id and status='active' and now() between starts_at and ends_at) then return null; end if;
 insert into public.ad_events(campaign_id,event_type,product_id,session_id) values(p_campaign_id,p_event_type,p_product_id,left(coalesce(p_session_id,''),120)) returning id into v_id;
 return v_id;
end $$;

revoke all on function public.seller_list_ad_campaigns() from public,anon; grant execute on function public.seller_list_ad_campaigns() to authenticated;
revoke all on function public.seller_save_ad_campaign(uuid,text,numeric,numeric,timestamptz,timestamptz,text,uuid[],uuid[],text[]) from public,anon; grant execute on function public.seller_save_ad_campaign(uuid,text,numeric,numeric,timestamptz,timestamptz,text,uuid[],uuid[],text[]) to authenticated;
revoke all on function public.seller_delete_ad_campaign(uuid) from public,anon; grant execute on function public.seller_delete_ad_campaign(uuid) to authenticated;
revoke all on function public.public_get_sponsored_products(text,uuid,integer) from public,anon; grant execute on function public.public_get_sponsored_products(text,uuid,integer) to anon,authenticated;
revoke all on function public.public_track_ad_event(uuid,text,uuid,text) from public; grant execute on function public.public_track_ad_event(uuid,text,uuid,text) to anon,authenticated;
