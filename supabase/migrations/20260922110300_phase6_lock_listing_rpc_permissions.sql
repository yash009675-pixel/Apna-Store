-- Phase 6: lock seller listing RPC execution to authenticated users
revoke execute on function public.seller_save_listing(uuid,text,text,numeric,numeric,numeric,text,uuid,text,uuid,jsonb,numeric,jsonb,text,numeric,numeric,numeric,numeric,jsonb) from public, anon;
grant execute on function public.seller_save_listing(uuid,text,text,numeric,numeric,numeric,text,uuid,text,uuid,jsonb,numeric,jsonb,text,numeric,numeric,numeric,numeric,jsonb) to authenticated;

revoke execute on function public.seller_set_listing_status(uuid,text) from public, anon;
grant execute on function public.seller_set_listing_status(uuid,text) to authenticated;

revoke execute on function public.seller_delete_listing(uuid) from public, anon;
grant execute on function public.seller_delete_listing(uuid) to authenticated;

revoke execute on function public.seller_duplicate_listing(uuid) from public, anon;
grant execute on function public.seller_duplicate_listing(uuid) to authenticated;

revoke execute on function public.seller_bulk_update_listings(uuid[],integer,numeric,numeric,text) from public, anon;
grant execute on function public.seller_bulk_update_listings(uuid[],integer,numeric,numeric,text) to authenticated;