alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_channel_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_channel_check
  check (channel = any (array['in_app','email','sms','whatsapp','push']::text[]));

alter table public.notification_preferences
  drop constraint if exists notification_preferences_channel_check;

alter table public.notification_preferences
  add constraint notification_preferences_channel_check
  check (channel = any (array['in_app','email','sms','whatsapp','push']::text[]));

create or replace function public.queue_notification_push_delivery()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
begin
  if exists (
    select 1 from public.notification_preferences p
    where p.user_id = new.user_id
      and p.channel = 'push'
      and p.category = new.category
      and p.enabled = false
  ) then
    return new;
  end if;

  insert into public.notification_deliveries(notification_id, channel, status)
  values (new.id, 'push', 'pending')
  on conflict (notification_id, channel) do nothing;

  return new;
end;
$function$;

drop trigger if exists notification_push_delivery_trigger on public.notifications;

create trigger notification_push_delivery_trigger
after insert on public.notifications
for each row
execute function public.queue_notification_push_delivery();

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'apna-notification-push-dispatch') then
    perform cron.schedule(
      'apna-notification-push-dispatch',
      '* * * * *',
      $cron$
      select net.http_post(
        url := 'https://xxedwtmdylfufrfzyrdb.supabase.co/functions/v1/apna-notification-push',
        headers := jsonb_build_object('Content-Type','application/json'),
        body := '{}'::jsonb
      );
      $cron$
    );
  end if;
end
$$;
