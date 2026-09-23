-- Phase 21: Help Center
create table if not exists public.help_articles(
 id uuid primary key default gen_random_uuid(), audience text not null check(audience in('customer','seller')), category text not null,
 title text not null, body text not null, is_published boolean not null default true, sort_order integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.help_articles enable row level security;
create index if not exists idx_help_articles_audience_category_order on public.help_articles(audience,category,is_published,sort_order);
