# Apna Store — Phase 0 Foundation & Security Audit

Date: 2026-09-21

## Phase 0 objective

Finish Foundation, Security, Authorization, Deployment, Migration, and production-readiness verification before starting Phase 1.

**Current status: NOT COMPLETE / NOT SIGNED OFF.**

Phase 1 must not start until the remaining verification blockers below are actually completed.

## 1. GitHub / repository

- [x] Repository: `yash009675-pixel/Apna-Store`
- [x] Default branch: `main`
- [x] Latest audit commit verified: `d40b75d7ce81f3811d95f0383dc2f5ca7914e05c`.
- [x] GitHub Pages workflow exists at `.github/workflows/deploy-pages.yml`.
- [x] Pages workflow deploys the repository root to GitHub Pages.
- [x] Pages workflow runs JavaScript syntax validation before deployment.
- [x] Pages workflow has `contents: read`, `pages: write`, and `id-token: write` permissions.
- [x] No frontend secret values were found in the inspected repository files.
- [x] Latest known Pages deployment for the previous audit update completed successfully.
- [ ] Pages deployment for the latest audit-only commit must still be rechecked after GitHub Actions finishes.
- [ ] Live-site browser verification is pending; no browser automation is available in the current connector set.
- [ ] Full browser end-to-end QA is pending.

## 2. Supabase migration state

Project: `xxedwtmdylfufrfzyrdb`

Latest database migration recorded by Supabase:

`20260921173528 — phase0_remove_duplicate_product_category_index`

Latest Phase 32 migrations include:

- `20260920164729 — phase32_logistics_shipping_foundation`
- `20260920172851 — phase32_return_logistics_fields`
- `20260920173200 — phase32_return_request_events`
- `20260920175922 — phase32_rto_ndr_tracking_fields`

### Migration-source-control reconciliation

The repository history was checked directly.

A Phase 32 logistics foundation source file exists in GitHub as:

`20260920170000_phase32_logistics_shipping_foundation.sql`

while Supabase records the applied migration version as:

`20260920164729_phase32_logistics_shipping_foundation`

The source was structurally compared with the live logistics foundation schema and matches the shipment/shipment-events/shipping-pickups foundation model.

The later applied Phase 32 migrations are not currently present in the GitHub migration tree, and their exact SQL was not recoverable from the repository history exposed by GitHub:

- `20260920172851_phase32_return_logistics_fields`
- `20260920173200_phase32_return_request_events`
- `20260920175922_phase32_rto_ndr_tracking_fields`

No guessed or fabricated migration files will be added.

- [ ] Exact source recovery / reconciliation remains pending.

## 3. Database / RLS

- [x] RLS is enabled on all inspected public tables.
- [x] Existing public-table policies have guards.
- [x] Secure order creation RPC exists.
- [x] Seller/admin role architecture exists.
- [x] Private RLS helper schema exists.
- [x] Authorization-boundary test SQL exists in `supabase/tests/`.
- [x] Live logistics tables/columns were checked against the Phase 32 foundation source.
- [x] Duplicate `products(category_id)` index was removed from the live database and recorded as a migration.

## 4. Authorization verification

- [x] Customer-context SQL authorization test rejects `admin_list_categories()`.
- [x] Admin-context SQL authorization test succeeds.
- [x] SECURITY DEFINER functions were inspected for explicit authentication and role/ownership checks where required.
- [ ] Dedicated real seller test-account browser verification.
- [ ] Dedicated real admin browser verification.
- [ ] Complete customer signup/login/profile browser verification.

## 5. Security Advisor

Current Security Advisor findings:

- 23 authenticated-executable SECURITY DEFINER warnings.
- 1 leaked-password-protection warning.

The SECURITY DEFINER findings are intentional RPC architecture in which the functions perform their own authentication/role/ownership checks, but they remain Advisor findings and require final review/sign-off.

Leaked-password protection remains disabled/unavailable on the current project configuration. It must not be marked enabled without actual verification.

- [ ] Final SECURITY DEFINER review/sign-off.
- [ ] Leaked-password protection remains a pending security item until the project configuration/plan permits and the feature is actually enabled and verified.

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

- [x] Courier/return functions are JWT-protected.
- [x] AI assistant intentionally allows guest access and has server-side behavior.
- [ ] Authenticated browser E2E verification remains pending.

## 7. Logistics verification

- [x] Shipment/return database foundation exists.
- [x] Courier Edge Functions exist.
- [x] Customer tracking foundation exists.
- [x] Seller/admin logistics UI exists.
- [ ] Real provider shipment creation.
- [ ] Real AWB generation verification.
- [ ] Real pickup confirmation verification.
- [ ] Real tracking update verification.
- [ ] Full real Shiprocket shipment → AWB → pickup → tracking E2E.
- [ ] Current `shipments` table has 0 rows; no fake shipment data will be inserted.

## 8. Mobile / PWA

- [x] iOS project package job in mobile workflow `35632593142` succeeded.
- [x] Android debug APK/release AAB job succeeded; artifacts uploaded.
- [ ] Interactive physical-device QA.
- [ ] Mobile regression verification across real device flows.

## 9. Latest Phase 0 cleanup

- [x] Duplicate `products(category_id)` index removed.
- [x] Matching migration applied and source-controlled.
- [x] Private `is_admin`/`is_seller` helper authorization boundary rechecked.
- [x] Anonymous execution denied; authenticated execution required for the helper architecture.

## 10. Pending list — carried forward

### Blocked by current tool/device access
1. Live browser QA of the current website.
2. Full browser customer/seller/admin E2E.
3. Physical-device mobile QA.
4. Real Shiprocket production shipment → AWB → pickup → tracking E2E.

### Repository / migration reconciliation
5. Recover exact SQL/source for the three later Phase 32 migrations.
6. Reconcile the Phase 32 logistics migration filename/version mismatch without fabricating history.

### Security
7. Final review/sign-off of the 23 intentional SECURITY DEFINER Advisor findings.
8. Enable and verify leaked-password protection when the project configuration supports it.

### Final gate
9. Re-run/verify the latest GitHub Pages deployment after the current audit update.
10. Complete the Phase 0 exit checklist and sign-off only after the evidence-backed blockers are cleared.

## 11. Work completed remotely vs pending

The remotely actionable database/security/repository cleanup currently available has been completed without creating fake data or weakening authorization.

The remaining list is preserved explicitly so later phases are not started by mistake.

**Phase 1 remains blocked until Phase 0 exit evidence is complete.**

## 12. Exit rule

Phase 0 is **PASS** only when all required verification items above are actually tested and evidenced.

Until then:

**DO NOT START PHASE 1.**
