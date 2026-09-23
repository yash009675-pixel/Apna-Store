-- Phase 69: feature flags with environment controls and deterministic rollout.
create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag_key text not null unique,
  description text,
  enabled boolean not null default false,
  environment text not null default 'production' check (environment in ('production','staging','development')),
  rollout_percent numeric(5,2) not null default 0 check (rollout_percent >= 0 and rollout_percent <= 100),
  client_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);
alter table public.feature_flags enable row level security;
revoke all on table public.feature_flags from anon, authenticated;
create policy feature_flags_client_read on public.feature_flags for select to anon, authenticated using (client_visible = true);
grant select on public.feature_flags to anon, authenticated;

create or replace function public.is_admin_user()
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

create or replace function public.admin_list_feature_flags()
returns setof public.feature_flags language sql stable security definer set search_path = public, pg_temp as $$
  select * from public.feature_flags where public.is_admin_user() order by flag_key;
$$;

create or replace function public.admin_save_feature_flag(
  p_flag_id uuid, p_flag_key text, p_description text, p_enabled boolean,
  p_environment text, p_rollout_percent numeric, p_client_visible boolean
)
returns public.feature_flags language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.feature_flags;
begin
  if not public.is_admin_user() then raise exception 'Admin access required'; end if;
  if p_flag_key is null or p_flag_key !~ '^[a-z][a-z0-9_.-]{1,79}$' then raise exception 'Invalid flag key'; end if;
  if p_environment not in ('production','staging','development') then raise exception 'Invalid environment'; end if;
  if p_rollout_percent < 0 or p_rollout_percent > 100 then raise exception 'Invalid rollout percentage'; end if;
  if p_flag_id is null then
    insert into public.feature_flags(flag_key,description,enabled,environment,rollout_percent,client_visible,created_by)
    values(lower(trim(p_flag_key)),nullif(trim(p_description),''),coalesce(p_enabled,false),p_environment,p_rollout_percent,coalesce(p_client_visible,false),(select auth.uid()))
    returning * into v_row;
  else
    update public.feature_flags set flag_key=lower(trim(p_flag_key)),description=nullif(trim(p_description),''),enabled=coalesce(p_enabled,false),
      environment=p_environment,rollout_percent=p_rollout_percent,client_visible=coalesce(p_client_visible,false),updated_at=now()
      where id=p_flag_id returning * into v_row;
    if v_row.id is null then raise exception 'Feature flag not found'; end if;
  end if;
  return v_row;
end;
$$;

create or replace function public.admin_delete_feature_flag(p_flag_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin_user() then raise exception 'Admin access required'; end if;
  delete from public.feature_flags where id=p_flag_id;
  return found;
end;
$$;

create or replace function public.get_feature_flag(
  p_flag_key text, p_environment text default 'production', p_subject_key text default null
)
returns boolean language plpgsql stable security invoker set search_path = public, pg_temp as $
declare v_flag public.feature_flags; v_bucket bigint;
begin
  if p_environment not in ('production','staging','development') then return false; end if;
  select * into v_flag from public.feature_flags
    where flag_key=lower(trim(p_flag_key)) and environment=p_environment and client_visible=true limit 1;
  if not found or not v_flag.enabled then return false; end if;
  if v_flag.rollout_percent >= 100 then return true; end if;
  if v_flag.rollout_percent <= 0 or coalesce(trim(p_subject_key),'') = '' then return false; end if;
  v_bucket := hashtextextended(v_flag.flag_key || ':' || trim(p_subject_key), 0) & 9223372036854775807;
  return v_bucket < round(v_flag.rollout_percent * 100);
end;
$$;

revoke execute on function public.is_admin_user() from public, anon, authenticated;
revoke execute on function public.admin_list_feature_flags() from public, anon, authenticated;
revoke execute on function public.admin_save_feature_flag(uuid,text,text,boolean,text,numeric,boolean) from public, anon, authenticated;
revoke execute on function public.admin_delete_feature_flag(uuid) from public, anon, authenticated;
revoke execute on function public.get_feature_flag(text,text,text) from public, anon, authenticated;
grant execute on function public.is_admin_user() to authenticated;
grant execute on function public.admin_list_feature_flags() to authenticated;
grant execute on function public.admin_save_feature_flag(uuid,text,text,boolean,text,numeric,boolean) to authenticated;
grant execute on function public.admin_delete_feature_flag(uuid) to authenticated;
grant execute on function public.get_feature_flag(text,text,text) to anon, authenticated;
