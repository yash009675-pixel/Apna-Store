create table if not exists public.trust_safety_cases (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid references public.profiles(id) on delete set null,
 case_type text not null check (case_type in ('report','fraud','abuse','counterfeit','safety')),
 subject_type text not null check (subject_type in ('product','order','review','profile','seller','other')),
 subject_id text,
 description text not null check (char_length(description) between 1 and 4000),
 status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
 priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 resolved_at timestamptz
);
alter table public.trust_safety_cases enable row level security;
revoke all on table public.trust_safety_cases from anon, authenticated;
create index if not exists trust_safety_cases_status_idx on public.trust_safety_cases(status,priority,created_at desc);
create index if not exists trust_safety_cases_reporter_idx on public.trust_safety_cases(reporter_id,created_at desc);
create or replace function public.create_trust_safety_case(p_case_type text,p_subject_type text,p_subject_id text,p_description text,p_priority text default 'normal')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_case_type not in ('report','fraud','abuse','counterfeit','safety') then raise exception 'Invalid case type'; end if;
 if p_subject_type not in ('product','order','review','profile','seller','other') then raise exception 'Invalid subject type'; end if;
 if p_priority not in ('low','normal','high','urgent') then raise exception 'Invalid priority'; end if;
 insert into public.trust_safety_cases(reporter_id,case_type,subject_type,subject_id,description,priority) values(auth.uid(),p_case_type,p_subject_type,left(coalesce(p_subject_id,''),200),left(p_description,4000),p_priority) returning id into v_id;
 perform public.record_audit_event('trust_safety_case.created','trust_safety_case',v_id::text,jsonb_build_object('case_type',p_case_type,'priority',p_priority));
 return v_id;
end $$;
revoke all on function public.create_trust_safety_case(text,text,text,text,text) from public,anon;
grant execute on function public.create_trust_safety_case(text,text,text,text,text) to authenticated;
create or replace function public.admin_list_trust_safety_cases(p_limit integer default 100)
returns table(id uuid,reporter_id uuid,case_type text,subject_type text,subject_id text,description text,status text,priority text,created_at timestamptz,updated_at timestamptz,resolved_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin_user() then raise exception 'Admin access required'; end if;
 return query select c.id,c.reporter_id,c.case_type,c.subject_type,c.subject_id,c.description,c.status,c.priority,c.created_at,c.updated_at,c.resolved_at from public.trust_safety_cases c order by case when c.priority='urgent' then 1 when c.priority='high' then 2 when c.priority='normal' then 3 else 4 end,c.created_at desc limit greatest(1,least(coalesce(p_limit,100),500));
end $$;
revoke all on function public.admin_list_trust_safety_cases(integer) from public,anon,authenticated;
grant execute on function public.admin_list_trust_safety_cases(integer) to authenticated;
create or replace function public.admin_update_trust_safety_case(p_id uuid,p_status text,p_priority text default null)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin_user() then raise exception 'Admin access required'; end if;
 if p_status not in ('open','reviewing','resolved','dismissed') then raise exception 'Invalid status'; end if;
 if p_priority is not null and p_priority not in ('low','normal','high','urgent') then raise exception 'Invalid priority'; end if;
 update public.trust_safety_cases set status=p_status,priority=coalesce(p_priority,priority),updated_at=now(),resolved_at=case when p_status='resolved' then now() else resolved_at end where id=p_id;
 if not found then raise exception 'Trust & safety case not found'; end if;
 perform public.record_audit_event('trust_safety_case.status_changed','trust_safety_case',p_id::text,jsonb_build_object('status',p_status,'priority',p_priority));
 return true;
end $$;
revoke all on function public.admin_update_trust_safety_case(uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_update_trust_safety_case(uuid,text,text) to authenticated;