create or replace function public.notify_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_name text;
  v_admin record;
  v_variant_label text;
  v_title text;
  v_body text;
begin
  if tg_op <> 'UPDATE' or new.stock is null or old.stock is null or new.stock = old.stock then
    return new;
  end if;

  if not (
    (old.stock > 5 and new.stock between 1 and 5)
    or (old.stock > 0 and new.stock = 0)
  ) then
    return new;
  end if;

  select p.name into v_product_name
  from public.products p
  where p.id = new.product_id;

  v_variant_label := concat_ws(' / ', nullif(btrim(new.size), ''), nullif(btrim(new.color), ''));
  if v_variant_label is null or v_variant_label = '' then
    v_variant_label := 'Standard';
  end if;

  if new.stock = 0 then
    v_title := 'Out of stock: ' || coalesce(new.sku, 'SKU');
    v_body := coalesce(v_product_name, 'Product') || ' · ' || coalesce(new.sku, 'SKU') ||
      ' (' || v_variant_label || ') is now out of stock.';
  else
    v_title := 'Low stock: ' || coalesce(new.sku, 'SKU');
    v_body := coalesce(v_product_name, 'Product') || ' · ' || coalesce(new.sku, 'SKU') ||
      ' (' || v_variant_label || ') has only ' || new.stock || ' unit(s) left.';
  end if;

  for v_admin in
    select id from public.profiles where role = 'admin'
  loop
    insert into public.notifications(
      user_id, type, title, body, link, entity_type, entity_id,
      category, audience_role
    )
    values(
      v_admin.id,
      case when new.stock = 0 then 'out_of_stock' else 'low_stock' end,
      v_title,
      v_body,
      'inventory-center.html',
      'product_variant',
      new.id,
      'low_stock',
      'admin'
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists product_variant_low_stock_notification on public.product_variants;
create trigger product_variant_low_stock_notification
after update of stock on public.product_variants
for each row
execute function public.notify_low_stock();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
