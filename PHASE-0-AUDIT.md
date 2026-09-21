# Apna Store — Phase 0 Foundation & Security Audit

Date: 2026-09-21

## Phase 0 objective
Finish Foundation, Security, Authorization, Deployment, Migration, and production-readiness verification before starting Phase 1.

**Current status: NOT COMPLETE / NOT SIGNED OFF.**

Phase 1 must not start until the remaining verification blockers below are actually completed.

## 1. GitHub / repository
- [x] Repository: `yash009675-pixel/Apna-Store`
- [x] Default branch: `main`
- [x] Phase 0 audit commit is current.
- [x] GitHub Pages workflow exists and validates JavaScript before deployment.
- [x] Pages workflow has required Pages permissions.
- [x] No frontend secret values found in inspected repository files.
- [x] Latest audit update deployment run `35633479822` was triggered from commit `62af7274e23f887e3da1307a83fae05f6f492ac6`.
- [x] The latest audit update is queued/in progress in GitHub Actions; it must not be called successfully deployed until completion is observed.
- [ ] Live-site browser verification.
- [ ] Full browser end-to-end QA.

## 2. Supabase migration state
Project: `xxedwtmdylfufrfzyrdb`

Applied Phase 0/32 migrations include:
- `20260920164729 — phase32_logistics_shipping_foundation`
- `20260920172851 — phase32_return_logistics_fields`
- `20260920173200 — phase32_return_request_events`
- `20260920175922 — phase32_rto_ndr_tracking_fields`
- `20260921173528 — phase0_remove_duplicate_product_category_index`
- `phase0_revoke_legacy_overloads` — applied during this cleanup session.

The repository contains the Phase 32 logistics foundation source under a different timestamped filename, but the three later Phase 32 SQL files could not be recovered exactly from the available GitHub history. No guessed SQL was added.
- [ ] Exact source recovery/reconciliation of the three later Phase 32 migrations.
- [ ] Reconcile the logistics foundation filename/version mismatch without fabricating history.

## 3. Database / RLS
- [x] RLS enabled on inspected public tables.
- [x] Existing public policies have guards.
- [x] Secure order creation RPC architecture exists.
- [x] Seller/admin role architecture exists.
- [x] Private RLS helper schema exists.
- [x] Authorization test SQL exists.
- [x] Live logistics foundation schema checked.
- [x] Duplicate `products(category_id)` index removed and migration recorded.
- [x] Legacy overload `create_order_secure(jsonb,jsonb,text)` has EXECUTE revoked from public/anon/authenticated.
- [x] Legacy overload `seller_save_product(uuid,text,text,numeric,numeric,text,uuid,jsonb)` has EXECUTE revoked from public/anon/authenticated.

## 4. Authorization verification
- [x] Customer-context test rejects `admin_list_categories()`.
- [x] Admin-context test succeeds.
- [x] SECURITY DEFINER role/auth boundaries inspected.
- [ ] Dedicated real seller browser verification.
- [ ] Dedicated real admin browser verification.
- [ ] Complete customer signup/login/profile browser verification.

## 5. Security
- [x] All inspected intentional SECURITY DEFINER functions require authenticated execution where exposed.
- [x] Anonymous EXECUTE is denied for the inspected admin/seller/customer secure RPCs and private role helpers.
- [x] Legacy ambiguous overloads discovered during final review were revoked.
- [ ] Final SECURITY DEFINER Advisor sign-off.
- [ ] Leaked-password protection: currently unavailable/disabled on this project configuration; enable and verify only when supported.
- [ ] Re-run Security Advisor after the latest privilege cleanup and record the new finding count.

## 6. Edge Functions
- [x] Courier/return Edge Functions are JWT-protected.
- [x] AI assistant intentionally supports guest access.
- [ ] Authenticated browser E2E verification.

## 7. Logistics verification
- [x] Shipment/return DB foundation exists.
- [x] Courier Edge Functions exist.
- [x] Customer tracking foundation exists.
- [x] Seller/admin logistics UI exists.
- [ ] Real provider shipment creation.
- [ ] Real AWB generation.
- [ ] Real pickup confirmation.
- [ ] Real tracking update.
- [ ] Full real Shiprocket shipment → AWB → pickup → tracking E2E.
- [x] No fake shipment data created.

## 8. Mobile / PWA
- [x] iOS project package workflow succeeded.
- [x] Android debug APK/release AAB workflow succeeded.
- [ ] Physical-device QA.
- [ ] Mobile regression QA on real device.

## 9. Pending list
### Blocked by current access
1. Live browser QA.
2. Full customer/seller/admin browser E2E.
3. Physical-device mobile QA.
4. Real Shiprocket production E2E.

### Repository/history
5. Recover exact SQL for three later Phase 32 migrations.
6. Reconcile Phase 32 filename/version mismatch.

### Security
7. Final Security Advisor SECURITY DEFINER sign-off.
8. Leaked-password protection when supported.
9. Re-run Security Advisor after privilege cleanup.

### Final gate
10. Verify completion of latest Pages deployment.
11. Final Phase 0 exit checklist and sign-off.

## 10. Exit rule
Phase 0 is PASS only after the remaining evidence-dependent items are actually tested and evidenced.

**Phase 1 remains blocked until Phase 0 exit evidence is complete.**
