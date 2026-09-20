-- Phase 24 notification security finalization
-- Notifications are written by trusted database triggers and read/updated only by the owning user.
revoke all on table public.notifications from anon;
revoke insert, delete, truncate, references, trigger on table public.notifications from authenticated;

revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;
revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;

alter function public.mark_notification_read(uuid) security invoker;
alter function public.mark_all_notifications_read() security invoker;
