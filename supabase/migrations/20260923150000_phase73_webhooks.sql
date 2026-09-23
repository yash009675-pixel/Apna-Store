-- Phase 73: secure webhook outbox and delivery system
create table if not exists public.webhook_endpoints (
 id uuid primary key default gen_random_uuid(), name text not null, endpoint_url text not null check (endpoint_url ~ '^https?://'),
 event_types text[] not null default array[]::text[], active boolean not null default false, secret_ref text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references public.profiles(id) on delete set null
);
create table if not exists public.webhook_events (
 id uuid primary key default gen_random_uuid(), event_type text not null, source_table text, source_id text, payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.webhook_deliveries (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.webhook_events(id) on delete cascade,
 endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','queued','delivered','failed')),
 attempt_count integer not null default 0 check(attempt_count>=0), request_id bigint, response_status integer, response_body text,
 last_attempt_at timestamptz, delivered_at timestamptz, next_attempt_at timestamptz not null default now(), error_message text,
 created_at timestamptz not null default now(), unique(event_id,endpoint_id)
);
create index if not exists webhook_events_created_idx on public.webhook_events(created_at desc);
create index if not exists webhook_events_type_created_idx on public.webhook_events(event_type,created_at desc);
create index if not exists webhook_deliveries_pending_idx on public.webhook_deliveries(status,next_attempt_at);
create index if not exists webhook_deliveries_endpoint_idx on public.webhook_deliveries(endpoint_id,created_at desc);
alter table public.webhook_endpoints enable row level security; alter table public.webhook_events enable row level security; alter table public.webhook_deliveries enable row level security;
revoke all on table public.webhook_endpoints from anon,authenticated; revoke all on table public.webhook_events from anon,authenticated; revoke all on table public.webhook_deliveries from anon,authenticated;

create or replace function public.enqueue_webhook_event(p_event_type text,p_source_table text,p_source_id text,p_payload jsonb) returns uuid language plpgsql security definer set search_path=public,private as $$
declare v_event_id uuid; begin
 insert into public.webhook_events(event_type,source_table,source_id,payload) values(p_event_type,p_source_table,p_source_id,coalesce(p_payload,'{}'::jsonb)) returning id into v_event_id;
 insert into public.webhook_deliveries(event_id,endpoint_id) select v_event_id,e.id from public.webhook_endpoints e where e.active and (cardinality(e.event_types)=0 or p_event_type=any(e.event_types));
 return v_event_id; end; $$;

create or replace function public.orders_webhook_event() returns trigger language plpgsql security definer set search_path=public,private as $$
declare v_payload jsonb; begin
 if tg_op='INSERT' then
  v_payload=jsonb_build_object('id',new.id,'order_number',new.order_number,'status',new.status,'payment_status',new.payment_status,'delivery_status',new.delivery_status,'total',new.total,'payment_method',new.payment_method,'created_at',new.created_at,'updated_at',new.updated_at);
  perform public.enqueue_webhook_event('order.created','orders',new.id::text,v_payload);
 elsif tg_op='UPDATE' then
  v_payload=jsonb_build_object('id',new.id,'order_number',new.order_number,'status',new.status,'previous_status',old.status,'payment_status',new.payment_status,'previous_payment_status',old.payment_status,'delivery_status',new.delivery_status,'previous_delivery_status',old.delivery_status,'total',new.total,'payment_method',new.payment_method,'created_at',new.created_at,'updated_at',new.updated_at);
  perform public.enqueue_webhook_event('order.updated','orders',new.id::text,v_payload);
 end if; return new; end; $$;
drop trigger if exists orders_webhook_event_trigger on public.orders;
create trigger orders_webhook_event_trigger after insert or update on public.orders for each row execute function public.orders_webhook_event();

create or replace function public.admin_list_webhook_endpoints() returns table(id uuid,name text,endpoint_url text,event_types text[],active boolean,created_at timestamptz,updated_at timestamptz) language sql security definer set search_path=public,private as $$ select id,name,endpoint_url,event_types,active,created_at,updated_at from public.webhook_endpoints where public.is_admin_user() order by name; $$;
create or replace function public.admin_create_webhook_endpoint(p_name text,p_endpoint_url text,p_event_types text[] default array[]::text[],p_secret text default null,p_active boolean default false) returns uuid language plpgsql security definer set search_path=public,private as $$
declare v_id uuid; v_ref text; begin
 if not public.is_admin_user() then raise exception 'admin access required'; end if;
 insert into public.webhook_endpoints(name,endpoint_url,event_types,active,created_by) values(p_name,p_endpoint_url,coalesce(p_event_types,array[]::text[]),p_active,auth.uid()) returning id into v_id;
 if nullif(p_secret,'') is not null then v_ref='webhook_'||v_id::text; perform vault.create_secret(p_secret,v_ref,'Apna Store webhook signing secret'); update public.webhook_endpoints set secret_ref=v_ref where id=v_id; end if;
 perform public.record_audit_event('webhook_endpoint.created','webhook_endpoint',v_id::text,jsonb_build_object('name',p_name,'active',p_active)); return v_id; end; $$;
create or replace function public.admin_set_webhook_endpoint_active(p_id uuid,p_active boolean) returns boolean language plpgsql security definer set search_path=public,private as $$ begin
 if not public.is_admin_user() then raise exception 'admin access required'; end if; update public.webhook_endpoints set active=p_active,updated_at=now() where id=p_id; if not found then raise exception 'webhook endpoint not found'; end if;
 perform public.record_audit_event('webhook_endpoint.status_changed','webhook_endpoint',p_id::text,jsonb_build_object('active',p_active)); return true; end; $$;
create or replace function public.admin_list_webhook_deliveries(p_limit integer default 100) returns setof public.webhook_deliveries language sql security definer set search_path=public,private as $$ select d.* from public.webhook_deliveries d where public.is_admin_user() order by d.created_at desc limit greatest(1,least(coalesce(p_limit,100),500)); $$;

create or replace function public.dispatch_webhooks(p_limit integer default 25) returns integer language plpgsql security definer set search_path=public,private as $$
declare r record; v_req bigint; v_body jsonb; v_secret text; v_sig text; v_count integer:=0; begin
 for r in select d.id delivery_id,d.event_id,d.endpoint_id,e.endpoint_url,e.secret_ref,w.event_type,w.payload from public.webhook_deliveries d join public.webhook_endpoints e on e.id=d.endpoint_id join public.webhook_events w on w.id=d.event_id where d.status in('pending','failed') and d.attempt_count<5 and d.next_attempt_at<=now() and e.active order by d.created_at limit greatest(1,least(coalesce(p_limit,25),100)) for update of d skip locked loop
  v_body=jsonb_build_object('id',r.event_id,'type',r.event_type,'created_at',now(),'data',r.payload); v_secret=null;
  if r.secret_ref is not null then select decrypted_secret into v_secret from vault.decrypted_secrets where name=r.secret_ref limit 1; end if;
  v_sig=case when v_secret is null then null else encode(hmac(convert_to(v_body::text,'utf8'),convert_to(v_secret,'utf8'),'sha256'),'hex') end;
  v_req=net.http_post(url:=r.endpoint_url,body:=v_body,headers:=jsonb_build_object('Content-Type','application/json','X-Apna-Event',r.event_type)||case when v_sig is null then '{}'::jsonb else jsonb_build_object('X-Apna-Signature','sha256='||v_sig) end,timeout_milliseconds:=5000);
  update public.webhook_deliveries set status='queued',request_id=v_req,attempt_count=attempt_count+1,last_attempt_at=now(),next_attempt_at=now()+interval '10 minutes',error_message=null where id=r.delivery_id; v_count=v_count+1;
 end loop; return v_count; end; $$;

create or replace function public.reconcile_webhook_deliveries() returns integer language plpgsql security definer set search_path=public,private as $$
declare r record; v_status text; v_count integer:=0; begin
 for r in select d.id,d.request_id from public.webhook_deliveries d where d.status='queued' and d.request_id is not null and d.last_attempt_at>=now()-interval '6 hours' and exists(select 1 from net._http_response x where x.id=d.request_id) order by d.last_attempt_at limit 100 for update of d skip locked loop
  select case when status_code between 200 and 299 then 'delivered' else 'failed' end into v_status from net._http_response where id=r.request_id;
  update public.webhook_deliveries d set status=v_status,response_status=(select status_code from net._http_response where id=r.request_id),response_body=left((select content from net._http_response where id=r.request_id),4000),delivered_at=case when v_status='delivered' then now() else null end,error_message=case when v_status='failed' then coalesce((select error_msg from net._http_response where id=r.request_id),'webhook returned non-2xx') else null end,next_attempt_at=case when v_status='failed' and d.attempt_count<5 then now()+make_interval(mins,greatest(5,least(60,5*(2^(d.attempt_count-1))))) else d.next_attempt_at end where d.id=r.id; v_count=v_count+1;
 end loop; return v_count; end; $$;

revoke execute on function public.enqueue_webhook_event(text,text,text,jsonb) from public,anon,authenticated; grant execute on function public.enqueue_webhook_event(text,text,text,jsonb) to postgres;
revoke execute on function public.orders_webhook_event() from public,anon,authenticated; grant execute on function public.orders_webhook_event() to postgres;
revoke execute on function public.dispatch_webhooks(integer) from public,anon,authenticated; grant execute on function public.dispatch_webhooks(integer) to postgres;
revoke execute on function public.reconcile_webhook_deliveries() from public,anon,authenticated; grant execute on function public.reconcile_webhook_deliveries() to postgres;
revoke execute on function public.admin_list_webhook_endpoints() from public,anon,authenticated; grant execute on function public.admin_list_webhook_endpoints() to authenticated;
revoke execute on function public.admin_create_webhook_endpoint(text,text,text[],text,boolean) from public,anon,authenticated; grant execute on function public.admin_create_webhook_endpoint(text,text,text[],text,boolean) to authenticated;
revoke execute on function public.admin_set_webhook_endpoint_active(uuid,boolean) from public,anon,authenticated; grant execute on function public.admin_set_webhook_endpoint_active(uuid,boolean) to authenticated;
revoke execute on function public.admin_list_webhook_deliveries(integer) from public,anon,authenticated; grant execute on function public.admin_list_webhook_deliveries(integer) to authenticated;
do $$ begin perform cron.unschedule('apna-webhook-dispatch'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('apna-webhook-reconcile'); exception when others then null; end $$;
select cron.schedule('apna-webhook-dispatch','*/5 * * * *',$$select public.dispatch_webhooks(25);$$);
select cron.schedule('apna-webhook-reconcile','*/5 * * * *',$$select public.reconcile_webhook_deliveries();$$);