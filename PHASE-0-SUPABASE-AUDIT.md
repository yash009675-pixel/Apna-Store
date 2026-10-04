# Apna Store — PHASE 0 SUPABASE AUDIT

Date: 2026-10-04
Repository: `yash009675-pixel/Apna-Store`
Branch: `arena/01a105e1-apna-store` @ `4c70d3b`
Scope: **read-only inspection of the Supabase integration. Nothing was modified.**

> Companion to `PHASE-0-FULL-AUDIT.md` (product/feature audit). This document covers the backend integration only.

---

## 0. Verification limits — read this first

This audit is **source-derived, not live-derived**.

- The sandbox has **no outbound network to `*.supabase.co`**. No live query, no `pg_catalog` read, no Auth call, no Edge Function invocation, no Security Advisor run was performed.
- Everything below is read from: 63 SQL migrations, 4 backend SQL files, 5 Edge Function sources, and 60 frontend JS files.
- Statements about *live* state are quoted from the existing **`PHASE-0-AUDIT.md` (2026-09-21)** and **`SECURITY.md`**, and are marked as such. They are **not re-verified** here and may have drifted.
- Items marked **[NEEDS LIVE CHECK]** must be confirmed in the Supabase dashboard or SQL editor before being relied upon.

---

## 1. Current Supabase project / configuration

| Item | Value | Source |
|---|---|---|
| Project ref | `xxedwtmdylfufrfzyrdb` | `backend/supabase-client.js` |
| Project URL | `https://xxedwtmdylfufrfzyrdb.supabase.co` |同上 |
| Browser key | `sb_publishable_hYQybdzwpuTiT1CA7ZE0EA_SRHPyCOS` |同上 |
| Key type | **Publishable key** (`sb_publishable_…`) — the newer, intentionally-public key format, not the legacy JWT anon key | inferred from prefix |
| Service-role key | **Not present anywhere in the repo** ✅ | verified by inspection |
| Client construction | `backend/supabase-client.js` — one shared `window.apnaSupabase` instance | verified |
| Auth options | `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`, `storage: localStorage` | verified |
| Storage key | **Deliberately left at the Supabase default** — changing it would sign every existing user out. Comment in the file forbids it. ✅ | verified |
| iOS/PWA handling | `visibilitychange` listener calls `startAutoRefresh()`; refresh failures are logged, never converted to a logout ✅ | verified |

**Hardcoded endpoint duplication** — the project URL is repeated outside the client:

| Location | Value | Assessment |
|---|---|---|
| `visual-search.js` | `https://xxedwtmdylfufrfzyrdb.supabase.co/functions/v1/apna-ai-assistant` | hard-coded |
| `support-center.js` | `…/functions/v1/apna-ai-assistant` | hard-coded |
| `order-detail.js` | `…/functions/v1/apna-courier-track` | hard-coded, and the function has **no source in the repo** |
| `courier-center.js` | `…/functions/v1/apna-courier-v3` | hard-coded |

Not a security issue (public URL), but a maintainability risk: the client already exposes `window.APNA_SUPABASE_CONFIG.url`, so these should use it.

---

## 2. Environment variable usage

Frontend: **zero** `process.env` / `import.meta.env` usage. All configuration is committed. ✅

Edge Functions — 10 distinct secrets/vars, all read via `Deno.env.get()` (✅ no hard-coded secrets):

| Variable | Used by | Sensitivity |
|---|---|---|
| `SUPABASE_URL` | all 5 functions | platform-provided |
| `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY` | `apna-ai-assistant`, `apna-courier-v3` | platform-provided (both names handled — good forward-compat) |
| `SUPABASE_SERVICE_ROLE_KEY` | `apna-data-export`, `apna-notification-email`, `apna-public-api-v1` | **CRITICAL — full DB bypass** |
| `OPENAI_API_KEY` (also accepts lowercase `openai_api_key`) | `apna-ai-assistant` | **CRITICAL — billable** |
| `SHIPROCKET_API_EMAIL`, `SHIPROCKET_API_PASSWORD` | `apna-courier-v3` | **CRITICAL — courier account** |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | `apna-notification-email` | **CRITICAL — email sending** |

Assessment: secret hygiene is **correct**. Nothing sensitive is in the repo; the three functions that use the service-role key are the ones that genuinely need it (per-user export, notification drain, API-key lookup), and all three authenticate the caller before use.

