-- Phase 26 — Partner Services
create table if not exists public.partner_services (
  id uuid primary key default gen_random_uuid(),
  service_type text not null check (service_type in ('Cataloging','Product Photography','Image Editing','Tax / GST Assistance','Accounting','Advertising Assistance','Warehousing','Packaging','Logistics','Seller Training','Sourcing','Software Services')),
  provider_name text not null check (length(trim(provider_name)) between 2 and 160),
  description text not null default '' check (length(description) <= 1200),
  website_url text,
  coverage_area text not null default '' check (length(coverage_area) <= 240),
  verification_source text,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_services_website_url_chk check (website_url is null or website_url ~* '^https?://[^[:space:]]+$')
);
create index if not exists idx_partner_services_public on public.partner_services(service_type, is_active, verified_at, sort_order);
create index if not exists idx_partner_services_provider on public.partner_services(lower(provider_name));
alter table public.partner_services enable row level security;
drop policy if exists partner_services_admin_select on public.partner_services;
drop policy if exists partner_services_admin_insert on public.partner_services;
drop policy if exists partner_services_admin_update on public.partner_services;
drop policy if exists partner_services_admin_delete on public.partner_services;
create policy partner_services_admin_select on public.partner_services for select to authenticated using (private.is_admin());
create policy partner_services_admin_insert on public.partner_services for insert to authenticated with check (private.is_admin());
create policy partner_services_admin_update on public.partner_services for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy partner_services_admin_delete on public.partner_services for delete to authenticated using (private.is_admin());
create or replace function public.get_partner_services(p_service_type text default null)
returns table (id uuid, service_type text, provider_name text, description text, website_url text, coverage_area text)
language sql stable security definer set search_path = public, private, pg_temp
as $$ select ps.id, ps.service_type, ps.provider_name, ps.description, ps.website_url, ps.coverage_area from public.partner_services ps where ps.is_active=true and ps.verified_at is not null and (p_service_type is null or ps.service_type=p_service_type) order by ps.sort_order, ps.provider_name; $$;
revoke all on function public.get_partner_services(text) from public, anon, authenticated;
grant execute on function public.get_partner_services(text) to anon, authenticated;
create or replace function public.partner_service_verify(p_id uuid,p_verified boolean,p_verification_source text default null)
returns public.partner_services language plpgsql security definer set search_path = public, private, pg_temp
as $$ declare v_row public.partner_services; begin if not private.is_admin() then raise exception 'Admin access required'; end if; update public.partner_services set verified_at=case when p_verified then now() else null end, verification_source=nullif(trim(p_verification_source),''), verified_by=case when p_verified then auth.uid() else null end, is_active=case when p_verified then is_active else false end, updated_at=now() where id=p_id returning * into v_row; if not found then raise exception 'Partner service not found'; end if; return v_row; end; $$;
revoke all on function public.partner_service_verify(uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.partner_service_verify(uuid,boolean,text) to authenticated;