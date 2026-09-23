create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  display_name text not null,
  category text not null check (category in ('payments','shipping','email','ai','auth','analytics','webhooks','other')),
  status text not null default 'planned' check (status in ('planned','configured','active','disabled','error')),
  enabled boolean not null default false,
  docs_url text,
  edge_function_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists integration_connections_status_idx on public.integration_connections(status, enabled);

alter table public.integration_connections enable row level security;
revoke all on public.integration_connections from anon, authenticated;

create or replace function public.admin_list_integrations()
returns setof public.integration_connections
language sql security definer set search_path = public
as $$ select * from public.integration_connections where public.is_admin_user() order by category, display_name; $$;

create or replace function public.admin_set_integration(
  p_provider_key text, p_display_name text, p_category text,
  p_status text default 'planned', p_enabled boolean default false,
  p_docs_url text default null, p_edge_function_name text default null, p_notes text default null
)
returns public.integration_connections
language plpgsql security definer set search_path = public
as $$
declare v_row public.integration_connections;
begin
  if not public.is_admin_user() then raise exception 'admin only'; end if;
  insert into public.integration_connections(provider_key,display_name,category,status,enabled,docs_url,edge_function_name,notes,created_by)
  values (lower(trim(p_provider_key)),trim(p_display_name),p_category,p_status,p_enabled,p_docs_url,p_edge_function_name,p_notes,auth.uid())
  on conflict (provider_key) do update set display_name=excluded.display_name, category=excluded.category,
    status=excluded.status, enabled=excluded.enabled, docs_url=excluded.docs_url,
    edge_function_name=excluded.edge_function_name, notes=excluded.notes, updated_at=now()
  returning * into v_row;
  perform public.record_audit_event('integration.updated','integration_connection',v_row.id::text,
    jsonb_build_object('provider_key',v_row.provider_key,'status',v_row.status,'enabled',v_row.enabled));
  return v_row;
end;
$$;

revoke all on function public.admin_list_integrations() from public, anon, authenticated;
grant execute on function public.admin_list_integrations() to authenticated;
revoke all on function public.admin_set_integration(text,text,text,text,boolean,text,text,text) from public, anon, authenticated;
grant execute on function public.admin_set_integration(text,text,text,text,boolean,text,text,text) to authenticated;

insert into public.integration_connections(provider_key,display_name,category,status,enabled,edge_function_name,notes) values
('shiprocket','Shiprocket','shipping','configured',false,'apna-courier-create','Credentials remain server-side; inactive by default.'),
('resend','Resend','email','configured',true,null,'Secret remains server-side.'),
('openai','OpenAI','ai','configured',true,'apna-ai-assistant','API key remains server-side.'),
('google-oauth','Google OAuth','auth','configured',true,null,'OAuth credentials remain in Auth provider configuration.'),
('webhooks','Apna Store Webhooks','webhooks','active',true,null,'Phase 73 outbox; individual endpoints remain admin-controlled.')
on conflict (provider_key) do nothing;