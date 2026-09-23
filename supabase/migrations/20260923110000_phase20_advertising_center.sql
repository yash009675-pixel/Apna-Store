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