---

## 3. Auth flow

**Sign-up / sign-in (`auth.html` + `auth.js`)**
1. Email + password — `signUp()` / `signInWithPassword()`
2. Google OAuth — `signInWithOAuth({ provider: "google", redirectTo: location.origin + location.pathname })`
3. OTP — `verifyOtp()`, with resend controls (`auth.js` references resend 8×)
4. OAuth errors surfaced from `?error_description=` / `?error` query params
5. Referral capture — `?ref=` stored to `localStorage.apnaReferralCode`
6. `onAuthStateChange` catches the OAuth `SIGNED_IN` event and runs the same post-auth path

**Post-auth (`finishAuthenticatedUser` → `routeUser`)**
1. `claimReferral(userId)` → RPC `claim_referral_code`
2. `migrateGuestWishlist(userId)` → validates product IDs against `products` (`status='active'`), upserts to `wishlists`, prunes unsynced entries from `localStorage`
3. Reads `profiles.role` **server-side** → `admin` + email `withapnastore@gmail.com` → `admin.html`; everyone else → `account.html`
4. Return-destination is whitelisted to `checkout.html` / `account.html` via `sessionStorage.apnaReturnAfterAuth` — **an explicit open-redirect guard** ✅

**Profile bootstrap**
`public.handle_new_user()` — a trigger on `auth.users`. Defined **only in `backend/rls.sql`** (lines 259–281), with `revoke execute … from public, anon, authenticated` (line 319). The equivalent live migration is `20260919124328_add_profile_signup_trigger_and_role_helpers`, which is **pre-mirror baseline and has no source file in the repo**. **[NEEDS LIVE CHECK]** that the deployed trigger still matches `backend/rls.sql`.

**Session handling elsewhere**
- `account.js`, `admin*.js` — `getSession()` then `profiles` lookup
- `notifications.js` — `getUser()`
- `auth.js` — never trusts a client-supplied role ✅

---

## 4. Role model & access

Three roles in `profiles.role`, constrained `('customer','seller','admin')` (`backend/schema.sql:11`).

Role helpers live in the **`private`** schema — `backend/rls.sql:5-7, 289-317`:

```sql
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

private.is_admin()  -- profiles.role = 'admin'
private.is_seller() -- profiles.role IN ('seller','admin')
```
Both are `SECURITY DEFINER` + `set search_path = public` + `stable`, granted to `authenticated` only. ✅

### Customer
- Default on signup; **`profiles` insert policy is `with check (… role = 'customer')`**, so a user cannot self-promote ✅
- Owns: `orders`, `order_items` (via order), `addresses`, `wishlists`, `notifications`, `notification_preferences`, `reviews`, `support_tickets`, `return_requests`, `data_export_jobs`
- Orders are **read-only after creation** — creation is exclusively via `create_order_secure`
- Can cancel via `customer_cancel_order` (status-gated)

### Admin
- Enforced **three ways**: `private.is_admin()` in RLS, `raise exception 'Admin access required'` inside every admin RPC, and a client-side `profiles.role !== 'admin'` redirect on admin pages
- Client-side gating verified present in: `admin.js`, `admin-products.js`, `admin-orders.js`, `admin-logistics.js`, `admin-store.js`, `phase33-risk-engine.js`
- **NOT present in `admin-membership.js`** — it has no role check and no redirect; it relies entirely on `get_admin_membership_plans` being revoked from `public`/`anon`. Functionally safe (RLS/RPC is the real gate) but the UX degrades to an error message rather than a redirect. **[POLISH]**
- Special case: `auth.js` routes the owner (`admin` + `withapnastore@gmail.com`) to `admin.html`; any other admin falls through to `account.html`

### Seller — **RETIRED**
Migration `20261001113310_retire_marketplace_runtime_functions.sql` drops **every** `public.seller%` function (except `seller_growth_insights` / `seller_search_trends`, which it first clones to `admin_*` and then drops).

