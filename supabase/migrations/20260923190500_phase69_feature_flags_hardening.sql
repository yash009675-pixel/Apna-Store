-- Phase 69 hardening: expose only client-visible flags through RLS and keep evaluation invoker-safe.
drop policy if exists feature_flags_client_read on public.feature_flags;
create policy feature_flags_client_read on public.feature_flags for select to anon, authenticated using (client_visible = true);
grant select on public.feature_flags to anon, authenticated;

create or replace function public.get_feature_flag(
  p_flag_key text, p_environment text default 'production', p_subject_key text default null
)
returns boolean language plpgsql stable security invoker set search_path = public, pg_temp as $$
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
