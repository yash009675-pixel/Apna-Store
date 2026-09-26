-- Free notification delivery: email queue + scheduled dispatcher
-- Resend is optional; the queue remains safe until RESEND_API_KEY is configured.

begin;

create or replace function public.queue_notification_email_delivery()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if exists (
    select 1
    from public.notification_preferences p
    where p.user_id = new.user_id
      and p.channel = 'email'
      and p.category = new.category
      and p.enabled = false
  ) then
    return new;
  end if;

  insert into public.notification_deliveries(notification_id, channel, status)
  values (new.id, 'email', 'pending')
  on conflict (notification_id, channel) do nothing;

  return new;
end;
$$;

revoke all on function public.queue_notification_email_delivery() from public, anon, authenticated;
grant execute on function public.queue_notification_email_delivery() to postgres;

drop trigger if exists notification_email_delivery_trigger on public.notifications;
create trigger notification_email_delivery_trigger
after insert on public.notifications
for each row execute function public.queue_notification_email_delivery();

do $$
begin
  perform cron.unschedule('apna-notification-email-dispatch');
exception when others then
  null;
end $$;

select cron.schedule(
  'apna-notification-email-dispatch',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := 'https://xxedwtmdylfufrfzyrdb.supabase.co/functions/v1/apna-notification-email',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('source','supabase-cron','time',now()),
      timeout_milliseconds := 5000
    );
  $$
);

commit;