Consequences:
- `private.is_seller()` still exists and still counts `'seller'` — **now unreachable, since nothing can create a seller** (no onboarding UI, `seller_applications` table has no source migration, sign-up forces `role='customer'`)
- `courier-center.js:3` still accepts `['seller','admin']`
- `reviews.js:14` still gates on `role === 'seller'`
- `seller_store_profiles` still has an **anon-readable** policy (`seller_store_profiles_public_read … to anon, authenticated`) and an anon `SELECT` grant — leftover from the marketplace era
- `admin_catalog_cleanup` (20261001113347) supplies the admin replacements: `admin_save_listing`, `admin_set_listing_status`, `admin_delete_listing`, `admin_duplicate_listing`, `admin_bulk_update_listings`

---

## 5. Database schema

**63 migrations**, `20260919220000_fix_public_catalog_rls.sql` → `20261001113347_admin_catalog_cleanup.sql`.

| Metric | Count |
|---|---|
| Tables created in repo migrations | **56** |
| Tables with `enable row level security` | **57** |
| RLS policies (parsed) | **62** |
| `public.*` functions — SECURITY DEFINER | **101** |
| `public.*` functions — SECURITY INVOKER | **11** |
| SECURITY DEFINER functions **missing** `search_path` | **0** ✅ |

Migration discipline (from `supabase/README.md`) is sound: timestamped, idempotent (`if exists` / `if not exists`), committed with the code that depends on them, and rule 5 explicitly forbids reconstructing pre-mirror history.

### Important tables

| Domain | Tables |
|---|---|
| Identity | `profiles` |
| Catalog | `products`, `product_variants`, `product_images`, `categories`, `brands` |
| Commerce | `orders`, `order_items`, `addresses`, `wishlists`, `coupons`, `coupon_usages`, `coupon_categories`, `coupon_products` |
| Content | `reviews`, `review_images`, `review_helpful_votes`, `review_reports`, `seller_review_responses` |
| Logistics | `shipments`, `shipment_events`, `shipping_pickups`, `seller_order_status_events` |
| Growth | `notifications`, `notification_preferences`, `notification_deliveries`, `marketing_campaigns`, `feature_flags`, `search_events`, `analytics_events` |
| Money | `memberships`, `membership_plans`, `membership_transactions`, `ad_campaigns`, `ad_events`, `ad_spend_entries` |
| Trust | `risk_flags`, `trust_safety_cases`, `audit_logs` |
| Support | `support_tickets`, `support_ticket_messages`, `support_ticket_attachments`, `help_articles` |
| Platform | `webhook_endpoints`, `webhook_events`, `webhook_deliveries`, `background_jobs`, `background_job_runs`, `data_export_jobs`, `api_clients`, `integration_connections`, `recovery_checkpoints` |
| Ops | `inventory_movements`, `partner_services`, `seller_store_profiles`, `seller_academy_articles`, `shipping_pickups` |

### ⚠️ Tables used by the frontend with **no source migration in the repo** (6)

`notifications`, `return_requests`, `return_request_events`, `marketing_campaigns`, `newsletter_subscriptions`, `customer_follows`

These exist live (the frontend reads/writes them and migrations reference them — e.g. `20260920132936` revokes on `public.notifications`, `20260921190000` alters `notifications_read_own`). They belong to the **pre-mirror baseline**, along with `coupons` and `seller_applications` (both appear in RLS/policy lists but have no `create table` in the repo).

`return_requests` / `return_request_events` specifically correspond to the three Phase 32 migrations documented in `PHASE-0-AUDIT.md` as applied-live-but-source-lost. **Do not reconstruct them.**

---

## 6. RLS policies

62 parsed policies, by granted role:

| Granted to | Policies | Character |
|---|---|---|
| `authenticated` | 51 | owner-or-admin predicates |
| `anon, authenticated` | 8 | intentional public reads + analytics inserts |
| `anon` | 3 | intentional public reads |

**Intentional anonymous access** (all legitimate for a public storefront):

| Target | Purpose |
|---|---|
| `feature_flags` SELECT | client-side flag evaluation (`feature-flags.js`) |
| `product_images` SELECT | public catalog imagery |
| `seller_store_profiles` SELECT | public store profile |
| `reviews` SELECT | moderated reviews only (`moderation_status='approved'`) |
| `search_events` INSERT | anonymous search analytics |
| `analytics_events`, `search_events` (table grants) | telemetry |

