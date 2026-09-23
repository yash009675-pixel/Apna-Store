create or replace function public.admin_get_category_market_insights(
  p_start_at timestamptz default now() - interval '30 days',
  p_end_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_start timestamptz := coalesce(p_start_at, now() - interval '30 days');
  v_end timestamptz := coalesce(p_end_at, now());
  v_duration interval;
  v_prev_start timestamptz;
  v_prev_end timestamptz;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then raise exception 'Admin access required'; end if;
  if v_end <= v_start then raise exception 'Invalid analytics date range'; end if;
  if v_end - v_start > interval '366 days' then raise exception 'Analytics range cannot exceed 366 days'; end if;
  v_duration := v_end - v_start;
  v_prev_end := v_start;
  v_prev_start := v_start - v_duration;

  with category_base as (
    select c.id category_id,c.name category_name,
      count(distinct p.id) filter (where p.status='active') active_products,
      count(distinct p.seller_id) filter (where p.status='active' and p.seller_id is not null) seller_participation,
      coalesce(sum(pv.stock),0) inventory_units
    from public.categories c
    left join public.products p on p.category_id=c.id
    left join public.product_variants pv on pv.product_id=p.id
    where c.is_active=true
    group by c.id,c.name
  ),
  current_sales as (
    select p.category_id,coalesce(sum(oi.quantity),0) units_sold,
      coalesce(sum(oi.unit_price*oi.quantity),0) sales,count(distinct o.id) order_count,
      coalesce(avg(oi.unit_price),0) average_selling_price
    from public.order_items oi join public.orders o on o.id=oi.order_id
    join public.products p on p.id=oi.product_id
    where o.created_at>=v_start and o.created_at<v_end and o.status not in ('cancelled','returned')
    group by p.category_id
  ),
  previous_sales as (
    select p.category_id,coalesce(sum(oi.unit_price*oi.quantity),0) sales
    from public.order_items oi join public.orders o on o.id=oi.order_id
    join public.products p on p.id=oi.product_id
    where o.created_at>=v_prev_start and o.created_at<v_prev_end and o.status not in ('cancelled','returned')
    group by p.category_id
  ),
  views as (
    select p.category_id,count(*) product_views
    from public.analytics_events e join public.products p on p.id=e.product_id
    where e.event_name='product_view' and e.occurred_at>=v_start and e.occurred_at<v_end
    group by p.category_id
  ),
  ranked as (
    select cb.*,coalesce(cs.units_sold,0) units_sold,coalesce(cs.sales,0) sales,
      coalesce(cs.order_count,0) order_count,coalesce(cs.average_selling_price,0) average_selling_price,
      coalesce(v.product_views,0) product_views,coalesce(ps.sales,0) previous_sales
    from category_base cb left join current_sales cs on cs.category_id=cb.category_id
    left join previous_sales ps on ps.category_id=cb.category_id left join views v on v.category_id=cb.category_id
  )
  select jsonb_build_object(
    'range',jsonb_build_object('start_at',v_start,'end_at',v_end,'previous_start_at',v_prev_start,'previous_end_at',v_prev_end),
    'definitions',jsonb_build_object(
      'demand','Units sold during the selected period',
      'conversion','Category orders divided by product views; shown as a percentage',
      'competition','Active products and active sellers participating in the category',
      'inventory_demand','Units sold compared with current variant stock; sell-through is units sold / (units sold + stock)',
      'category_growth','Sales change versus the immediately preceding period of equal length',
      'seller_participation','Distinct sellers with active products in the category'
    ),
    'categories',coalesce((
      select jsonb_agg(jsonb_build_object(
        'category_id',r.category_id,'category_name',r.category_name,'sales',r.sales,
        'average_selling_price',r.average_selling_price,'demand',r.units_sold,'product_views',r.product_views,
        'conversion_rate',case when r.product_views>0 then round((r.order_count::numeric/r.product_views)*100,2) else 0 end,
        'active_products',r.active_products,'active_sellers',r.seller_participation,'inventory_units',r.inventory_units,
        'sell_through_rate',case when (r.units_sold+r.inventory_units)>0 then round((r.units_sold::numeric/(r.units_sold+r.inventory_units))*100,2) else 0 end,
        'previous_sales',r.previous_sales,
        'growth_rate',case when r.previous_sales>0 then round(((r.sales-r.previous_sales)/r.previous_sales)*100,2) else null end,
        'platform_sales_share',case when sum(r.sales) over()>0 then round((r.sales/sum(r.sales) over())*100,2) else 0 end
      ) order by r.sales desc,r.category_name) from ranked r
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.admin_get_category_market_insights(timestamptz,timestamptz) from public,anon;
grant execute on function public.admin_get_category_market_insights(timestamptz,timestamptz) to authenticated;