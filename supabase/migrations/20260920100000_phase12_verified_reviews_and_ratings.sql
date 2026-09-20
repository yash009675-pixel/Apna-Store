alter table public.reviews add column if not exists order_id uuid references public.orders(id) on delete cascade, add column if not exists verified_purchase boolean not null default false;
create index if not exists reviews_order_id_idx on public.reviews(order_id);
create index if not exists reviews_verified_product_idx on public.reviews(product_id,verified_purchase,created_at desc);
alter table public.reviews drop constraint if exists reviews_title_length_check;
alter table public.reviews add constraint reviews_title_length_check check(title is null or char_length(title) between 0 and 120);
alter table public.reviews drop constraint if exists reviews_body_length_check;
alter table public.reviews add constraint reviews_body_length_check check(body is null or char_length(body) between 0 and 2000);
drop policy if exists reviews_insert_own on public.reviews;
create or replace function public.create_review_secure(p_product_id uuid,p_order_id uuid,p_rating integer,p_title text default null,p_body text default null) returns public.reviews language plpgsql security definer set search_path=public,private as $$
declare v_user_id uuid:=auth.uid();v_review public.reviews;
begin
if v_user_id is null then raise exception 'Sign in required';end if;
if p_rating<1 or p_rating>5 then raise exception 'Rating must be between 1 and 5';end if;
if not exists(select 1 from public.orders o join public.order_items oi on oi.order_id=o.id where o.id=p_order_id and o.user_id=v_user_id and o.delivery_status='delivered' and oi.product_id=p_product_id) then raise exception 'You can review a product only after it has been delivered to you';end if;
if exists(select 1 from public.reviews r where r.user_id=v_user_id and r.product_id=p_product_id and r.order_id=p_order_id) then raise exception 'You have already reviewed this product from this order';end if;
insert into public.reviews(user_id,product_id,order_id,rating,title,body,verified_purchase) values(v_user_id,p_product_id,p_order_id,p_rating,nullif(trim(p_title),''),nullif(trim(p_body),''),true) returning * into v_review;return v_review;
end;$$;
revoke all on function public.create_review_secure(uuid,uuid,integer,text,text) from public,anon;
grant execute on function public.create_review_secure(uuid,uuid,integer,text,text) to authenticated;
create or replace function public.reviews_protect_immutable_fields() returns trigger language plpgsql security definer set search_path=public as $$
begin
if new.user_id is distinct from old.user_id or new.product_id is distinct from old.product_id or new.order_id is distinct from old.order_id or new.verified_purchase is distinct from old.verified_purchase then raise exception 'Review ownership, product, order, and verification fields cannot be changed';end if;return new;
end;$$;
drop trigger if exists reviews_immutable_fields on public.reviews;
create trigger reviews_immutable_fields before update on public.reviews for each row execute function public.reviews_protect_immutable_fields();
revoke all on function public.reviews_protect_immutable_fields() from public;
grant execute on function public.reviews_protect_immutable_fields() to authenticated;