**Notable hardening**
- `notifications`: `revoke all … from anon`; `revoke insert, delete, truncate, references, trigger … from authenticated` → users can never forge or delete their own notifications, only read/mark-read ✅
- `reviews`: `moderation_status='approved' OR user_id = auth.uid() OR private.is_admin()` ✅
- `shipments` / `shipment_events` / `shipping_pickups`: owning customer, owning seller, or admin ✅
- `product_images`: **9 policies** — public read, plus write restricted to admin **or** the owner's first-level UUID folder (`(storage.foldername(name))[1] = auth.uid()::text`) ✅
- Phase 0 cleanup `20260921190000` wrapped policy predicates in `(select auth.uid())` for initplan caching — Adviser auth-initplan warnings **6 → 0**

**Residual**: 207 vs 127 occurrences of bare vs wrapped `auth.uid()` across all SQL (crude count; the Phase 0 cleanup only touched the flagged subset). Adviser reported **6 INFO unindexed-FK** and **26 INFO unused-index** findings — deliberately left alone. **[NEEDS LIVE CHECK]** current Adviser state.

---

## 7. RPC / database functions

**101 SECURITY DEFINER + 11 SECURITY INVOKER** in `public`. **Every SECURITY DEFINER function sets `search_path` — 0 missing.** ✅

Grant discipline is the right pattern and is applied consistently:

```sql
revoke all on function public.<fn>(<args>) from public, anon, authenticated;
grant  execute on function public.<fn>(<args>) to authenticated;
```

Two layers: revoke first (kills the default `PUBLIC` grant), then grant narrowly to `authenticated` only. Authorization *inside* the function is then enforced by role checks, not by the grant.

Categories:

| Category | Examples | Mode |
|---|---|---|
| **Ordering (critical)** | `create_order_secure`, `customer_cancel_order`, `update_seller_order_status` | DEFINER |
| **Admin catalogue** | `admin_save_listing`, `admin_set_listing_status`, `admin_delete_listing`, `admin_duplicate_listing`, `admin_bulk_update_listings`, `admin_adjust_inventory` | DEFINER + `raise exception 'Admin access required'` |
| **Admin read/ops** | `admin_list_reviews`, `admin_moderate_review`, `admin_list_risk_flags`, `admin_refresh_risk_flags`, `admin_update_risk_flag`, `admin_list_audit_logs`, `admin_observability_summary` | DEFINER, revoked from anon |
| **Customer-scoped money** | `get_wallet`, `get_wallet_transactions`, `redeem_points_to_wallet`, `get_my_rewards`, `preview_coupon`, `start_membership_purchase`, `get_my_membership` | mixed |
| **Reviews** | `create_review_secure` (DEFINER), `review_add_helpful_vote` / `review_remove_helpful_vote` (INVOKER), `reviews_protect_immutable_fields` (DEFINER trigger) | hardened |
| **Notifications** | `mark_notification_read`, `set_notification_preference`, `queue_notification_email_delivery`, `queue_notification_push_delivery` | INVOKER, authenticated-only |
| **Audit / platform** | `record_audit_event`, `audit_row_change`, `enqueue_webhook_event`, `dispatch_webhooks`, `reconcile_webhook_deliveries`, `run_background_job` | DEFINER, revoked from public/anon/authenticated where internal |

**Frontend calls ~70 distinct RPCs.** All the security-sensitive money paths are server-side (`create_order_secure`, `preview_coupon`, `redeem_points_to_wallet`, `start_membership_purchase`), so **no total, discount, or balance is ever computed in the browser**. ✅

---

## 8. Edge Functions

**In repo (5):**

| Function | Auth | Notes |
|---|---|---|
| `apna-ai-assistant` | **Guest allowed (intentional)** | 20 req/min per IP; JWT passed through to personalise; catalog + orders + shipments injected; prompts forbid fabrication |
| `apna-courier-v3` | JWT + `seller`/`admin` role check | Shiprocket: auth, serviceability, pickup locations, AWB, label, manifest, track. Credentials server-side only ✅ |
| `apna-data-export` | JWT; service-role client | Per-user scoping; job row written with status; JSON + CSV; CSV escaping present ✅ |
| `apna-notification-email` | service-role | Drains `notification_deliveries` via Resend; **degrades gracefully** if `RESEND_API_KEY` unset ✅ |
| `apna-public-api-v1` | `x-api-key` (`aps_…`), SHA-256 hash lookup, `catalog:read` scope | Tracks `last_used_at` ✅ |

