# Phase 75 — Public APIs

Apna Store now exposes a versioned public API foundation.

## v1
- Endpoint: `/functions/v1/apna-public-api-v1`
- Authentication: `x-api-key`
- API keys are stored only as SHA-256 hashes; the raw key is returned only when an administrator creates it.
- Scope: `catalog:read`
- Supports catalog listing plus optional `id` or `slug` filtering.
- Only approved products are exposed.
- API clients can be disabled by an administrator.
- API client creation/status changes are audited.
- No payment, refund, shipment, AWB, tracking, stock mutation, or role-management endpoint is exposed.
- No paid API gateway or external rate-limit service was introduced.

The Edge Function uses server-side credentials only and never exposes Supabase service credentials to API consumers.