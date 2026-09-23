-- Phase 34: Reviews & Moderation
begin;

alter table public.reviews add column if not exists moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected','hidden'));
alter table public.reviews add column if not exists moderated_by uuid references public.profiles(id) on delete set null;
alter table public.reviews add column if not exists moderated_at timestamptz;
alter table public.reviews add column if not exists moderation_reason text;
create index if not exists reviews_moderation_product_idx on public.reviews(product_id,moderation_status,created_at desc);
create index if not exists reviews_moderation_status_idx on public.reviews(moderation_status,created_at desc);

create table if not exists public.review_images(id uuid primary key default gen_random_uuid(),review_id uuid not null references public.reviews(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,storage_path text not null,alt_text text,created_at timestamptz not null default now(),unique(review_id,storage_path));
alter table public.review_images enable row level security;
revoke all on public.review_images from anon,authenticated;
grant select,insert,delete on public.review_images to authenticated;
create policy review_images_public_read on public.review_images for select to authenticated using (exists(select 1 from public.reviews r where r.id=review_id and (r.moderation_status='approved' or r.user_id=(select auth.uid()) or private.is_admin())));
create policy review_images_owner_insert on public.review_images for insert to authenticated with check (user_id=(select auth.uid()) and exists(select 1 from public.reviews r where r.id=review_id and r.user_id=(select auth.uid())));
create policy review_images_owner_delete on public.review_images for delete to authenticated using (user_id=(select auth.uid()) or (select private.is_admin()));
create index if not exists review_images_review_idx on public.review_images(review_id,created_at);

create table if not exists public.review_helpful_votes(review_id uuid not null references public.reviews(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,created_at timestamptz not null default now(),primary key(review_id,user_id));
alter table public.review_helpful_votes enable row level security;
revoke all on public.review_helpful_votes from anon,authenticated;
grant select,insert,delete on public.review_helpful_votes to authenticated;
create policy review_helpful_read on public.review_helpful_votes for select to authenticated using (user_id=(select auth.uid()) or (select private.is_admin()));
create policy review_helpful_insert on public.review_helpful_votes for insert to authenticated with check (user_id=(select auth.uid()) and exists(select 1 from public.reviews r where r.id=review_id and r.moderation_status='approved'));
create policy review_helpful_delete on public.review_helpful_votes for delete to authenticated using (user_id=(select auth.uid()));
create index if not exists review_helpful_review_idx on public.review_helpful_votes(review_id);

create table if not exists public.review_reports(id uuid primary key default gen_random_uuid(),review_id uuid not null references public.reviews(id) on delete cascade,reporter_id uuid not null references public.profiles(id) on delete cascade,reason text not null check (reason in ('spam','abuse','offensive','fake_review','irrelevant','other')),details text check (details is null or char_length(details)<=1000),status text not null default 'open' check (status in ('open','reviewed','dismissed','confirmed')),reviewed_by uuid references public.profiles(id) on delete set null,reviewed_at timestamptz,created_at timestamptz not null default now(),unique(review_id,reporter_id));
alter table public.review_reports enable row level security;
revoke all on public.review_reports from anon,authenticated;
grant select,insert,update on public.review_reports to authenticated;
create policy review_reports_owner_read on public.review_reports for select to authenticated using (reporter_id=(select auth.uid()) or (select private.is_admin()));
create policy review_reports_owner_insert on public.review_reports for insert to authenticated with check (reporter_id=(select auth.uid()) and exists(select 1 from public.reviews r where r.id=review_id and r.moderation_status='approved'));
create policy review_reports_admin_update on public.review_reports for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create index if not exists review_reports_status_idx on public.review_reports(status,created_at desc);
create index if not exists review_reports_review_idx on public.review_reports(review_id,status);

create table if not exists public.seller_review_responses(id uuid primary key default gen_random_uuid(),review_id uuid not null unique references public.reviews(id) on delete cascade,seller_id uuid not null references public.profiles(id) on delete cascade,body text not null check (char_length(btrim(body)) between 1 and 1500),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.seller_review_responses enable row level security;
revoke all on public.seller_review_responses from anon,authenticated;
grant select,insert,update,delete on public.seller_review_responses to authenticated;
create policy seller_review_responses_read on public.seller_review_responses for select to authenticated using (exists(select 1 from public.reviews r where r.id=review_id and r.moderation_status='approved') or seller_id=(select auth.uid()) or (select private.is_admin()));
create policy seller_review_responses_owner_write on public.seller_review_responses for all to authenticated using (seller_id=(select auth.uid()) or (select private.is_admin())) with check (seller_id=(select auth.uid()) or (select private.is_admin()));
create index if not exists seller_review_responses_seller_idx on public.seller_review_responses(seller_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('review-images','review-images',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists review_images_storage_read on storage.objects;
create policy review_images_storage_read on storage.objects for select to public using(bucket_id='review-images');
drop policy if exists review_images_storage_insert on storage.objects;
create policy review_images_storage_insert on storage.objects for insert to authenticated with check(bucket_id='review-images' and (storage.foldername(name))[1]=(select auth.uid()::text));
drop policy if exists review_images_storage_update on storage.objects;
create policy review_images_storage_update on storage.objects for update to authenticated using(bucket_id='review-images' and owner_id=(select auth.uid()::text)) with check(bucket_id='review-images' and owner_id=(select auth.uid()::text));
drop policy if exists review_images_storage_delete on storage.objects;
create policy review_images_storage_delete on storage.objects for delete to authenticated using(bucket_id='review-images' and owner_id=(select auth.uid()::text));

drop policy if exists reviews_public_read on public.reviews;
create policy reviews_public_read on public.reviews for select to anon,authenticated using(moderation_status='approved' or user_id=(select auth.uid()) or (select private.is_admin()));

create or replace function public.create_review_secure(p_product_id uuid,p_order_id uuid,p_rating integer,p_title text default null,p_body text default null) returns public.reviews language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_user_id uuid:=auth.uid();v_review public.reviews;v_reason text:=null;
begin
 if v_user_id is null then raise exception 'Sign in required'; end if;
 if p_rating not between 1 and 5 then raise exception 'Rating must be between 1 and 5'; end if;
 if not exists(select 1 from public.orders o join public.order_items oi on oi.order_id=o.id where o.id=p_order_id and o.user_id=v_user_id and o.delivery_status='delivered' and oi.product_id=p_product_id) then raise exception 'You can review a product only after it has been delivered to you'; end if;
 if exists(select 1 from public.reviews r where r.user_id=v_user_id and r.product_id=p_product_id and r.order_id=p_order_id) then raise exception 'You have already reviewed this product from this order'; end if;
 if exists(select 1 from public.reviews r where r.user_id=v_user_id and r.created_at>=now()-interval '30 minutes' and r.moderation_status in ('pending','approved')) then v_reason:='Review-rate check: multiple reviews submitted in a short window.'; end if;
 if p_body is not null and exists(select 1 from public.reviews r where r.user_id=v_user_id and lower(btrim(coalesce(r.body,'')))=lower(btrim(p_body)) and r.created_at>=now()-interval '90 days') then v_reason:='Duplicate review text detected; moderation review required.'; end if;
 insert into public.reviews(user_id,product_id,order_id,rating,title,body,verified_purchase,moderation_status,moderation_reason) values(v_user_id,p_product_id,p_order_id,p_rating,nullif(trim(p_title),''),nullif(trim(p_body),''),true,'pending',v_reason) returning * into v_review;return v_review;
end; $$;
revoke all on function public.create_review_secure(uuid,uuid,integer,text,text) from public,anon,authenticated;grant execute on function public.create_review_secure(uuid,uuid,integer,text,text) to authenticated;

create or replace function public.review_add_helpful_vote(p_review_id uuid) returns boolean language plpgsql security invoker set search_path=public,private,pg_temp as $$ begin if auth.uid() is null then raise exception 'Sign in required';end if;insert into public.review_helpful_votes(review_id,user_id) select p_review_id,auth.uid() where exists(select 1 from public.reviews where id=p_review_id and moderation_status='approved') on conflict do nothing;return true;end; $$;
create or replace function public.review_remove_helpful_vote(p_review_id uuid) returns boolean language plpgsql security invoker set search_path=public,private,pg_temp as $$ begin delete from public.review_helpful_votes where review_id=p_review_id and user_id=auth.uid();return true;end; $$;
revoke all on function public.review_add_helpful_vote(uuid),public.review_remove_helpful_vote(uuid) from public,anon;grant execute on function public.review_add_helpful_vote(uuid),public.review_remove_helpful_vote(uuid) to authenticated;

create or replace function public.seller_respond_to_review(p_review_id uuid,p_body text) returns public.seller_review_responses language plpgsql security definer set search_path=public,private,pg_temp as $$ declare v public.seller_review_responses;v_seller uuid;begin if auth.uid() is null then raise exception 'Sign in required';end if;select p.seller_id into v_seller from public.reviews r join public.products p on p.id=r.product_id where r.id=p_review_id and r.moderation_status='approved';if v_seller is null or v_seller<>auth.uid() then raise exception 'Seller access required';end if;insert into public.seller_review_responses(review_id,seller_id,body) values(p_review_id,auth.uid(),btrim(p_body)) on conflict(review_id) do update set body=excluded.body,updated_at=now() returning * into v;return v;end; $$;
revoke all on function public.seller_respond_to_review(uuid,text) from public,anon;grant execute on function public.seller_respond_to_review(uuid,text) to authenticated;

create or replace function public.admin_moderate_review(p_review_id uuid,p_status text,p_reason text default null) returns public.reviews language plpgsql security definer set search_path=public,private,pg_temp as $$ declare v public.reviews;begin if not private.is_admin() then raise exception 'Admin access required';end if;if p_status not in ('pending','approved','rejected','hidden') then raise exception 'Invalid moderation status';end if;update public.reviews set moderation_status=p_status,moderated_by=auth.uid(),moderated_at=now(),moderation_reason=nullif(btrim(coalesce(p_reason,'')),'') where id=p_review_id returning * into v;if not found then raise exception 'Review not found';end if;return v;end; $$;
revoke all on function public.admin_moderate_review(uuid,text,text) from public,anon;grant execute on function public.admin_moderate_review(uuid,text,text) to authenticated;

create or replace function public.admin_list_reviews(p_status text default 'pending') returns table(id uuid,product_id uuid,user_id uuid,order_id uuid,rating integer,title text,body text,verified_purchase boolean,moderation_status text,moderation_reason text,created_at timestamptz,report_count bigint,helpful_count bigint) language sql security definer set search_path=public,private,pg_temp as $$ select r.id,r.product_id,r.user_id,r.order_id,r.rating,r.title,r.body,r.verified_purchase,r.moderation_status,r.moderation_reason,r.created_at,(select count(*) from public.review_reports rr where rr.review_id=r.id and rr.status='open'),(select count(*) from public.review_helpful_votes hv where hv.review_id=r.id) from public.reviews r where private.is_admin() and (p_status is null or r.moderation_status=p_status) order by r.created_at desc limit 200; $$;
revoke all on function public.admin_list_reviews(text) from public,anon;grant execute on function public.admin_list_reviews(text) to authenticated;

create or replace function public.admin_list_review_reports(p_status text default 'open') returns table(id uuid,review_id uuid,reporter_id uuid,reason text,details text,status text,created_at timestamptz) language sql security definer set search_path=public,private,pg_temp as $$ select rr.id,rr.review_id,rr.reporter_id,rr.reason,rr.details,rr.status,rr.created_at from public.review_reports rr where private.is_admin() and (p_status is null or rr.status=p_status) order by rr.created_at desc limit 200; $$;
revoke all on function public.admin_list_review_reports(text) from public,anon;grant execute on function public.admin_list_review_reports(text) to authenticated;

create or replace function public.admin_update_review_report(p_id uuid,p_status text) returns public.review_reports language plpgsql security definer set search_path=public,private,pg_temp as $$ declare v public.review_reports;begin if not private.is_admin() then raise exception 'Admin access required';end if;if p_status not in ('open','reviewed','dismissed','confirmed') then raise exception 'Invalid report status';end if;update public.review_reports set status=p_status,reviewed_by=auth.uid(),reviewed_at=now() where id=p_id returning * into v;if not found then raise exception 'Report not found';end if;return v;end; $$;
revoke all on function public.admin_update_review_report(uuid,text) from public,anon;grant execute on function public.admin_update_review_report(uuid,text) to authenticated;

commit;