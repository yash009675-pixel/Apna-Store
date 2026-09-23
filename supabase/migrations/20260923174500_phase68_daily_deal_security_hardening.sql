-- Phase 68: restrict privileged Deal of the Day RPCs to signed-in callers.
-- The functions still enforce the admin role internally; this removes unnecessary public RPC exposure.
revoke execute on function public.admin_create_daily_deal(text, timestamptz, timestamptz, text, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.admin_create_daily_deal(text, timestamptz, timestamptz, text, numeric, jsonb) to authenticated;

revoke execute on function public.admin_update_daily_deal_status(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_update_daily_deal_status(uuid, text) to authenticated;

revoke execute on function public.get_admin_daily_deal_analytics() from public, anon, authenticated;
grant execute on function public.get_admin_daily_deal_analytics() to authenticated;
