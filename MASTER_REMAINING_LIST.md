# Apna Store — Master Remaining List

Last updated after Phase 16.

This file is the single working source for unfinished work. It separates active pending QA/implementation from intentional HOLD items. Completed work must not be re-added.

## 🟡 PENDING — Active Remaining QA / Verification

### Phase 0 / Final Foundation
- Live browser QA / GitHub Pages live verification
- Customer signup/login/profile browser QA
- Customer end-to-end flow
- Seller browser authorization QA
- Admin browser authorization QA
- Authenticated Edge Function browser E2E
- Real Shiprocket E2E: order → shipment creation → AWB → pickup → tracking → events
- Final SECURITY DEFINER review
- Security Advisor final re-check
- Final Phase 0 gate/sign-off

### Phase 5 — Product Image System
- Real seller authenticated image-upload E2E
- Drag/drop image E2E
- Variant-specific image E2E
- Reorder/delete/primary browser E2E

### Phase 6 — Seller Listing Center
- Real seller create listing E2E
- Edit listing E2E
- Image + variants + stock save E2E
- CSV import E2E
- Bulk actions E2E
- Approval/rejection E2E

### Phase 7 — Inventory Center
- Real seller stock adjustment E2E
- Inventory movement-history E2E

### Phase 8 — Seller Order Management
- Real seller login/order-open E2E
- Seller lifecycle/status update E2E
- Status history save/read E2E
- Real courier/Shiprocket shipment E2E

### Phase 9 — Courier & Pickup Engine
- Real authenticated seller Courier Center test
- Real Shiprocket serviceability test
- Real shipment creation → AWB
- Real pickup scheduling
- Real tracking/event sync
- Real courier lifecycle E2E

### Phase 10 — Live Delivery Tracking
- Customer live tracking refresh browser QA
- Real Shiprocket tracking lifecycle E2E (shared with Phase 0; do once, then mark all linked items complete)

### Phase 11 — Returns / Exchange / Refund
- Verify latest Phase 11 deployment
- Customer return/exchange/refund timeline browser QA
- Admin refund-status workflow browser QA
- Real payment-provider refund E2E
- No refund is marked successful without actual provider evidence

### Phase 12 — Verified Reviews & Ratings
- Verify latest Phase 12 deployment
- Genuine delivered-order review submission E2E
- Verified Purchase badge + rating aggregation browser QA
- Duplicate-review prevention E2E

### Phase 13 — Customer Account / Profile
- Real customer Account/Profile browser QA
- Address add/edit/delete/default real-user QA

### Phase 14 — Coupon System
- Admin real coupon create/edit/deactivate E2E
- Seller real coupon create/edit/deactivate E2E
- Product/category scope E2E
- First-order restriction E2E
- Per-user usage-limit E2E
- Checkout real coupon application + final order E2E
- Coupon analytics/history real redemption verification

## 🟡 PENDING — Phase 15 Seller Payments
- Real seller Payments/Earnings browser QA
- Seller commission calculation QA with real delivered order data
- Seller settlement generation QA
- Seller payout request QA
- Admin commission-management QA
- Admin settlement/approval QA
- Admin payout status workflow QA
- Invoice generation QA
- Real payment-provider/bank payout E2E remains a final-stage/hold item; never mark payout paid without provider evidence

## 🟡 PENDING — Phase 16 Seller Growth / Insights
Implementation, Supabase foundation, analytics tracking, and GitHub Pages deployment are complete. Real seller/browser QA remains because the project currently has no genuine seller profile available for an authenticated seller session.
- Real seller Growth & Insights browser QA
- Real product-view tracking E2E
- Sales / units / orders / revenue metric verification with genuine seller data
- Visitor / product-view / conversion metric verification with recorded traffic
- Hourly / daily / weekly / monthly / yearly chart verification
- Previous-period comparison verification
- Product performance table verification
- Business-insight messaging verification

## 🟡 PENDING — Phase 17 Search Trends
Implementation, real search-event tracking, secure aggregation RPC, and GitHub Pages deployment are complete. Real activity QA remains because current search-event data is empty until customers perform genuine searches.
- Real customer search submission E2E
- Popular-search verification
- Rising-search comparison verification
- Zero-result search verification
- Category-demand verification from actual matched products
- Seller-product demand verification
- Keyword-trend verification

## 🔴 PENDING IMPLEMENTATION
- No additional implementation item is currently confirmed from the recovered roadmap after Phase 15.
- Before starting each next phase, recover that phase's exact master-roadmap requirements and inspect GitHub + Supabase first. Do not assume a feature is missing.

## ⏸️ HOLD — Complete Later / Final Stage

### Business-launch / Final Mobile QA
- Product Detail opens correctly
- Product images/gallery
- Variant selection
- Add to Bag
- Reviews section
- Star rating
- Review form
- Verified Purchase badge
- Long review text
- Buttons/touch targets
- Page scrolling
- No horizontal overflow
- No duplicate Reviews section
- Login/session behavior
- Different screen sizes/orientations where possible
- Customer mobile regression
- Seller mobile regression
- Admin mobile regression
- Physical Android QA
- Physical iOS QA

These are already implemented where applicable. Hold is for final real-device/business-launch QA, not implementation.

### Phase 32 Migration Source / Version Reconciliation
- Recover exact original Phase 32 migration source where possible
- Reconcile migration filenames/versions with live Supabase history
- Never guess/reconstruct missing source

### Online Payment / Final Payment Activation
- Final production payment-provider activation and E2E
- Never fake payment success, refund success, payout success, or transaction records

### Store Publishing
- Google Play Store final publishing
- Apple App Store final publishing

### Supabase Security / Performance Final Review
- Leaked Password Protection when available in project configuration
- Performance Advisor INFO findings after real usage/query review
- Intentional SECURITY DEFINER Advisor warnings after final security review
- Do not blindly revoke secure RPC privileges or delete indexes

## Permanently Removed
- Phase 60 — Warehouse Management — permanently removed; never re-add.

## Tracking Rules
1. 🟢 Completed means implementation + required deployment/verification evidence exists.
2. 🟡 Pending means active QA/verification remains.
3. 🔴 Pending Implementation means actual development remains.
4. ⏸️ Hold means intentionally postponed; do not treat it as active implementation work.
5. Do not duplicate the same task across phases; cross-reference shared E2E work instead.
6. Do not rebuild an already-working feature.
7. Do not create fake data or fake provider/payment/courier success.
8. After every phase, update this file so small and large remaining tasks are preserved.
9. When the user asks for the final remaining work, return both Pending and Hold lists together.