**Invoked by the frontend but absent from the repo (4):**
`apna-courier-actions`, `apna-courier-return-create`, `apna-courier-track` (2 call sites), `apna-return-actions`

`PHASE-0-AUDIT.md` §6 states "Courier/return Edge Functions are JWT-protected", implying these **are deployed live**. The repo is therefore **not a complete source of truth for deployed functions**. **[NEEDS LIVE CHECK]** — confirm they exist, are JWT-gated, and backfill their source into `supabase/functions/`.

---

## 9. Storage

| Bucket | Defined in repo? | Public | Size limit | MIME allowlist | Policies |
|---|---|---|---|---|---|
| `product-images` | ❌ **no** (pre-mirror baseline) | yes | — | — | 9 policies: public read; write = admin **or** owner UUID folder |
| `review-images` | ✅ `20260923140000` | yes | 5 MB | jpeg/png/webp | read `to public`; insert = owner folder; update = `owner_id = auth.uid()` |
| `support-attachments` | ✅ | — | — | — | used by `support-center.js` |

Policy pattern used throughout: `(storage.foldername(name))[1] = (select auth.uid())::text` — first path segment must be the caller's own UUID. ✅ This is the correct Supabase pattern.

⚠️ `product-images` has **no source migration in the repo**. `SECURITY.md` confirms the policies were reviewed live ("Product image storage policies restrict authenticated users to their own first-level UUID folder"), and later migrations (`20260922065603`) `DROP` and recreate them — so they are managed, just not fully sourced. **Do not recreate from memory.**

---

## 10. Ecommerce data flow

```
catalog read (anon OK)
  products / product_variants / product_images / categories / brands
        │  RLS: active-status + anon SELECT
        ▼
cart  ── localStorage "apnaCart" (guest-friendly, no DB write)
  cart.js: syncCartWithCatalog() re-validates price/stock/status
  against product_variants on every load, clamps qty, drops dead items
        ▼
checkout ── coupon: RPC preview_coupon(p_items, p_code)   [server-side money]
         ── delivery prefs: get/save_customer_delivery_preferences
         ── order: RPC create_order_secure(p_items, p_shipping,
                                           p_payment_method, p_coupon_code)
        ▼
create_order_secure (SECURITY DEFINER)
  ✓ auth.uid() required
  ✓ SELECT … FOR UPDATE on products + product_variants
  ✓ rejects qty > stock
  ✓ server-computed subtotal / delivery_fee (free ≥ ₹999) / total
  ✓ order_number generated server-side ('APNA-' + 8 hex)
  ✓ inserts addresses → orders → order_items
  ✓ decrements stock with `WHERE stock >= v_qty` (re-checks, re-raises)
  ✓ payment_method restricted to 'cod'
        ▼
orders / order_items  (user-scoped RLS; read-only to customer)
```

All money logic is server-side. ✅ No fake prices, totals, discounts or stock anywhere.

---

## 11. Order / payment / logistics data flow

**Order status** — `orders.status` (placed → … → delivered/cancelled/returned/refunded), `orders.delivery_status`, and a separate `seller_order_status` (New / Accepted / Packing / …) tracked in `seller_order_status_events`.

**Payment** — currently **COD only**:
- `create_order_secure` raises on any method other than `'cod'`
- `checkout.html` renders Online Payment as `disabled` + "Coming soon"
- Gift-card field carries "not charged or applied yet"
- Columns already exist for a real gateway: `payment_status`, `payment_method`, `payment_provider`, `payment_reference`, `paid_at`, `refund_status`, `refund_amount`, `refund_reference`, `refund_processed_at`, and a `payment_transactions` table is referenced in policy names (`payment_transactions_owner_read`)
- **No payment gateway is wired. No transaction is ever created. No fake payment or refund is written.** ✅

