-- Phase 22: AI Support Center query indexes
create index if not exists idx_orders_user_support on public.orders(user_id,created_at desc,status,delivery_status);
create index if not exists idx_shipments_order_support on public.shipments(order_id,created_at desc,status);
create index if not exists idx_returns_order_support on public.return_requests(order_id,requested_at desc,status,refund_status);
create index if not exists idx_payments_order_support on public.payment_transactions(order_id,created_at desc,status);
