-- Phase 16: Seller Growth / Insights
create table if not exists public.analytics_events (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null,
 event_name text not null check (event_name in ('product_view','page_view')),
 product_id uuid references public.products(id) on delete set null,
 path text,
 occurred_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
alter table public.analytics_events enable row level security;
drop policy if exists analytics_events_public_insert on public.analytics_events;
create policy analytics_events_public_insert on public.analytics_events
for insert to anon,authenticated
with check (
 char_length(coalesce(path,'')) <= 500 and
 ((event_name='page_view' and product_id is null) or
  (event_name='product_view' and product_id is not null and exists(select 1 from public.products p where p.id=analytics_events.product_id and p.status='active')))
);
revoke all on public.analytics_events from anon,authenticated;
grant insert on public.analytics_events to anon,authenticated;
create index if not exists analytics_events_product_time_idx on public.analytics_events(product_id,occurred_at desc) where product_id is not null;
create index if not exists analytics_events_event_time_idx on public.analytics_events(event_name,occurred_at desc);
create index if not exists analytics_events_session_time_idx on public.analytics_events(session_id,occurred_at desc);

create or replace function public.seller_growth_insights(
 p_start_at timestamptz default now()-interval '30 days',
 p_end_at timestamptz default now(),
 p_granularity text default 'day'
) returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $fn$
declare
 u uuid:=auth.uid(); r text; s timestamptz:=coalesce(p_start_at,now()-interval '30 days'); e timestamptz:=coalesce(p_end_at,now());
 ps timestamptz; pe timestamptz; g text:=lower(coalesce(p_granularity,'day')); cur jsonb; prev jsonb; ser jsonb; prod jsonb; ins jsonb:='[]'::jsonb;
begin
 if u is null then raise exception 'Authentication required'; end if;
 select role into r from public.profiles where id=u;
 if r not in ('seller','admin') then raise exception 'Seller access required'; end if;
 if e<=s then raise exception 'Invalid analytics date range'; end if;
 if e-s>interval '366 days' then raise exception 'Analytics range cannot exceed 366 days'; end if;
 if g not in ('hour','day','week','month','year') then raise exception 'Invalid analytics granularity'; end if;
 if g='hour' and e-s>interval '31 days' then raise exception 'Hourly analytics range cannot exceed 31 days'; end if;
 ps:=s-(e-s); pe:=s;

 with sp as(select id from products where r='admin' or seller_id=u),
 oi as(select oi.* from order_items oi join orders o on o.id=oi.order_id join sp on sp.id=oi.product_id where o.created_at>=s and o.created_at<e and o.status not in('cancelled','returned')),
 ev as(select a.* from analytics_events a join sp on sp.id=a.product_id where a.event_name='product_view' and a.occurred_at>=s and a.occurred_at<e)
 select jsonb_build_object('orders',count(distinct oi.order_id),'units',coalesce(sum(oi.quantity),0),'revenue',coalesce(sum(oi.unit_price*oi.quantity),0),'views',(select count(*) from ev),'visitors',(select count(distinct session_id) from ev),'conversion_rate',round(case when (select count(distinct session_id) from ev)>0 then count(distinct oi.order_id)::numeric*100/(select count(distinct session_id) from ev) else 0 end,2),'average_order_value',round(case when count(distinct oi.order_id)>0 then coalesce(sum(oi.unit_price*oi.quantity),0)/count(distinct oi.order_id) else 0 end,2)) into cur from oi;

 with sp as(select id from products where r='admin' or seller_id=u),
 oi as(select oi.* from order_items oi join orders o on o.id=oi.order_id join sp on sp.id=oi.product_id where o.created_at>=ps and o.created_at<pe and o.status not in('cancelled','returned')),
 ev as(select a.* from analytics_events a join sp on sp.id=a.product_id where a.event_name='product_view' and a.occurred_at>=ps and a.occurred_at<pe)
 select jsonb_build_object('orders',count(distinct oi.order_id),'units',coalesce(sum(oi.quantity),0),'revenue',coalesce(sum(oi.unit_price*oi.quantity),0),'views',(select count(*) from ev),'visitors',(select count(distinct session_id) from ev),'conversion_rate',round(case when (select count(distinct session_id) from ev)>0 then count(distinct oi.order_id)::numeric*100/(select count(distinct session_id) from ev) else 0 end,2),'average_order_value',round(case when count(distinct oi.order_id)>0 then coalesce(sum(oi.unit_price*oi.quantity),0)/count(distinct oi.order_id) else 0 end,2)) into prev from oi;

 with sp as(select id from products where r='admin' or seller_id=u),
 b as(select generate_series(date_trunc(g,s),date_trunc(g,e-interval '1 microsecond'),('1 '||g)::interval) bucket),
 oi as(select date_trunc(g,o.created_at) bucket,oi.* from order_items oi join orders o on o.id=oi.order_id join sp on sp.id=oi.product_id where o.created_at>=s and o.created_at<e and o.status not in('cancelled','returned')),
 ev as(select date_trunc(g,a.occurred_at) bucket,a.session_id from analytics_events a join sp on sp.id=a.product_id where a.event_name='product_view' and a.occurred_at>=s and a.occurred_at<e),
 x as(select b.bucket,coalesce((select count(distinct oi.order_id) from oi where oi.bucket=b.bucket),0) orders,coalesce((select sum(oi.quantity) from oi where oi.bucket=b.bucket),0) units,coalesce((select sum(oi.unit_price*oi.quantity) from oi where oi.bucket=b.bucket),0) revenue,coalesce((select count(*) from ev where ev.bucket=b.bucket),0) views,coalesce((select count(distinct ev.session_id) from ev where ev.bucket=b.bucket),0) visitors from b)
 select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket,'orders',orders,'units',units,'revenue',revenue,'views',views,'visitors',visitors,'conversion_rate',round(case when visitors>0 then orders::numeric*100/visitors else 0 end,2)) order by bucket),'[]'::jsonb) into ser from x;

 with sp as(select id,name from products where r='admin' or seller_id=u),
 v as(select a.product_id,count(*) views,count(distinct a.session_id) visitors from analytics_events a join sp on sp.id=a.product_id where a.event_name='product_view' and a.occurred_at>=s and a.occurred_at<e group by a.product_id),
 q as(select oi.product_id,count(distinct oi.order_id) orders,sum(oi.quantity) units,sum(oi.unit_price*oi.quantity) revenue from order_items oi join orders o on o.id=oi.order_id join sp on sp.id=oi.product_id where o.created_at>=s and o.created_at<e and o.status not in('cancelled','returned') group by oi.product_id)
 select coalesce(jsonb_agg(jsonb_build_object('product_id',sp.id,'product_name',sp.name,'views',coalesce(v.views,0),'visitors',coalesce(v.visitors,0),'orders',coalesce(q.orders,0),'units',coalesce(q.units,0),'revenue',coalesce(q.revenue,0),'conversion_rate',round(case when coalesce(v.visitors,0)>0 then coalesce(q.orders,0)::numeric*100/v.visitors else 0 end,2)) order by coalesce(q.revenue,0) desc,coalesce(v.views,0) desc) filter(where v.views is not null or q.orders is not null),'[]'::jsonb) into prod from sp left join v on v.product_id=sp.id left join q on q.product_id=sp.id;

 if (cur->>'views')::numeric=0 then ins:=ins||jsonb_build_array('No product-view data is available for this period yet.'); end if;
 if (cur->>'orders')::numeric>0 then ins:=ins||jsonb_build_array('Real order data shows '||(cur->>'orders')||' order(s) in the selected period.'); end if;
 if (cur->>'conversion_rate')::numeric>(prev->>'conversion_rate')::numeric then ins:=ins||jsonb_build_array('Conversion rate is higher than the previous comparison period.'); elsif (cur->>'conversion_rate')::numeric<(prev->>'conversion_rate')::numeric then ins:=ins||jsonb_build_array('Conversion rate is lower than the previous comparison period.'); end if;
 return jsonb_build_object('range',jsonb_build_object('start_at',s,'end_at',e,'previous_start_at',ps,'previous_end_at',pe,'granularity',g),'current',cur,'previous',prev,'series',ser,'products',prod,'insights',ins);
end
$fn$;
revoke all on function public.seller_growth_insights(timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.seller_growth_insights(timestamptz,timestamptz,text) to authenticated;