**Logistics** — foundation complete, provider not exercised:
- `shipments` (direction outbound/return/rto, provider, `provider_shipment_id`, `awb_number`, `pickup_id`, 13-state status, tracking/label/invoice URLs, NDR + RTO fields)
- `shipment_events` (event_code, status, description, location, `raw_provider_event`)
- `shipping_pickups` (5-state, `provider_pickup_id`, unique on `(provider, provider_pickup_id)`)
- `apna-courier-v3` implements the full Shiprocket surface and writes real provider responses back
- `order-detail.js` reads `shipments` + `shipment_events`, and calls `apna-courier-track` to refresh — **that function has no source in the repo**
- Per `PHASE-0-AUDIT.md` §7: live Supabase has **0 shipments, 0 shipment events, 0 pickup records**. **No fake AWB, tracking event, or courier data exists.** ✅
- Real Shiprocket E2E (create → AWB → pickup → tracking) remains **unverified**

**Returns** — `return_requests` + `return_request_events` (no source migration). Flow: customer requests (delivered-only, duplicate-blocked) → admin approves via `return-management.html` → reverse shipment linked → refund status tracked. `refund_order_to_wallet` exists.

---

## 12. Security-sensitive functions

| Function | Why sensitive | Control |
|---|---|---|
| `create_order_secure` | writes orders, decrements stock, sets totals | DEFINER, `search_path` set, `auth.uid()` enforced, `FOR UPDATE` locking, revoked from anon ✅ |
| `private.is_admin()` / `is_seller()` | role oracle behind every policy | `private` schema, revoked from public/anon, granted to authenticated only ✅ |
| `handle_new_user()` | trigger on `auth.users`, creates profile | revoked from public/anon/authenticated ✅ |
| `admin_*` catalogue RPCs | mutate the catalogue | `raise exception 'Admin access required'` first statement ✅ |
| `redeem_points_to_wallet` | converts points → money | server-side conversion, authenticated only |
| `start_membership_purchase` | creates a purchase intent | returns `payment_required`; explicitly does **not** activate ✅ |
| `record_audit_event` / `audit_row_change` | audit trail integrity | DEFINER, revoked from public/anon/authenticated |
| `dispatch_webhooks` / `enqueue_webhook_event` | outbound HTTP from the DB | DEFINER, internal-only grants |
| Edge Functions using `SUPABASE_SERVICE_ROLE_KEY` | full RLS bypass | all three authenticate the caller first, and scope/service-role use narrowly ✅ |
| `apna-ai-assistant` | only **unauthenticated** entry point | rate-limited 20/min/IP, input truncated (`clean()`), prompts forbid fabrication, no write access ✅ |

---

# Classification

## ✅ WORKING

Browser client & session handling · publishable-key-only config (no service-role key in the repo) · secret hygiene in Edge Functions (all via `Deno.env.get()`) · email/password + Google OAuth + OTP auth · server-side role resolution and the open-redirect guard · customer data ownership across orders/addresses/wishlists/notifications/reviews/tickets · three-layer admin enforcement (RLS + in-function role check + client redirect) · `private` helper schema with correct revokes · **`search_path` set on 100% of SECURITY DEFINER functions** · revoke-then-grant discipline on RPCs · catalogue reads for anonymous visitors · `create_order_secure` (locking, server-authoritative totals, stock re-check) · COD-only enforcement with no fake payments · coupon/price logic server-side · logistics schema (shipments/events/pickups) with owner-or-admin RLS · `apna-courier-v3` Shiprocket integration with server-side credentials · `apna-data-export` per-user scoping · `apna-public-api-v1` key hashing + scope check · `apna-notification-email` graceful degradation · storage folder-UUID ownership policies · Realtime notifications channel scoped by `user_id=eq.<uid>` · 63 timestamped migrations with sound documented discipline

## ⚠️ PARTIALLY WORKING

| Area | Issue |
|---|---|
| Public API | `apna-public-api-v1` filters `products.status = 'approved'`, but the constraint is `draft\|active\|inactive\|pending_approval\|rejected\|archived`. **Always returns empty.** Fails safe, but non-functional |
| Reviews seller response | `reviews.js` calls `seller_respond_to_review`, dropped by `20261001113310`. Dormant (requires `role='seller'`, which no longer exists) |
| Admin membership page | No role check / no redirect — relies purely on the RPC being revoked from anon |
| Role helper | `private.is_seller()` is now dead code; nothing can grant `seller` |
| Storage sourcing | `product-images` bucket + its 9 policies have no source migration |
| Table sourcing | 6 frontend-used tables have no source migration |
| Edge Function sourcing | 4 invoked functions have no source in the repo |
| Historical SQL | `backend/schema.sql` / `rls.sql` no longer match the live schema (no `brands`, no `moderation_status`, different `products.status` enum, 3-arg vs 4-arg `create_order_secure`) |

