-- Phase 23: Seller AI Support query indexes
create index if not exists idx_order_items_product_support on public.order_items(product_id,created_at desc,order_id);
create index if not exists idx_seller_payouts_seller_support on public.seller_payouts(seller_id,created_at desc,status);
create index if not exists idx_returns_order_item_support on public.return_requests(order_item_id,requested_at desc,status);
