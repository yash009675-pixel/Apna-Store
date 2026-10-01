do $$
declare src text;
begin
  select pg_get_functiondef(p.oid) into src from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='seller_growth_insights' limit 1;
  if src is not null then
    src:=replace(src,'public.seller_growth_insights','public.admin_business_insights');
    src:=replace(src,'r not in (''seller'',''admin'')','r <> ''admin''');
    execute src;
  end if;
  select pg_get_functiondef(p.oid) into src from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='seller_search_trends' limit 1;
  if src is not null then
    src:=replace(src,'public.seller_search_trends','public.admin_search_trends');
    src:=replace(src,'r not in(''seller'',''admin'')','r <> ''admin''');
    execute src;
  end if;
end $$;
grant execute on function public.admin_business_insights(timestamptz,timestamptz,text) to authenticated;
grant execute on function public.admin_search_trends(timestamptz,timestamptz) to authenticated;
do $$
declare r record;
begin
  for r in select p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'seller%' and p.proname not in ('seller_growth_insights','seller_search_trends')
  loop execute format('drop function if exists public.%I(%s)',r.proname,r.args); end loop;
  for r in select p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'admin%seller%'
  loop execute format('drop function if exists public.%I(%s)',r.proname,r.args); end loop;
end $$;
drop function if exists public.seller_growth_insights(timestamptz,timestamptz,text);
drop function if exists public.seller_search_trends(timestamptz,timestamptz);