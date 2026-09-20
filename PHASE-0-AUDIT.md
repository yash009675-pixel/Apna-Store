# Apna Store — Phase 0 Foundation Audit

Date: 2026-09-20

## Goal

Stabilize the existing application and establish a safe foundation before expanding the marketplace.

## Current architecture

- Static HTML/CSS/JavaScript frontend.
- GitHub Pages deployment from `main`.
- Supabase Auth + Postgres + Storage-ready architecture.
- Customer storefront and shopping flow already present.
- Product variants, wishlist, orders and secure order RPC already present.
- Seller/admin role model is being introduced as foundation work.

## Phase 0 checklist

### Repository
- [x] GitHub Pages workflow exists.
- [x] Static deployment uses the repository root.
- [x] Favicon exists.
- [x] No secrets stored in repository frontend files.
- [x] JavaScript syntax validation added to deployment workflow.
- [x] Customer catalog uses the live Supabase product/category API; no fallback product array remains in the active shop loader.
- [ ] Full browser end-to-end QA — intentionally scheduled for the next browser-testing session.
- [x] Version-controlled Supabase migration workflow documentation added; historical migrations were not fabricated.

### Database
- [x] Core product/category/variant/order/profile tables exist.
- [x] RLS enabled on all current public tables.
- [x] Product/variant/order indexes exist.
- [x] Secure order creation RPC exists.
- [x] New Auth users receive a customer profile.
- [x] Seller/admin helper functions use SECURITY DEFINER with a fixed search path.
- [x] Role-check helpers moved into the non-exposed `private` schema.
- [ ] Add seller onboarding/application tables.
- [ ] Add product image metadata table.
- [ ] Add seller/order relationships for multi-seller orders.
- [ ] Add returns/refunds/coupons/notifications tables in later phases.

### Authorization
- [x] Customer is the default signup role.
- [x] Client signup cannot choose seller/admin role through the profile insert policy.
- [x] Seller product access is restricted to the seller's own products.
- [x] Admin access is separate.
- [x] RLS helper execute grants corrected for authenticated policy evaluation.
- [x] Add automated RLS tests under `supabase/tests/`.
- [x] Live RLS smoke suite passes 8/8 checks (anon + authenticated customer context).
- [x] Authorization-boundary test foundation added and live privilege/policy boundaries verified.
- [ ] Full seller/admin authorization test-account verification.

### Deployment
- [x] Pages deployment is triggered by pushes to `main`.
- [x] Workflow now blocks deployment when JavaScript syntax is invalid.
- [x] Customer-page script cache versions have been standardized in source.
- [ ] Verify the latest pending deployment(s) succeed in GitHub Actions.
- [ ] Add a staging/preview workflow before production changes when the marketplace grows.

## Phase 0 exit criteria

Phase 0 will be considered complete only when:

1. The latest GitHub commit deploys successfully.
2. All JavaScript passes CI syntax validation.
3. Supabase RLS/security checks pass (automated smoke suite passes; one remaining Security Advisor warning is the intentionally callable checkout RPC).
4. Customer auth/profile creation is verified.
5. Seller/admin authorization is verified with test accounts.
6. No known broken core customer flow remains.
7. The database architecture is ready for seller, inventory, image and order expansion.

## Current verification snapshot

- Live Supabase catalog: 8 active products and 68 variants verified.
- Anonymous catalog read: 8 active products verified.
- Secure order RPC: authenticated-only execution verified; transaction test completed without persistent changes.
- Real customer signup/profile: verified for the existing customer test account.
- Latest wishlist implementation: deployed successfully in GitHub Actions.
- Latest catalog/cache-hardening commits still require their workflow status to be verified before being called production-deployed.
- Full browser E2E testing remains intentionally pending for the next browser-testing session.

## Security reference

Supabase recommends RLS on exposed tables, appropriate grants, security review, indexes for common query patterns, and production testing before launch.
