create table if not exists public.api_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key_prefix text not null unique,
  key_hash text not null unique,
  scopes text[] not null default array['catalog:read'],
  rate_limit_per_minute integer not null default 60 check(rate_limit_per_minute between 1 and 10000),
  active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index if not exists api_clients_active_idx on public.api_clients(active);
alter table public.api_clients enable row level security;
revoke all on public.api_clients from anon, authenticated;

create or replace function public.admin_create_api_client(p_name text,p_scopes text[] default array['catalog:read'],p_rate_limit integer default 60)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_key text; v_id uuid; v_prefix text;
begin
 if not public.is_admin_user() then raise exception 'admin only'; end if;
 v_key := 'aps_' || encode(gen_random_bytes(24),'hex'); v_prefix := left(v_key,12);
 insert into public.api_clients(name,key_prefix,key_hash,scopes,rate_limit_per_minute,created_by)
 values(trim(p_name),v_prefix,encode(digest(v_key,'sha256'),'hex'),p_scopes,p_rate_limit,auth.uid()) returning id into v_id;
 perform public.record_audit_event('api_client.created','api_client',v_id::text,jsonb_build_object('name',trim(p_name),'key_prefix',v_prefix));
 return jsonb_build_object('id',v_id,'name',trim(p_name),'api_key',v_key,'key_prefix',v_prefix,'scopes',p_scopes,'rate_limit_per_minute',p_rate_limit);
end; $$;

create or replace function public.admin_list_api_clients()
returns table(id uuid,name text,key_prefix text,scopes text[],rate_limit_per_minute integer,active boolean,last_used_at timestamptz,created_at timestamptz)
language sql security definer set search_path=public as $$
 select a.id,a.name,a.key_prefix,a.scopes,a.rate_limit_per_minute,a.active,a.last_used_at,a.created_at from public.api_clients a
 where public.is_admin_user() order by a.created_at desc;
$$;

create or replace function public.admin_set_api_client_active(p_id uuid,p_active boolean)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin_user() then raise exception 'admin only'; end if;
 update public.api_clients set active=p_active where id=p_id;
 perform public.record_audit_event('api_client.status_changed','api_client',p_id::text,jsonb_build_object('active',p_active));
 return found;
end; $$;

revoke all on function public.admin_create_api_client(text,text[],integer) from public,anon,authenticated;
grant execute on function public.admin_create_api_client(text,text[],integer) to authenticated;
revoke all on function public.admin_list_api_clients() from public,anon,authenticated;
grant execute on function public.admin_list_api_clients() to authenticated;
revoke all on function public.admin_set_api_client_active(uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_set_api_client_active(uuid,boolean) to authenticated;