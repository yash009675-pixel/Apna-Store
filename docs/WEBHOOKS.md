# Phase 73 — Webhooks

Apna Store has a secure asynchronous webhook outbox.

- Order INSERT/UPDATE events become sanitized webhook events.
- Active endpoints receive matching events through pg_net.
- Webhook secrets are stored in Supabase Vault, never in application tables.
- HMAC-SHA256 signatures use the X-Apna-Signature header.
- Delivery attempts, HTTP responses, failures and retry timing are recorded.
- Dispatch and reconciliation run every 5 minutes using the existing database scheduler.
- Webhook tables have no direct client access; endpoint management is admin-only through RPCs.
- No payment, shipment, AWB, tracking or other fake success is generated.
- The system stays inactive until an administrator explicitly configures and enables an endpoint.
