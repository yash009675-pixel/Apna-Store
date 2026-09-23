create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  job_key text not null unique,
  job_name text not null,
  schedule text not null,
  handler_type text not null,
  enabled boolean not null default true,
  max_retries integer not null default 1 check (max_retries between 0 and 5),
  timeout_seconds integer not null default 600 check (timeout_seconds between 1 and 3600),
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_status text check (last_status is null or last_status in ('running','succeeded','failed')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.background_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.background_jobs(id) on delete cascade,
  status text not null check (status in ('running','succeeded','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  result jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists background_job_runs_job_started_idx
  on public.background_job_runs (job_id, started_at desc);
create index if not exists background_job_runs_status_started_idx
  on public.background_job_runs (status, started_at desc);

alter table public.background_jobs enable row level security;
alter table public.background_job_runs enable row level security;
revoke all on table public.background_jobs from anon, authenticated;
revoke all on table public.background_job_runs from anon, authenticated;

create or replace function public.run_background_job(p_job_key text)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_job public.background_jobs%rowtype;
  v_run_id uuid;
  v_started timestamptz := clock_timestamp();
  v_result jsonb := '{}'::jsonb;
  v_value integer;
begin
  select * into v_job
  from public.background_jobs
  where job_key = p_job_key
  for update;

  if not found then
    raise exception 'background job not found: %', p_job_key;
  end if;

  if not v_job.enabled then
    return jsonb_build_object('status','skipped','job_key',p_job_key,'reason','disabled');
  end if;

  insert into public.background_job_runs(job_id,status,started_at)
  values (v_job.id,'running',v_started)
  returning id into v_run_id;

  update public.background_jobs
  set last_started_at=v_started,last_status='running',last_error=null,updated_at=now()
  where id=v_job.id;

  begin
    case p_job_key
      when 'apna-rewards-birthday-daily' then
        v_value := public.process_birthday_rewards();
        v_result := jsonb_build_object('awarded',coalesce(v_value,0));
      else
        raise exception 'no handler registered for background job: %', p_job_key;
    end case;

    update public.background_job_runs
    set status='succeeded',finished_at=clock_timestamp(),
        duration_ms=extract(epoch from (clock_timestamp()-v_started))*1000,
        result=v_result
    where id=v_run_id;

    update public.background_jobs
    set last_finished_at=clock_timestamp(),last_status='succeeded',last_error=null,updated_at=now()
    where id=v_job.id;

    return jsonb_build_object('status','succeeded','job_key',p_job_key,'run_id',v_run_id,'result',v_result);
  exception when others then
    update public.background_job_runs
    set status='failed',finished_at=clock_timestamp(),
        duration_ms=extract(epoch from (clock_timestamp()-v_started))*1000,
        error_message=left(sqlerrm,2000)
    where id=v_run_id;

    update public.background_jobs
    set last_finished_at=clock_timestamp(),last_status='failed',last_error=left(sqlerrm,2000),updated_at=now()
    where id=v_job.id;

    raise;
  end;
end;
$$;

create or replace function public.admin_list_background_jobs()
returns table (
  id uuid, job_key text, job_name text, schedule text, handler_type text,
  enabled boolean, max_retries integer, timeout_seconds integer,
  last_started_at timestamptz, last_finished_at timestamptz,
  last_status text, last_error text, updated_at timestamptz
)
language sql
security definer
set search_path = public, private
as $$
  select b.id,b.job_key,b.job_name,b.schedule,b.handler_type,b.enabled,
         b.max_retries,b.timeout_seconds,b.last_started_at,b.last_finished_at,
         b.last_status,b.last_error,b.updated_at
  from public.background_jobs b
  where public.is_admin_user()
  order by b.job_name;
$$;

create or replace function public.admin_list_background_job_runs(p_limit integer default 100)
returns setof public.background_job_runs
language sql
security definer
set search_path = public, private
as $$
  select r.*
  from public.background_job_runs r
  where public.is_admin_user()
  order by r.started_at desc
  limit greatest(1,least(coalesce(p_limit,100),500));
$$;

create or replace function public.admin_background_jobs_summary()
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_total integer;
  v_enabled integer;
  v_failed_24h integer;
  v_last_run timestamptz;
begin
  if not public.is_admin_user() then raise exception 'admin access required'; end if;
  select count(*),count(*) filter (where enabled) into v_total,v_enabled from public.background_jobs;
  select count(*) into v_failed_24h
  from public.background_job_runs
  where status='failed' and started_at >= now()-interval '24 hours';
  select max(started_at) into v_last_run from public.background_job_runs;
  return jsonb_build_object(
    'generated_at',now(),
    'total_jobs',v_total,
    'enabled_jobs',v_enabled,
    'failed_runs_24h',v_failed_24h,
    'last_run_at',v_last_run
  );
end;
$$;

revoke execute on function public.run_background_job(text) from public, anon, authenticated;
grant execute on function public.run_background_job(text) to postgres;

revoke execute on function public.admin_list_background_jobs() from public, anon, authenticated;
grant execute on function public.admin_list_background_jobs() to authenticated;

revoke execute on function public.admin_list_background_job_runs(integer) from public, anon, authenticated;
grant execute on function public.admin_list_background_job_runs(integer) to authenticated;

revoke execute on function public.admin_background_jobs_summary() from public, anon, authenticated;
grant execute on function public.admin_background_jobs_summary() to authenticated;

insert into public.background_jobs
  (job_key,job_name,schedule,handler_type,max_retries,timeout_seconds)
values
  ('apna-rewards-birthday-daily','Birthday reward processing','10 0 * * *','database_function',1,600)
on conflict (job_key) do update set
  job_name=excluded.job_name,
  schedule=excluded.schedule,
  handler_type=excluded.handler_type,
  updated_at=now();

do $$
begin
  perform cron.unschedule('apna-rewards-birthday-daily');
exception when others then
  null;
end $$;

select cron.schedule(
  'apna-rewards-birthday-daily',
  '10 0 * * *',
  $$select public.run_background_job('apna-rewards-birthday-daily');$$
);
