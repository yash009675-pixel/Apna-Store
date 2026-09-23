create table if not exists public.recovery_checkpoints (
  id uuid primary key default gen_random_uuid(),
  checkpoint_type text not null check (checkpoint_type in ('schema','database_dump','storage','edge_functions','configuration','restore_test')),
  label text not null,
  migration_version text,
  source text not null default 'manual' check (source in ('manual','automated','supabase')),
  status text not null default 'planned' check (status in ('planned','available','verified','failed')),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create index if not exists recovery_checkpoints_type_status_idx on public.recovery_checkpoints (checkpoint_type, status);
create index if not exists recovery_checkpoints_verified_at_idx on public.recovery_checkpoints (verified_at desc nulls last);
alter table public.recovery_checkpoints enable row level security;
revoke all on table public.recovery_checkpoints from anon, authenticated;

create or replace function public.admin_list_recovery_checkpoints() returns setof public.recovery_checkpoints language sql security definer set search_path = public, private as $$
  select * from public.recovery_checkpoints where public.is_admin_user() order by created_at desc;
$$;

create or replace function public.admin_save_recovery_checkpoint(p_checkpoint_type text,p_label text,p_migration_version text default null,p_source text default 'manual',p_status text default 'planned',p_verified_at timestamptz default null,p_notes text default null) returns uuid language plpgsql security definer set search_path = public, private as $$
declare v_id uuid;
begin
  if not public.is_admin_user() then raise exception 'admin access required'; end if;
  insert into public.recovery_checkpoints (checkpoint_type,label,migration_version,source,status,verified_at,notes,created_by) values (p_checkpoint_type,p_label,p_migration_version,p_source,p_status,p_verified_at,p_notes,auth.uid()) returning id into v_id;
  perform public.record_audit_event('recovery_checkpoint.created','recovery_checkpoint',v_id::text,jsonb_build_object('checkpoint_type',p_checkpoint_type,'status',p_status));
  return v_id;
end;
$$;

create or replace function public.admin_recovery_readiness() returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_latest_migration text; v_tables integer; v_functions integer; v_buckets integer; v_last_verified timestamptz;
begin
  if not public.is_admin_user() then raise exception 'admin access required'; end if;
  select max(version) into v_latest_migration from supabase_migrations.schema_migrations;
  select count(*) into v_tables from information_schema.tables where table_schema='public';
  select count(*) into v_functions from pg_proc where pronamespace='public'::regnamespace;
  select count(*) into v_buckets from storage.buckets;
  select max(verified_at) into v_last_verified from public.recovery_checkpoints where status='verified';
  return jsonb_build_object('generated_at',now(),'automated_database_backups_available',false,'point_in_time_recovery_available',false,'logical_backup_required',true,'storage_objects_require_separate_backup',true,'latest_migration_version',coalesce(v_latest_migration,''),'public_table_count',v_tables,'public_function_count',v_functions,'storage_bucket_count',v_buckets,'last_verified_checkpoint_at',v_last_verified,'recovery_checklist',jsonb_build_array('Create and retain an off-site logical database dump','Back up Storage objects separately from database metadata','Retain Edge Function source/configuration with the repository','Document Auth/provider/webhook configuration without storing secrets','Reconcile migration history before a restore','Perform a restore test in an isolated project before production recovery'));
end;
$$;

revoke execute on function public.admin_list_recovery_checkpoints() from public,anon,authenticated;
grant execute on function public.admin_list_recovery_checkpoints() to authenticated;
revoke execute on function public.admin_save_recovery_checkpoint(text,text,text,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.admin_save_recovery_checkpoint(text,text,text,text,text,timestamptz,text) to authenticated;
revoke execute on function public.admin_recovery_readiness() from public,anon,authenticated;
grant execute on function public.admin_recovery_readiness() to authenticated;

insert into public.recovery_checkpoints (checkpoint_type,label,migration_version,source,status,notes)
select 'schema','Current production schema baseline',max(version),'supabase','available','Phase 71 baseline metadata; not a database dump.'
from supabase_migrations.schema_migrations
where not exists (select 1 from public.recovery_checkpoints where checkpoint_type='schema');
