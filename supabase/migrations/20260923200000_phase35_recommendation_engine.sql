-- Phase 35 Recommendation Engine
-- Database implementation for real, non-fabricated recommendation signals.
create or replace function public.get_recommendation_feed(p_product_id uuid default null)
returns jsonb language sql stable security definer
set search_path = public, private, pg_temp
as $$
with active as (select p.id,p.name,p.slug,p.price,p.compare_at_price,p.category_id,p.seller_id,p.created_at from public.products p where p.status='active'),
sim as (select p.*,row_number() over(order by p.created_at desc) rn from active p where p.id is distinct from p_product_id and p.category_id=(select category_id from active where id=p_product_id)),
same_seller as (select p.*,row_number() over(order by p.created_at desc) rn from active p where p.id is distinct from p_product_id and p.seller_id=(select seller_id from active where id=p_product_id)),
trending_counts as (select a.product_id,count(*) score from public.analytics_events a where a.event_name='product_view' and a.occurred_at>=now()-interval '30 days' group by a.product_id),
trending as (select p.*,tc.score,row_number() over(order by tc.score desc,p.created_at desc) rn from active p join trending_counts tc on tc.product_id=p.id where p.id is distinct from p_product_id),
fbt_counts as (select oi2.product_id,sum(oi2.quantity) score from public.order_items oi1 join public.order_items oi2 on oi2.order_id=oi1.order_id and oi2.product_id<>oi1.product_id join public.orders o on o.id=oi1.order_id where oi1.product_id=p_product_id and o.status not in ('cancelled','returned','refunded') group by oi2.product_id),
fbt as (select p.*,fc.score,row_number() over(order by fc.score desc,p.created_at desc) rn from active p join fbt_counts fc on fc.product_id=p.id),
personal_counts as (
 select oi.product_id,3::numeric weight from public.order_items oi join public.orders o on o.id=oi.order_id where o.user_id=auth.uid() and o.status not in ('cancelled','returned','refunded')
 union all select w.product_id,1::numeric from public.wishlists w where w.user_id=auth.uid()
),
personal as (select p.*,pc.score,row_number() over(order by pc.score desc,p.created_at desc) rn from active p join (select product_id,sum(weight) score from personal_counts group by product_id) pc on pc.product_id=p.id where p.id is distinct from p_product_id)
select jsonb_build_object(
'similar_products',coalesce((select jsonb_agg(to_jsonb(q)-'rn') from (select * from sim where rn<=8) q),'[]'::jsonb),
'same_seller',coalesce((select jsonb_agg(to_jsonb(q)-'rn'-'score') from (select * from same_seller where rn<=8) q),'[]'::jsonb),
'trending',coalesce((select jsonb_agg(to_jsonb(q)-'rn'-'score') from (select * from trending where rn<=8) q),'[]'::jsonb),
'frequently_bought_together',coalesce((select jsonb_agg(to_jsonb(q)-'rn'-'score') from (select * from fbt where rn<=8) q),'[]'::jsonb),
'recommended_for_you',case when auth.uid() is null then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(q)-'rn'-'score') from (select * from personal where rn<=8) q),'[]'::jsonb) end);
$$;
revoke all on function public.get_recommendation_feed(uuid) from public;
grant execute on function public.get_recommendation_feed(uuid) to anon, authenticated;
create index if not exists analytics_events_product_view_recent_idx on public.analytics_events(product_id, occurred_at desc) where event_name='product_view';
create index if not exists order_items_order_product_idx on public.order_items(order_id, product_id);
create index if not exists wishlists_user_product_idx on public.wishlists(user_id, product_id);