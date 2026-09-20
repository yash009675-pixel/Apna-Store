# Phase 25 — Security Audit

## Scope
- Public-table RLS coverage
- SECURITY DEFINER RPC authorization
- SECURITY DEFINER search_path hardening
- Storage object policies
- Notification RPC permissions
- Supabase Security Advisor review

## Verified
- All 17 public tables have RLS enabled.
- Exposed SECURITY DEFINER application RPCs enforce authenticated/admin/seller ownership checks as appropriate.
- Legacy overloads without authenticated EXECUTE remain service-role only.
- SECURITY DEFINER application RPC search_path is explicitly constrained to trusted schemas.
- Product image storage policies restrict authenticated users to their own first-level UUID folder.
- Notification RPCs are SECURITY INVOKER and authenticated-only.

## Remaining platform setting
Supabase Security Advisor reports Leaked Password Protection disabled. This is an Auth project setting and is not changed through SQL/migrations.

## E2E
No browser authorization E2E is claimed in this audit. Final authorization E2E remains part of Phase 31 / Phase 0 sign-off.
