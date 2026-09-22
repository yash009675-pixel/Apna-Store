-- Phase 17: Search Trends
create table public.search_events (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null,
 search_term text not null,
 result_count integer not null default 0 check(result_count between 0 and 1000),
 matched_product_ids uuid[] not null default '{}'::uuid[],
 occurred_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 constraint search_events_term_check check(char_length(search_term) between 1 and 100),
 constraint search_events_matches_check check(coalesce(array_length(matched_product_ids,1),0)<=20)
);
alter table public.search_events enable row level security;
create policy search_events_public_insert on public.search_events for insert to anon,authenticated
with check(char_length(search_term) between 1 and 100 and result_count between 0 and 1000 and coalesce(array_length(matched_product_ids,1),0)<=20 and not exists(select 1 from unnest(matched_product_ids) mp(id) left join products p on p.id=mp.id and p.status='active' where p.id is null));
revoke all on public.search_events from anon,authenticated;
grant insert on public.search_events to anon,authenticated;
create index search_events_time_idx on public.search_events(occurred_at desc);
create index search_events_term_time_idx on public.search_events(search_term,occurred_at desc);

create or replace function public.seller_search_trends(p_start_at timestamptz default now()-interval '30 days',p_end_at timestamptz default now())
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare u uuid:=auth.uid(); r text; s timestamptz:=coalesce(p_start_at,now()-interval '30 days'); e timestamptz:=coalesce(p_end_at,now()); ps timestamptz;
begin
 if u is null then raise exception 'Authentication required'; end if;
 select role into r from profiles where id=u;
 if r not in('seller','admin') then raise exception 'Seller access required'; end if;
 if e<=s then raise exception 'Invalid search trend date range'; end if;
 if e-s>interval '366 days' then raise exception 'Search trend range cannot exceed 366 days'; end if;
 ps:=s-(e-s);
 return jsonb_build_object(
  'range',jsonb_build_object('start_at',s,'end_at',e,'previous_start_at',ps,'previous_end_at',s),
  'popular_searches',(select coalesce(jsonb_agg(jsonb_build_object('term',q.search_term,'searches',q.searches,'visitors',q.visitors,'avg_results',round(q.avg_results,1)) order by q.searches desc,q.search_term),'[]'::jsonb) from (select search_term,count(*) searches,count(distinct session_id) visitors,avg(result_count)::numeric avg_results from search_events where occurred_at>=s and occurred_at<e group by search_term order by count(*) desc,search_term limit 20) q),
  'rising_searches',(select coalesce(jsonb_agg(jsonb_build_object('term',q.search_term,'searches',q.searches,'previous_searches',q.previous_searches,'change_percent',round(q.change_percent,1)) order by q.delta desc,q.searches desc),'[]'::jsonb) from (select c.search_term,c.searches,coalesce(p.searches,0) previous_searches,c.searches-coalesce(p.searches,0) delta,case when coalesce(p.searches,0)>0 then (c.searches-p.searches)::numeric*100/p.searches else 100 end change_percent from (select search_term,count(*) searches from search_events where occurred_at>=s and occurred_at<e group by search_term)c left join(select search_term,count(*) searches from search_events where occurred_at>=ps and occurred_at<s group by search_term)p on p.search_term=c.search_term where c.searches>coalesce(p.searches,0) order by delta desc,c.searches desc limit 20) q),
  'zero_result_searches',(select coalesce(jsonb_agg(jsonb_build_object('term',q.search_term,'searches',q.searches,'visitors',q.visitors) order by q.searches desc,q.search_term),'[]'::jsonb) from (select search_term,count(*) searches,count(distinct session_id) visitors from search_events where occurred_at>=s and occurred_at<e and result_count=0 group by search_term order by count(*) desc,search_term limit 20) q),
  'product_demand',(select coalesce(jsonb_agg(jsonb_build_object('product_id',q.product_id,'product_name',q.product_name,'searches',q.searches) order by q.searches desc,q.product_name),'[]'::jsonb) from (select p.id product_id,p.name product_name,count(*) searches from search_events se cross join lateral unnest(se.matched_product_ids) mp(product_id) join products p on p.id=mp.product_id and p.status='active' where se.occurred_at>=s and se.occurred_at<e and (r='admin' or p.seller_id=u) group by p.id,p.name order by count(*) desc,p.name limit 20) q),
  'category_demand',(select coalesce(jsonb_agg(jsonb_build_object('category_id',q.category_id,'category_name',q.category_name,'searches',q.searches) order by q.searches desc,q.category_name),'[]'::jsonb) from (select p.category_id,coalesce(c.name,'Uncategorized') category_name,count(*) searches from search_events se cross join lateral unnest(se.matched_product_ids) mp(product_id) join products p on p.id=mp.product_id and p.status='active' left join categories c on c.id=p.category_id where se.occurred_at>=s and se.occurred_at<e and (r='admin' or p.seller_id=u) group by p.category_id,c.name order by count(*) desc,c.name limit 20) q),
  'keyword_trends',(select coalesce(jsonb_agg(jsonb_build_object('term',q.search_term,'current_searches',q.current_searches,'previous_searches',q.previous_searches,'delta',q.delta) order by q.current_searches desc,q.search_term),'[]'::jsonb) from (select c.search_term,c.searches current_searches,coalesce(p.searches,0) previous_searches,c.searches-coalesce(p.searches,0) delta from (select search_term,count(*) searches from search_events where occurred_at>=s and occurred_at<e group by search_term)c left join(select search_term,count(*) searches from search_events where occurred_at>=ps and occurred_at<s group by search_term)p on p.search_term=c.search_term order by c.searches desc,c.search_term limit 30) q)
 );
end;
$$;
revoke all on function public.seller_search_trends(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.seller_search_trends(timestamptz,timestamptz) to authenticated;