## ❌ BROKEN

| Item | Evidence |
|---|---|
| `apna-public-api-v1` returns empty | invalid status enum value (see above) |
| `seller_respond_to_review` missing | dropped by migration; still called in `reviews.js:34` |
| `apna-courier-track` 404 risk | called by `order-detail.js`; likely deployed live but unconfirmed |
| `backend/secure-order.sql` signature drift | file defines 3 params; `checkout.js` sends 4 (`p_coupon_code`) |

## ➖ MISSING

Real payment gateway (COD only by design) · online-payment flow · product-images bucket source migration · source for 6 baseline tables · source for 4 Edge Functions · source for 3 Phase 32 return-logistics migrations · real Shiprocket production E2E · leaked-password protection (blocked on Supabase Free plan) · automated RLS regression test in CI (`supabase/tests/` exists but is manual) · seller surface (retired by design)

## 🔒 SECURITY-SENSITIVE — DO NOT TOUCH WITHOUT REVIEW

`private.is_admin()` / `is_seller()` · `handle_new_user()` trigger · `create_order_secure` · every `admin_*` RPC · `record_audit_event` / `audit_row_change` · webhook dispatch functions · all three service-role Edge Functions · `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `SHIPROCKET_*`, `RESEND_*` · storage policies on all three buckets · every `revoke … from public, anon, authenticated` line · the `storageKey` default in `backend/supabase-client.js`

## 🚫 MUST NOT BE TOUCHED AT ALL

1. **Any applied migration.** Never rewrite or reconstruct pre-mirror history (`supabase/README.md` rule 5). The live history is authoritative.
2. **The three lost Phase 32 migrations.** Documented as deliberately not reconstructed.
3. **`backend/schema.sql` / `backend/rls.sql`.** Historical reference only — do not "fix" to match live; that would fabricate history.
4. **Seller functionality.** Retired by `20261001113310`. Do not rebuild.
5. **`supabase-client.js` storage key.** Changing it signs out every existing user.

## 🔧 REQUIRES LATER CONTROLLED CHANGES

| # | Change | Risk | Gate |
|---|---|---|---|
| 1 | Fix `apna-public-api-v1` status filter → `active` | Low | New migration + Adviser re-run |
| 2 | Remove dead `seller_respond_to_review` call from `reviews.js` | Low | Code-only |
| 3 | Backfill source for the 4 missing Edge Functions | Medium | Must match deployed code exactly |
| 4 | Add role check + redirect to `admin-membership.js` | Low | Code-only |
| 5 | Replace hard-coded `xxedwtmdylfufrfzyrdb.supabase.co` URLs with `window.APNA_SUPABASE_CONFIG.url` | Low | Code-only |
| 6 | Remove/neutralise dead `private.is_seller()` + remaining `role='seller'` branches | Medium | Audit every RLS policy referencing `is_seller()` first |
| 7 | Reconsider anon-SELECT on `seller_store_profiles` (marketplace leftover) | Medium | Confirm no public page needs it |
| 8 | Wire a real payment gateway | **High** | Full security review; never client-side |
| 9 | Enable leaked-password protection | Low | Requires Supabase Pro |
| 10 | Add `supabase/tests/` to CI | Low | Needs a live DB |

---

## Build / verification result

| Gate | Result |
|---|---|
| Files inspected | 63 migrations, 4 backend SQL, 5 Edge Functions, 60 frontend JS |
| Service-role key in repo | **None found** ✅ |
| Hard-coded secrets in Edge Functions | **None found** ✅ |
| SECURITY DEFINER without `search_path` | **0** ✅ |
| Repo modifications made | **None** ✅ |
| Live Supabase verification | **NOT PERFORMED** — no network access to `*.supabase.co` |

**Items requiring the owner to confirm in Supabase:**
1. Current Security / Performance Adviser finding counts
2. Whether the 4 missing Edge Functions are deployed and JWT-gated
3. Whether the live `handle_new_user()` matches `backend/rls.sql`
4. Live row counts for `shipments`, `shipment_events`, `shipping_pickups` (should still be 0)
5. Whether any user still holds `role='seller'`
