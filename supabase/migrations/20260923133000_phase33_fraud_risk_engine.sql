-- Phase 33: Fraud / Risk Engine
-- Evidence-based risk flags for admin review. A flag is not a finding of wrongdoing.

begin;

create table if not exists public.risk_flags (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  risk_type text not null check (risk_type in ('suspicious_order','cod_cancellation_spike','abnormal_return_rate','review_anomaly','seller_behavior','coupon_abuse','account_abuse','payment_anomaly')),
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','reviewed','dismissed','confirmed')),
  user_id uuid references public.profiles(id) on delete set null,
  seller_id uuid references public.profiles(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  entity_id uuid,
  reason text not null,
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.risk_flags enable row level security;
revoke all on public.risk_flags from anon,authenticated;
grant select,update on public.risk_flags to authenticated;

drop policy if exists risk_flags_admin_read on public.risk_flags;
create policy risk_flags_admin_read on public.risk_flags
  for select to authenticated using ((select private.is_admin()));

drop policy if exists risk_flags_admin_update on public.risk_flags;
create policy risk_flags_admin_update on public.risk_flags
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create index if not exists risk_flags_status_created_idx on public.risk_flags(status,created_at desc);
create index if not exists risk_flags_user_idx on public.risk_flags(user_id,status);
create index if not exists risk_flags_seller_idx on public.risk_flags(seller_id,status);
create index if not exists risk_flags_order_idx on public.risk_flags(order_id);
create index if not exists risk_flags_type_idx on public.risk_flags(risk_type,status);

create or replace function public.admin_refresh_risk_flags()
returns integer
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_count integer:=0;
begin
  if not private.is_admin() then raise exception 'Admin access required'; end if;

  with candidates as (
    select 'cod_cancellation_spike' risk_type,'high' severity,o.user_id,null::uuid seller_id,null::uuid order_id,o.user_id entity_id,
      'Repeated COD cancellation/RTO activity in the last 30 days' reason,jsonb_build_object('count',count(*),'window_days',30) evidence
    from public.orders o
    where o.payment_method='cod' and lower(coalesce(o.status,'')) in ('cancelled','rto','returned') and o.created_at>=now()-interval '30 days'
    group by o.user_id having count(*)>=3
    union all
    select 'abnormal_return_rate','high',o.user_id,null,null,o.user_id,
      'Return-request rate is at least 50% across at least 4 orders in the last 90 days',
      jsonb_build_object('orders',count(distinct o.id),'returns',count(distinct r.id),'return_rate',round(count(distinct r.id)::numeric/nullif(count(distinct o.id),0),3))
    from public.orders o left join public.return_requests r on r.order_id=o.id
    where o.created_at>=now()-interval '90 days'
    group by o.user_id
    having count(distinct o.id)>=4 and count(distinct r.id)::numeric/nullif(count(distinct o.id),0)>=0.5
    union all
    select 'coupon_abuse','high',cu.user_id,c.seller_id,null,cu.coupon_id,
      'Coupon usage exceeded the coupon''s configured per-user limit',
      jsonb_build_object('coupon_id',cu.coupon_id,'usage_count',count(*),'per_user_limit',max(coalesce(c.per_user_limit,1)))
    from public.coupon_usages cu join public.coupons c on c.id=cu.coupon_id
    where cu.created_at>=now()-interval '90 days'
    group by cu.user_id,cu.coupon_id,c.seller_id
    having count(*)>max(coalesce(c.per_user_limit,1))
    union all
    select 'payment_anomaly','high',pt.user_id,null,null,pt.user_id,
      'Multiple failed payment transactions for the same account in the last 24 hours',
      jsonb_build_object('failed_count',count(*),'window_hours',24)
    from public.payment_transactions pt
    where lower(coalesce(pt.status,'')) in ('failed','failure') and pt.created_at>=now()-interval '24 hours'
    group by pt.user_id having count(*)>=3
    union all
    select 'payment_anomaly','high',pt.user_id,null,pt.order_id,pt.id,
      'Successful payment amount does not match the order total',
      jsonb_build_object('payment_amount',pt.amount,'order_total',o.total,'currency',pt.currency)
    from public.payment_transactions pt join public.orders o on o.id=pt.order_id
    where lower(coalesce(pt.status,'')) in ('success','succeeded','paid')
      and pt.amount is not null and o.total is not null and abs(pt.amount-o.total)>0.01
    union all
    select 'review_anomaly','medium',r.user_id,null,null,r.user_id,
      'Multiple reviews were created within a 30-minute window; admin review is required and this is not treated as proof of fake reviews',
      jsonb_build_object('review_count',count(*),'window_minutes',30)
    from public.reviews r
    where r.created_at>=now()-interval '90 days'
    group by r.user_id,date_trunc('minute',r.created_at)-make_interval(mins=>extract(minute from r.created_at)::int%30)
    having count(*)>=3
    union all
    select 'review_anomaly','medium',r.user_id,null,null,r.user_id,
      'The same review body appears across multiple products; admin review is required',
      jsonb_build_object('duplicate_body_count',count(*),'products',count(distinct r.product_id))
    from public.reviews r
    where nullif(btrim(r.body),'') is not null and r.created_at>=now()-interval '90 days'
    group by r.user_id,lower(btrim(r.body))
    having count(distinct r.product_id)>=2
    union all
    select 'seller_behavior','medium',null,p.seller_id,null,p.seller_id,
      'Seller has at least 3 rejected listings in the last 30 days',
      jsonb_build_object('rejected_listings',count(*),'window_days',30)
    from public.products p
    where p.seller_id is not null and p.status='rejected' and p.updated_at>=now()-interval '30 days'
    group by p.seller_id having count(*)>=3
    union all
    select 'seller_behavior','high',null,p.seller_id,null,p.seller_id,
      'Seller return-request rate is at least 50% across at least 5 delivered orders in the last 90 days',
      jsonb_build_object('delivered_orders',count(distinct o.id),'returns',count(distinct r.id),'return_rate',round(count(distinct r.id)::numeric/nullif(count(distinct o.id),0),3))
    from public.products p
    join public.order_items oi on oi.product_id=p.id
    join public.orders o on o.id=oi.order_id
    left join public.return_requests r on r.order_item_id=oi.id
    where p.seller_id is not null and lower(coalesce(o.delivery_status,''))='delivered' and o.delivered_at>=now()-interval '90 days'
    group by p.seller_id
    having count(distinct o.id)>=5 and count(distinct r.id)::numeric/nullif(count(distinct o.id),0)>=0.5
    union all
    select 'account_abuse','high',o.user_id,null,null,o.user_id,
      'At least 10 orders were created by the same account in the last 24 hours',
      jsonb_build_object('orders',count(*),'window_hours',24)
    from public.orders o
    where o.created_at>=now()-interval '24 hours'
    group by o.user_id having count(*)>=10
    union all
    select 'suspicious_order','medium',o.user_id,null,o.id,o.id,
      'Order value is more than 5x the account''s average order value over the previous 90 days',
      jsonb_build_object('order_total',o.total,'historical_average',h.avg_total,'multiplier',round((o.total/nullif(h.avg_total,0))::numeric,2))
    from public.orders o
    join lateral (
      select avg(o2.total) avg_total,count(*) order_count
      from public.orders o2
      where o2.user_id=o.user_id and o2.id<>o.id and o2.created_at>=now()-interval '90 days'
    ) h on h.order_count>=3
    where o.created_at>=now()-interval '24 hours' and o.total>0 and h.avg_total>0 and o.total>=greatest(10000::numeric,h.avg_total*5)
  )
  insert into public.risk_flags(fingerprint,risk_type,severity,user_id,seller_id,order_id,entity_id,reason,evidence,last_seen_at,updated_at)
  select encode(digest(c.risk_type||':'||coalesce(c.user_id::text,c.seller_id::text,c.order_id::text,c.entity_id::text),'hex'),'hex'),
    c.risk_type,c.severity,c.user_id,c.seller_id,c.order_id,c.entity_id,c.reason,c.evidence,now(),now()
  from candidates c
  on conflict(fingerprint) do update
    set last_seen_at=now(),updated_at=now(),evidence=excluded.evidence,severity=excluded.severity,reason=excluded.reason
    where public.risk_flags.status in ('open','reviewed');

  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_refresh_risk_flags() from public,anon,authenticated;
grant execute on function public.admin_refresh_risk_flags() to authenticated;

create or replace function public.admin_list_risk_flags(p_status text default 'open')
returns table(id uuid,risk_type text,severity text,status text,user_id uuid,seller_id uuid,order_id uuid,reason text,evidence jsonb,first_seen_at timestamptz,last_seen_at timestamptz,reviewed_by uuid,reviewed_at timestamptz,resolution_note text)
language sql security definer
set search_path=public,private,pg_temp
as $$
  select r.id,r.risk_type,r.severity,r.status,r.user_id,r.seller_id,r.order_id,r.reason,r.evidence,r.first_seen_at,r.last_seen_at,r.reviewed_by,r.reviewed_at,r.resolution_note
  from public.risk_flags r
  where private.is_admin() and (p_status is null or r.status=p_status)
  order by case r.severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,r.last_seen_at desc
  limit 200;
$$;
revoke all on function public.admin_list_risk_flags(text) from public,anon;
grant execute on function public.admin_list_risk_flags(text) to authenticated;

create or replace function public.admin_update_risk_flag(p_id uuid,p_status text,p_resolution_note text default null)
returns public.risk_flags
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_row public.risk_flags;
begin
  if not private.is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('open','reviewed','dismissed','confirmed') then raise exception 'Invalid risk status'; end if;
  update public.risk_flags
  set status=p_status,resolution_note=nullif(btrim(coalesce(p_resolution_note,'')),''),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
  where id=p_id
  returning * into v_row;
  if not found then raise exception 'Risk flag not found'; end if;
  return v_row;
end;
$$;
revoke all on function public.admin_update_risk_flag(uuid,text,text) from public,anon;
grant execute on function public.admin_update_risk_flag(uuid,text,text) to authenticated;

commit;