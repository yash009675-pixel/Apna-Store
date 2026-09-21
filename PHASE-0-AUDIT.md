# Apna Store — Phase 0 Foundation & Security Audit

Date: 2026-09-21

## Phase 0 objective

Finish Foundation, Security, Authorization, Deployment, Migration, and production-readiness verification before starting Phase 1.

**Current status: NOT COMPLETE / NOT SIGNED OFF.**

Phase 1 must not start until the remaining verification blockers below are actually completed.

## 1. GitHub / repository

- [x] Repository: `yash009675-pixel/Apna-Store`
- [x] Default branch: `main`
- [x] Latest main commit is the Phase 0 audit update; the latest code/workflow commit before the audit documentation updates is `5a1ad6ef8da25f1dba1cd5de4700db5cb122c53b`.
- [x] GitHub Pages workflow exists at `.github/workflows/deploy-pages.yml`.
- [x] Pages workflow deploys the repository root to GitHub Pages.
- [x] Pages workflow runs JavaScript syntax validation before deployment.
- [x] Pages workflow has `contents: read`, `pages: write`, and `id-token: write` permissions.
- [x] No frontend secret values were found in the inspected repository files.
- [x] Fresh GitHub Pages deployment verification completed. Successful latest verified run: `35630492659`; build, build-status reporting, and Pages deployment jobs all succeeded.
- [ ] Live-site browser verification is still pending; no browser automation is available in the current connector set.
- [ ] Full browser end-to-end QA is still pending.

## 2. Supabase migration state

Project: `xxedwtmdylfufrfzyrdb`

Latest database migration recorded by Supabase:

`20260920175922 — phase32_rto_ndr_tracking_fields`

Other latest applied migrations include:

- `20260920164729 — phase32_logistics_shipping_foundation`
- `20260920172851 — phase32_return_logistics_fields`
- `20260920173200 — phase32_return_request_events`

### Migration-source-control reconciliation

The repository history was checked directly, including the migration-path commit history.

A Phase 32 logistics foundation source file **does exist in GitHub**, but its filename is:

`20260920170000_phase32_logistics_shipping_foundation.sql`

while Supabase records the applied migration version as:

`20260920164729_phase32_logistics_shipping_foundation`

The GitHub file content was compared structurally with the live logistics foundation schema and matches the shipment/shipment-events/shipping-pickups foundation model.

The later applied Phase 32 migrations:

- `20260920172851_phase32_return_logistics_fields`
- `20260920173200_phase32_return_request_events`
- `20260920175922_phase32_rto_ndr_tracking_fields`

are **not currently present in the GitHub migration tree**, and their exact SQL was not recoverable from the repository path history exposed by GitHub.

**This remains a Phase 0 migration-workflow blocker.**

No guessed, comment-only, or fabricated migration files have been added. The live database was not modified just to make migration history appear clean.

## 3. Database / RLS

Current public tables inspected include:

- profiles
- categories
- products
- product_variants
- addresses
- orders
- order_items
- wishlists
- reviews
- coupons
- payment_transactions
- return_requests
- seller_applications
- product_images
- brands
- marketing_campaigns
- notifications
- shipments
- shipment_events
- shipping_pickups
- return_request_events

- [x] RLS is enabled on all inspected public tables.
- [x] Existing public-table policies have guards.
- [x] Secure order creation RPC exists.
- [x] Seller/admin role architecture exists.
- [x] Private RLS helper schema exists.
- [x] Authorization-boundary test SQL exists in `supabase/tests/`.
- [x] Live logistics tables/columns were checked against the Phase 32 foundation source; later RTO/NDR fields are present in the live database.

## 4. Authorization verification

- [x] Customer profile exists and is assigned customer role.
- [x] Admin profile exists.
- [x] Direct SQL authorization smoke test confirmed a customer-context call to `admin_list_categories()` is rejected with `Admin access required`.
- [x] Admin-context call to `admin_list_categories()` succeeds and returns JSON array data.
- [x] SECURITY DEFINER functions were inspected; relevant admin/seller/customer functions contain explicit authentication and role/ownership checks where required.
- [ ] Dedicated real seller test-account browser verification.
- [ ] Dedicated real admin browser verification.
- [ ] Complete customer signup/login browser verification.

## 5. Security Advisor

Current Supabase Security Advisor findings:

- 23 authenticated-executable SECURITY DEFINER function warnings.
- 1 leaked-password-protection warning.

The SECURITY DEFINER warnings are currently understood as intentional RPC architecture in which the functions perform their own authentication/role/ownership checks. They remain visible Advisor findings and therefore are **not signed off as zero-risk**.

Leaked-password protection is currently unavailable on the project's Free-plan configuration and must not be falsely marked as enabled.

**Security sign-off remains pending.**

## 6. Edge Functions

Active functions inspected include:

- apna-ai-assistant
- apna-courier
- apna-courier-v2
- apna-courier-v3
- apna-courier-v4
- apna-courier-create
- apna-courier-actions
- apna-courier-track
- apna-return-actions
- apna-courier-return-create

Courier/return functions are JWT-protected. The AI assistant intentionally allows guest access and must continue to enforce safe server-side behavior.

## 7. Logistics verification

- [x] Shipment/return database foundation exists.
- [x] Courier Edge Functions exist.
- [x] Customer tracking foundation exists.
- [x] Seller/admin logistics UI exists.
- [ ] Real provider shipment creation has not been completed in production.
- [ ] Real AWB/pickup/tracking flow has not been fully verified end-to-end.
- [ ] Current `shipments` table contains 0 rows.

No fake shipment, AWB, courier status, or tracking result is acceptable.

## 8. Phase 0 remaining blockers

1. Live browser QA of the current website.
2. Customer signup/login/profile end-to-end verification.
3. Seller authorization test-account verification.
4. Admin authorization test-account verification.
5. Customer end-to-end shopping/order flow verification.
6. Mobile regression/browser QA.
7. Migration-source-control reconciliation for the later Phase 32 migrations and the logistics migration version mismatch.
8. Final security review of accepted SECURITY DEFINER findings.
9. Real provider logistics E2E verification if included in the Phase 0 exit gate.
10. Final Phase 0 exit checklist.

## 9. Exit rule

Phase 0 is **PASS** only when all required verification items above are actually tested and evidenced.

Until then:

**DO NOT START PHASE 1.**

No feature expansion should be used to hide or bypass a Phase 0 blocker.
