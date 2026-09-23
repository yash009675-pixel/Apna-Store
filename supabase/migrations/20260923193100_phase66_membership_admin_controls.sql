create or replace function public.get_admin_membership_plans()
returns setof public.membership_plans language sql security definer set search_path=public as $$
  select p.* from public.membership_plans p join public.profiles u on u.id=auth.uid()
  where u.role='admin' order by p.sort_order,p.created_at;
$$;
revoke all on function public.get_admin_membership_plans() from public;
grant execute on function public.get_admin_membership_plans() to authenticated;

create or replace function public.update_membership_plan(
  p_plan_id uuid,p_name text,p_slug text,p_billing_interval text,p_price numeric,
  p_benefits jsonb,p_active boolean,p_sort_order integer
) returns public.membership_plans language plpgsql security definer set search_path=public as $$
declare v_plan public.membership_plans; v_role text;
begin
  select role into v_role from public.profiles where id=auth.uid();
  if v_role <> 'admin' then raise exception 'Admin access required'; end if;
  if p_billing_interval not in ('monthly','yearly') then raise exception 'Invalid billing interval'; end if;
  if p_price < 0 then raise exception 'Invalid price'; end if;
  if p_plan_id is null then
    insert into public.membership_plans(name,slug,billing_interval,price,benefits,active,sort_order)
    values(trim(p_name),trim(p_slug),p_billing_interval,p_price,coalesce(p_benefits,'[]'::jsonb),coalesce(p_active,true),greatest(coalesce(p_sort_order,0),0))
    returning * into v_plan;
  else
    update public.membership_plans set name=trim(p_name),slug=trim(p_slug),billing_interval=p_billing_interval,price=p_price,benefits=coalesce(p_benefits,'[]'::jsonb),active=coalesce(p_active,true),sort_order=greatest(coalesce(p_sort_order,0),0),updated_at=now()
    where id=p_plan_id returning * into v_plan;
  end if;
  if not found then raise exception 'Membership plan not found'; end if;
  return v_plan;
end;
$$;
revoke all on function public.update_membership_plan(uuid,text,text,text,numeric,jsonb,boolean,integer) from public;
grant execute on function public.update_membership_plan(uuid,text,text,text,numeric,jsonb,boolean,integer) to authenticated;