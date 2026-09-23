-- Phase 24 Support Ticket System
create sequence if not exists public.support_ticket_number_seq;
create table if not exists public.support_tickets(
 id uuid primary key default gen_random_uuid(), ticket_number bigint not null default nextval('public.support_ticket_number_seq'), ticket_code text not null unique,
 requester_id uuid not null references public.profiles(id) on delete cascade, requester_role text not null check(requester_role in('customer','seller')),
 category text not null check(category in('order','payment','delivery','return','refund','account','product','listing','inventory','payout','courier','ads','other')),
 priority text not null default 'normal' check(priority in('low','normal','high','urgent')), order_id uuid references public.orders(id) on delete set null, shipment_id uuid references public.shipments(id) on delete set null,
 subject text not null check(char_length(btrim(subject)) between 3 and 160), status text not null default 'open' check(status in('open','ai_handling','waiting_for_user','assigned','in_progress','resolved','closed')),
 ai_summary text, assigned_agent_id uuid references public.profiles(id) on delete set null, resolution text, sla_due_at timestamptz not null,
 escalated boolean not null default false, escalated_at timestamptz, resolved_at timestamptz, closed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.support_ticket_messages(
 id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade, sender_role text not null check(sender_role in('customer','seller','admin')),
 body text not null check(char_length(btrim(body)) between 1 and 10000), is_internal boolean not null default false, created_at timestamptz not null default now());
create table if not exists public.support_ticket_attachments(
 id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 uploaded_by uuid not null references public.profiles(id) on delete cascade, storage_path text not null unique,
 file_name text not null check(char_length(btrim(file_name)) between 1 and 180), content_type text not null check(char_length(btrim(content_type)) between 1 and 120),
 file_size bigint not null check(file_size>0 and file_size<=10485760), created_at timestamptz not null default now());
create or replace function public.support_ticket_before_write() returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
declare h int; begin
 if tg_op='INSERT' then
  if not exists(select 1 from public.profiles p where p.id=new.requester_id and p.role=new.requester_role) then raise exception 'Invalid requester'; end if;
  new.ticket_code:='AST-'||lpad(new.ticket_number::text,8,'0'); h:=case new.priority when 'urgent' then 4 when 'high' then 8 when 'normal' then 24 else 48 end;
  new.sla_due_at:=coalesce(new.sla_due_at,now()+make_interval(hours=>h));
 elsif new.priority is distinct from old.priority then
  h:=case new.priority when 'urgent' then 4 when 'high' then 8 when 'normal' then 24 else 48 end; if old.status not in('resolved','closed') then new.sla_due_at:=now()+make_interval(hours=>h); end if;
 end if;
 new.updated_at:=now(); if new.status='resolved' and old.status is distinct from 'resolved' then new.resolved_at:=coalesce(new.resolved_at,now()); end if;
 if new.status='closed' and old.status is distinct from 'closed' then new.closed_at:=coalesce(new.closed_at,now()); end if; return new; end $$;
drop trigger if exists trg_support_ticket_before_write on public.support_tickets;
create trigger trg_support_ticket_before_write before insert or update on public.support_tickets for each row execute function public.support_ticket_before_write();
create index if not exists idx_support_tickets_requester_created on public.support_tickets(requester_id,created_at desc);
create index if not exists idx_support_tickets_status_sla on public.support_tickets(status,sla_due_at);
create index if not exists idx_support_tickets_assigned on public.support_tickets(assigned_agent_id,status);
create index if not exists idx_support_tickets_order on public.support_tickets(order_id);
create index if not exists idx_support_tickets_shipment on public.support_tickets(shipment_id);
create index if not exists idx_support_ticket_messages_ticket_created on public.support_ticket_messages(ticket_id,created_at);
create index if not exists idx_support_ticket_attachments_ticket on public.support_ticket_attachments(ticket_id);
alter table public.support_tickets enable row level security; alter table public.support_ticket_messages enable row level security; alter table public.support_ticket_attachments enable row level security;
drop policy if exists support_tickets_select_owner_admin on public.support_tickets;
create policy support_tickets_select_owner_admin on public.support_tickets for select to authenticated using(requester_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
drop policy if exists support_tickets_insert_owner on public.support_tickets;
create policy support_tickets_insert_owner on public.support_tickets for insert to authenticated with check(
 requester_id=(select auth.uid()) and requester_role in('customer','seller') and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role=requester_role)
 and (order_id is null or exists(select 1 from public.orders o where o.id=order_id and ((requester_role='customer' and o.user_id=(select auth.uid())) or (requester_role='seller' and exists(select 1 from public.order_items oi join public.products pr on pr.id=oi.product_id where oi.order_id=o.id and pr.seller_id=(select auth.uid()))))))
 and (shipment_id is null or exists(select 1 from public.shipments s where s.id=shipment_id and ((requester_role='customer' and exists(select 1 from public.orders o where o.id=s.order_id and o.user_id=(select auth.uid()))) or (requester_role='seller' and s.seller_id=(select auth.uid())))))
);
drop policy if exists support_tickets_update_admin on public.support_tickets;
create policy support_tickets_update_admin on public.support_tickets for update to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')) with check(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
drop policy if exists support_ticket_messages_select on public.support_ticket_messages;
create policy support_ticket_messages_select on public.support_ticket_messages for select to authenticated using(exists(select 1 from public.support_tickets t where t.id=ticket_id and (t.requester_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'))) and(not is_internal or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')));
drop policy if exists support_ticket_messages_insert on public.support_ticket_messages;
create policy support_ticket_messages_insert on public.support_ticket_messages for insert to authenticated with check(sender_id=(select auth.uid()) and ((sender_role='admin' and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')) or(sender_role in('customer','seller') and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role=sender_role) and exists(select 1 from public.support_tickets t where t.id=ticket_id and t.requester_id=(select auth.uid()) and t.status not in('closed')))) and exists(select 1 from public.support_tickets t where t.id=ticket_id and t.status not in('closed')));
drop policy if exists support_ticket_attachments_select on public.support_ticket_attachments;
create policy support_ticket_attachments_select on public.support_ticket_attachments for select to authenticated using(exists(select 1 from public.support_tickets t where t.id=ticket_id and(t.requester_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'))));
drop policy if exists support_ticket_attachments_insert on public.support_ticket_attachments;
create policy support_ticket_attachments_insert on public.support_ticket_attachments for insert to authenticated with check(uploaded_by=(select auth.uid()) and exists(select 1 from public.support_tickets t where t.id=ticket_id and t.requester_id=(select auth.uid()) and t.status not in('closed')));
create or replace function public.support_set_ai_summary(p_ticket_id uuid,p_summary text) returns public.support_tickets language plpgsql security definer set search_path=public,private,pg_temp as $$
declare r public.support_tickets; begin
 if not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and(p.role='admin' or p.id=(select requester_id from public.support_tickets where id=p_ticket_id))) then raise exception 'Not authorized'; end if;
 update public.support_tickets set ai_summary=nullif(btrim(p_summary),''),status=case when status='open' then 'ai_handling' else status end,updated_at=now() where id=p_ticket_id returning * into r;
 if not found then raise exception 'Ticket not found'; end if; return r; end $$;
revoke all on function public.support_set_ai_summary(uuid,text) from public,anon; grant execute on function public.support_set_ai_summary(uuid,text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('support-attachments','support-attachments',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf','text/plain']) on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists support_storage_select on storage.objects;
create policy support_storage_select on storage.objects for select to authenticated using(bucket_id='support-attachments' and exists(select 1 from public.support_ticket_attachments a join public.support_tickets t on t.id=a.ticket_id where a.storage_path=name and(t.requester_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'))));
drop policy if exists support_storage_insert on storage.objects;
create policy support_storage_insert on storage.objects for insert to authenticated with check(bucket_id='support-attachments' and(storage.foldername(name))[1]='tickets' and exists(select 1 from public.support_tickets t where t.id::text=(storage.foldername(name))[2] and t.requester_id=(select auth.uid()) and t.status not in('closed')));
drop policy if exists support_storage_delete on storage.objects;
create policy support_storage_delete on storage.objects for delete to authenticated using(bucket_id='support-attachments' and exists(select 1 from public.support_ticket_attachments a join public.support_tickets t on t.id=a.ticket_id where a.storage_path=name and(a.uploaded_by=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'))));