# Apna Store — Master Hold List

This is the intentional HOLD list. These items must NOT be treated as missing implementation, must NOT be repeatedly rebuilt, and must stay out of active phase work until the appropriate final/business-launch stage.

## ⏸️ HOLD — Complete Later

### 1. Final Business-Launch Mobile QA
Hold until the business is ready to launch and real-device testing is started.
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
- Customer, seller and admin mobile regression across completed phases
- Physical Android QA
- Physical iOS QA

Important: these features are already implemented where applicable. This hold is for final real-device/business-launch QA only.

### 2. Phase 32 Migration Source / Version Reconciliation
- Recover exact original Phase 32 migration source where possible.
- Reconcile migration filenames/versions with the live Supabase migration history.
- Do NOT guess or reconstruct the missing original source.
- Keep this on hold until the exact source/version can be recovered safely.

### 3. Online Payment / Final Payment Activation
- Keep online payment activation/production payment-provider E2E for the later/final stage.
- Do not fake payment success, refund success, payout success, or transaction records.
- COD/order foundation can continue independently.

### 4. Play Store Publishing
- Final Android production publishing is held until the final publishing stage.
- Release/build workflow may continue to be maintained, but actual store publishing stays on hold.

### 5. App Store Publishing
- Final iOS production publishing is held until the final publishing stage.
- iOS project/workflow preparation may continue, but actual store publishing stays on hold.

### 6. Leaked Password Protection
- Current Supabase project configuration does not have this protection available/enabled.
- Revisit during final security hardening when the project/provider configuration supports it.
- Do not claim it is enabled until verified.

### 7. Supabase Performance Advisor INFO Findings
- Existing unindexed-FK / unused-index INFO findings are intentionally not being blindly removed.
- Revisit during final performance/security review only after checking real query usage and side effects.
- Never delete working indexes solely to make Advisor counts smaller.

### 8. Intentional SECURITY DEFINER Advisor Warnings
- Existing authenticated SECURITY DEFINER functions are intentional parts of the secure RPC architecture.
- Keep them on hold for final security review.
- Do not blindly revoke SECURITY DEFINER, EXECUTE privileges, or secure RPC architecture just to remove Advisor warnings.
- Any final change must preserve server-side authorization and RLS behavior.

## Rules for this Hold List

1. Do not re-add these items as ordinary implementation-pending work.
2. Do not rebuild already-working features.
3. Do not remove a working feature just to satisfy an Advisor warning.
4. Complete these only when the appropriate final/business-launch stage arrives.
5. When the user asks for the "master hold list" or says it is time to finish the held work, use this file as the source of truth and verify each item before closing it.
6. Phase 60 — Warehouse Management — is permanently REMOVED and is NOT a hold item. Never re-add it.
