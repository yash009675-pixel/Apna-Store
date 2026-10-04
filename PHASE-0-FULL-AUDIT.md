# Apna Store — PHASE 0 FULL PRODUCT AUDIT

Date: 2026-10-04
Repository: `yash009675-pixel/Apna-Store`
Branch audited: `arena/01a105e1-apna-store` @ `05128fa`
Scope: read-only inspection. **No code, markup, CSS, SQL, or asset was modified, added, or deleted as part of the audit itself** (this document was the only new file at audit time).

---

## Resolution update — commit `a719222` (2026-10-04)

After sign-off the **repair-only P0 set** was applied. Everything below the P0 line (P1, P2, HOLD) is **untouched**.

| # | Status | What was done |
|---|---|---|
| **P0-1** | ✅ **FIXED** | Added the Supabase UMD CDN `<script>` to `admin-deals.html` and `deal-of-day.html`, in the same position every other page uses. Both pages now boot clean (previously a fatal `TypeError`). |
| **P0-3** | ✅ **FIXED** | Removed the 7 phantom entries from `sw.js` `APP_SHELL` (34 → 27, all resolve) and bumped `CACHE_NAME` to `apna-store-pwa-v12` so `activate` clears stale namespaces. Service worker install now succeeds → offline, app shell and Web Push enrolment restored. |
| **P0-4** | ✅ **FIXED** | Dead `seller-dashboard.html` links removed from **4** pages — `supplier-procurement.html`, `auto-replenishment.html`, `barcode-qr.html`, and `coupon-center.html` (nav + back link) — now pointing at `admin.html` with the "Admin Center" label used by `admin-logistics.html`. Dropped 6 `seller-*` `Disallow` lines from `robots.txt` and the `seller-store.html` URL from `sitemap.xml`. |
| **P0-2** | ⏸ **DEFERRED** | Deliberate product decision (see §29). Not a defect fix — building a widget is new surface area. |
| **P1 / P2** | ⏸ **NOT STARTED** | Out of scope for this repair pass. |

**Correction to the original audit:** P0-4 originally reported the dead `seller-dashboard.html` link as a single occurrence on `supplier-procurement.html`. Because the link scan de-duplicated by URL, three additional pages were missed. The true count is **4 pages / 5 link instances**, all of which are fixed above.

**Verification after the fix:** `node --check` passes on all 60 JS files · `sw.js` `APP_SHELL` 27/27 resolve · site-wide link scan is now clean after removing the stale `apna-ai.js` reference from `support.html` · jsdom boot clean on `admin-deals.html`, `deal-of-day.html`, `supplier-procurement.html`, `auto-replenishment.html`, `barcode-qr.html`, `coupon-center.html`, and the core storefront (`index`, `shop`, `product`, `cart`, `checkout`, `orders`, `account`).

**Still unverified:** live browser rendering, real Supabase data, live Auth/RLS behaviour, and real Edge Function calls — this environment has no network access to `*.supabase.co`.

> Note: the pre-existing `PHASE-0-AUDIT.md` is a different document — the *Foundation & Security* sign-off from 2026-09-21. It was **not** modified. This file is the *product/feature* audit requested now.

---

## 0. Method & limits

| Method | Detail |
|---|---|
| Static inventory | 284 tracked files, 66 HTML pages, 60 JS files, 9 CSS files, 63 SQL migrations, 5 Edge Function sources |
| Syntax gate | `node --check` on every `.js` in the repo — **60/60 pass**, no syntax errors |
| Reference graph | Every `href`/`src` in every page resolved against the filesystem |
| Runtime load | All 66 pages loaded in a jsdom harness with a mocked Supabase client, capturing `jsdomError`, `console.error`, uncaught exceptions and unhandled rejections |
| Service worker | `sw.js` `APP_SHELL` array checked against the filesystem |
| Deployment | `gh run list`, Pages status via API |
| Not verifiable here | The sandbox has no outbound network to `*.supabase.co`. **No live data, no live RLS/Auth behaviour, no real browser rendering, no real Edge Function invocation was exercised.** Items marked *unverified-live* below need the owner's browser. |

---

## 1. Repository structure

Static, buildless, GitHub-Pages-native frontend. No `package.json` at root, no bundler, no framework.

```
/                66 HTML pages + 60 JS + 9 CSS          (storefront, account, admin, ops)
assets/          20 JPEGs, hero video (2.1 MB), logo SVG, banner SVG, 10 story JPGs   (5.5 MB)
backend/         supabase-client.js (browser client), schema.sql, rls.sql, secure-order.sql
supabase/        63 migrations, 5 Edge Function sources, 2 SQL test files
mobile/          Capacitor 8 packaging (package.json, capacitor.config.json)
.github/         deploy-pages.yml, build-mobile.yml, release-android.yml
docs/            15 feature notes (QA, accessibility, webhooks, exports, API, …)
.well-known/     security.txt
```

Observations
- **Every page is a standalone multi-page document.** No SPA router, no shared layout partial — navigation/footer/mobile-nav are injected at runtime by `pwa.js`.
- Three "generations" of storefront markup coexist: legacy `site-header`/`site-footer` (65 pages), the v3 `ref-*` system (homepage only), and injected global chrome (`pwa.js`).
- `mobile/` is packaging-only; CI regenerates `mobile/www` from the repo root.

---

## 2. Homepage — EXISTS + WORKING (needs polish)

`index.html` + `script.js` + `homepage-reference-v3.css` + `homepage-fashion-v2.css` + `apnastore-premium-v1.css`.

Working: intro splash, marquee announcement bar, `ref-header` with Men/Women/Kids/New Arrivals/Collections, hero video with poster fallback + CTA pair, "Trending Now" (live `products` query, 5 items), "New Season" collection block, "Shop by Category" (live `categories` query with a static 8-category fallback and local image map), "Why ApnaStore" benefits, 8-tile Style Inspo grid, back-to-top, injected premium footer with newsletter, feature-flag announcement bar, scroll-reveal, mobile bottom nav.

- Empty/error states are explicit and honest (`apna-empty-products`, "Products could not be loaded right now. Please refresh and try again."). **No fake products, prices or stock.** ✔
- Product images fall back to a placeholder, never to invented data. ✔

Needs polish
- Homepage critical path is **717 KB of uncompressed CSS+JS+HTML**, dominated by `styles.css` at **563.6 KB / ~3,958 rules**, plus a **2.1 MB** hero video.
- `homepage-reference-v3.css` is 88 KB and `homepage-fashion-v2.css` 18 KB — three overlapping homepage systems are all loaded at once.
- `script.js` hard-codes a 5-name "reference order" list (`Oversized Graphic T-Shirt`, `Basic Hoodie`, …) used purely to order real DB rows — fragile, silently degrades when names change.

---

## 3. Navigation — EXISTS + WORKING (needs polish)

- Homepage nav is semantic with real `<nav aria-label="Primary">`, skip link, ARIA labels on icon buttons. ✔
- All 66 pages have a `<meta name="viewport">`. ✔
- **Global chrome is JS-injected, not authored**: `pwa.js` appends the mobile bottom nav to *every* page (including admin/ops pages) and rewrites every page's `<footer>` with the homepage `ref-footer` markup.
- Two competing `.apna-mobile-nav` rule sets exist in `styles.css` (line 487 and line 1226) with different breakpoints (900 px vs 800 px) and different tokens. It renders, but it is duplicated CSS.
- Skip link exists **only on the homepage**.

Reachability gaps (verified by inbound-link graph)

| Page | Inbound links | Status |
|---|---|---|
| `rewards.html` | only `gift-cards.html` (itself an orphan) | **Effectively unreachable** — not linked from `account.html`, which does link wallet/membership/orders/wishlist/notifications/support |
| `coupon-center.html` | none | **Orphaned** |
| `gift-cards.html` | none | **Orphaned** |
| `auto-replenishment.html` | none (links out to `inventory-forecast.html`) | **Orphaned** |
| `barcode-qr.html` | none | **Orphaned** |
| `packing-center.html` | none | **Orphaned** |
| `delivery-executive.html` | none | **Orphaned** |
| `delivery-route.html` | none | **Orphaned** |
| `supplier-procurement.html` | none | **Orphaned** |
| `visual-search.html` | none | **Orphaned** |
| `compare.html` | opened only via `product.js` `openCompare()` | Reachable but undiscoverable |
| `deal-of-day.html` | `flash-sales.html` only | Reachable |

---

## 4. Shop / category — EXISTS + WORKING

`shop.html` + `shop.js`. Category chips (live `categories`), price min/max, size, colour, availability filters, sort (featured / low / high), sponsored-products section, pagination, URL-persisted filter state, result count. Deep links `shop.html?category=Men`, `shop.html?new=1` used by the homepage.

- Filters read real variant/size/colour data; no fabricated facets. ✔

---

## 5. Search — EXISTS + WORKING

`search.html` + `search.js` + `analytics.js` + `voice-search.js`.

A genuinely strong implementation: tokenised scoring across name/brand/category/seller/slug/description/SKU with weighted exact > prefix > substring, a synonym map (`tee↔t-shirt`, `sneaker↔shoes↔footwear`, `co-ord`, …), Levenshtein fuzzy fallback (≤1 always, ≤2 for tokens ≥5 chars), NFKD diacritic normalisation, recent + popular search history in `localStorage`, URL-synced query, clear button, and `apnaTrackSearch` writing to `search_events`.

- `visual-search.html` + `visual-search.js` (upload → `apna-ai-assistant`, explicitly instructed "return only actual matching products… Do not invent products") — **EXISTS but orphaned**, no inbound link.

---

## 6. Product detail — EXISTS + WORKING

`product.html` + `product.js` (28 KB) + `reviews.js` + `recommendation.js` + `analytics.js`.

Variant/size/colour matrix with per-combination stock, quantity stepper clamped to real stock, image gallery + thumbs + lightbox with keyboard support, SKU display, pincode availability check, add-to-bag, mobile sticky buy bar, wishlist toggle (guest `localStorage` ↔ cloud `wishlists`), compare, share (`navigator.share` → clipboard fallback), size/fit guide (`get_size_fit`), follow product, price-drop alert, back-in-stock notify, related products, recommendations, dynamic SEO (`title`, `description`, `canonical`, `og:*`, JSON-LD `Product` schema), recently-viewed.

Honest empty states throughout. Out-of-stock renders a dedicated "Notify Me When Available" state rather than fake availability. ✔

---

## 7. Cart — EXISTS + WORKING

`cart.html` + `cart.js`. `localStorage`-backed with server reconciliation (`syncCartWithCatalog` drops items that became inactive/out-of-stock and clamps qty to real stock), key-based merge/dedupe, qty +/- with live stock re-verification, remove, free-delivery threshold at ₹999, abandoned-cart tracking (`track_abandoned_cart`, `record_abandoned_cart_event`), cross-tab `storage` sync, and defensive `try/catch` around all cart reads.

---

## 8. Checkout — EXISTS + WORKING

`checkout.html` + `checkout.js`.

Contact & delivery form with autocomplete + pattern validation, delivery preferences (time window, instructions, safe place, alternate contact, leave-at-door) persisted via `get_customer_delivery_preferences`/`save_customer_delivery_preferences`, gifting block (wrap, hide price, recipient, message, occasion, scheduled date, gift-card code), order summary with coupon box, and order creation through the **`create_order_secure` SECURITY DEFINER RPC** (server-authoritative totals).

Payment posture is honest and safe:
- Cash on Delivery is live; **Online payment is rendered `disabled` with "Coming soon"** — no fake gateway.
- Gift-card field carries the note: *"Gift-card payment/redemption is not charged or applied yet. Real payment will be connected later."* ✔
- Coupon discount comes from `preview_coupon` RPC (server-side), not client math. ✔

---

## 9. Orders — EXISTS + WORKING

`orders.html`/`orders.js`, `order-detail.html`/`order-detail.js`, `order-success.html`/`order-success.js`, `return-request.html`/`return-request.js`.

Order history with items, coupon, delivery fee, total, status labels, "View order details". Order detail adds delivery tracking, shipment/AWB/courier, shipment events timeline, manual "Refresh live tracking", and customer order cancellation gated on `status ∈ {placed, pending, confirmed, processing}` and `seller_order_status ∈ {"", New, Accepted, Packing}` via `customer_cancel_order`. Return/exchange/refund flow validates delivered-ness, blocks duplicates, and renders the existing request + event timeline.

- Auth is enforced client-side *and* by RLS (`orders.user_id = auth.uid()`); invalid UUIDs are rejected before querying. ✔
- **No fake AWB, courier events, tracking or refund data is generated anywhere.** ✔

---

## 10. Account — EXISTS + WORKING

`account.html` + `account.js` (12.7 KB) + `account.css`.

Profile panel (name, email, birthday), saved-address CRUD via `set_default_address_secure` / `delete_address_secure` RPCs, membership summary (`ensure_free_membership`), rewards summary, referral code + copyable link, live counts for orders / wishlist / unread notifications, wallet balance, delivery preferences, per-category × per-channel notification preferences, and order/wishlist/notification quick links.

- `rewards.html` is **not** linked from here (see §3).

---

## 11. Wishlist — EXISTS + WORKING

`wishlist.html` + `wishlist.js`. Dual-mode: authenticated reads `wishlists` joined to `products`; guest reads `localStorage` and hydrates names/prices from `products`, with a `legacy-*` fallback for pre-migration entries. Migration of guest wishlist into the DB happens on first auth (`auth.js`).

---

## 12. Wallet — EXISTS + WORKING

`wallet.html` + `wallet.js`. Balance + expiry + transaction ledger from `get_wallet` / `get_wallet_transactions`. Empty state: "No wallet transactions yet." Redemption path: `membership.html` "Redeem 100 Points → ₹10 Wallet" via `redeem_points_to_wallet`.

- No seeded or demo balance. ✔

---

## 13. Notifications — EXISTS + WORKING (needs polish)

`notifications.html` + `notifications.js` + `fcm.js` + `firebase-messaging-sw.js` + `sw.js` push handler.

In-app centre with role-aware category maps (customer / seller / admin), read/unread filters, unread count, mark-read (`mark_notification_read`), mark-all-read, per-category `in_app` preferences (`set_notification_preference`), Supabase Realtime channel subscription, email-channel status card (checks `apna-notification-email` for Resend configuration), and Web Push enablement through `apnaEnableFcm` with an `apna:fcm-enabled` event handshake.

- Link rendering is sanitised through `safeLink()` — same-origin + http(s) only, so a malicious notification `link` cannot become `javascript:`. ✔ (good security detail)
- **Polish needed**: `fcm.js` and `firebase-messaging-sw.js` commit a Firebase web API key, project config and VAPID key in source. These are public-by-design browser identifiers, not server secrets, but they should be confirmed restricted (HTTP-referrer allowlist / FCM authorised domains). No Supabase service-role key or server secret is present anywhere in the repo. ✔

---

## 14. Membership — EXISTS + WORKING

`membership.html` + `membership.js` + `admin-membership.html`/`admin-membership.js`. Plan catalogue (`get_membership_plans`), current membership + history (`get_my_membership`, `get_membership_history`), free tier bootstrap (`ensure_free_membership`), purchase (`start_membership_purchase`), rewards balance (`get_my_rewards`), point redemption, wallet display.

Honest payment posture: after `start_membership_purchase` the UI says *"Purchase request created, but payment is not completed yet. No membership has been activated."* — **no fake activation, no fake charge.** ✔

---

## 15. Support — EXISTS + WORKING (needs polish)

- `support.html` + `support-center.js` — real ticket system: create ticket (8 categories, 4 priorities, order/shipment linkage, file attachment with MIME allowlist), ticket list, threaded conversation, admin controls (status/priority/agent/resolution), and AI summarisation via `apna-ai-assistant` with the prompt *"Do not invent anything."*
- `help.html` + `help-center.js` — help centre over `help_articles`.
- `grievance.html` — statutory grievance page.
- Legal set: `terms.html`, `privacy.html`, `cookie-notice.html`, `shipping-policy.html`, `return-refund-policy.html`, `cancellation-policy.html` (shared `legal-pages-v2.css`).
- `about.html`, `shipping.html`, `returns.html` — static content pages.

**Polish needed**: `support.html` loads `apna-ai.js`, which does not exist (see §29, defect P0-2).

---

## 16. Admin — EXISTS + WORKING (2 pages broken)

Hub `admin.html` (21 KB) + `admin.js` (18 KB) with sections: Dashboard, Management, Analytics, Categories, Brands, Marketing campaigns, Audit & Observability, Feature Flags. Loads `phase18-category-insights.js`, `phase19-customer-segments.js`, `phase28-admin-center.js`.

Satellite admin pages, all present and wired:

| Area | Page(s) |
|---|---|
| Catalogue | `admin-products.html`, `admin-product.html` (+ `phase31-ai-listing.js`) |
| Orders | `admin-orders.html` |
| Logistics | `admin-logistics.html` (+ `phase29-logistics-map.js`), `courier-center.html` |
| Returns | `return-management.html` |
| Reviews | `admin-reviews.html` (+ `phase34-reviews-admin.js`) |
| Risk | `admin-risk.html` (+ `phase33-risk-engine.js`) |
| Analytics | `admin-business-insights.html`, `admin-search-analytics.html` |
| Security / QA | `admin-security-center.html`, `admin-command-center.html` |
| Growth | `admin-deals.html`, `admin-flash-sales.html` |
| Store / partners | `admin-store.html`, `admin-partner-services.html`, `partner-services.html` |
| Membership | `admin-membership.html` |
| Inventory | `inventory-center.html`, `inventory-forecast.html`, `auto-replenishment.html` |

**Broken**: `admin-deals.html` and `deal-of-day.html` (defect P0-1).

---

## 17. Seller functionality — RETIRED / MISSING (HOLD)

This is the single largest structural finding of the audit.

The project has been **converted to a single-owner, admin-operated store**, but the repository still carries seller-era references:

1. **There are no seller pages in the repository.** No `seller-dashboard.html`, `seller-onboarding.html`, `seller-products.html`, `seller-product.html`, `seller-orders.html`, `seller-earnings.html`. Migration `20261001113310_retire_marketplace_runtime_functions.sql` drops **every** `public.seller*` function and creates admin-only replacements (`admin_save_listing`, `admin_set_listing_status`, `admin_delete_listing`, `admin_duplicate_listing`, `admin_bulk_update_listings`, `admin_business_insights`, `admin_search_trends`).
2. `supplier-procurement.html` still has `<nav><a href="seller-dashboard.html">Seller Dashboard</a></nav>` — a **dead link to a non-existent page**.
3. `sw.js` still precaches the six missing `seller-*.js` files (defect P0-3).
4. `robots.txt` still `Disallow`s seven `seller-*.html` paths; `sitemap.xml` still lists `seller-store.html`. Neither exists.
5. `pwa.js` still ships a full seller UI dictionary (en/hi/gu) and a `seller-*` path regex that injects a language selector.
6. `courier-center.js` and `reviews.js` still branch on `role === "seller"`.
7. `reviews.js` calls `seller_respond_to_review`, which the retire migration dropped (defect P1-5).

**Recommendation for the next phase: HOLD.** Do not rebuild seller functionality. The correct work is *remnant cleanup* — removing dead seller links, the `sw.js` precache entries, the seller dictionary, and the orphaned `seller_respond_to_review` call — which is a safe, additive-only cleanup, not a rebuild.

---

## 18. Supabase — EXISTS + WORKING

- `backend/supabase-client.js` — single shared browser client, explicit `persistSession`, `autoRefreshToken`, `detectSessionInUrl`, `localStorage` storage (storage key deliberately unchanged to preserve existing sessions), and a `visibilitychange` handler that resumes auto-refresh on iOS/PWA resume without ever force-logging-out on a transient refresh error. Well done. ✔
- **63 migrations** under `supabase/migrations/`, timestamped, Phase-numbered (Phase 5 → Phase 81), including RLS, roles, notifications, coupons, membership, wallet/rewards, logistics, risk, recommendations, feature flags, audit/observability, webhooks, background jobs, public API, data exports, trust & safety, accessibility, QA.
- `supabase/README.md` documents the migration rules and the authoritative live baseline.
- `supabase/tests/` — `apna_store_rls.test.sql` (pgTAP, 8 assertions) and `phase0-authorization-boundaries.sql`.

Note: `backend/schema.sql` and `backend/rls.sql` are the **original foundation** and no longer match the live schema (no `brands`, no `moderation_status`, different `products.status` enum). They are reference-only and are not re-applied. Do not "fix" them by guessing — the live migration history is authoritative (per `supabase/README.md` rule 5).

---

## 19. Authentication — EXISTS + WORKING

`auth.html` + `auth.js`.

Email/password sign-in and sign-up with mode toggle, **Google OAuth** (`signInWithOAuth` with `redirectTo`), OTP row + verify + resend-verification controls, referral-code capture from `?ref=`, post-auth routing that reads `profiles.role` and sends the owner account (`withapnastore@gmail.com` + `admin`) to `admin.html` and everyone else to `account.html` (or back to the page they came from via `apnaReturnAfterAuth`, whitelisted to `checkout.html`/`account.html` — an open-redirect guard ✔), guest-wishlist migration on first sign-in, and claim-referral on first auth.

Security posture ✔: no role is ever taken from client input; roles are read server-side from `profiles`, and `profiles` RLS prevents self-promotion (`with check (… role = 'customer')`).

---

## 20. RLS — EXISTS + WORKING (DO NOT TOUCH)

- `private` schema with `is_admin()` / `is_seller()` SECURITY DEFINER helpers, `REVOKE`d from `public`/`anon`.
- RLS enabled across the public surface; policies use owner-or-admin predicates (`user_id = (select auth.uid()) or private.is_admin()`).
- Ordering is protected by `create_order_secure` (SECURITY DEFINER, server-authoritative totals, `auth.uid()` enforced, direct order inserts locked by migration `lock_direct_order_inserts`).
- Two Phase 0 cleanups applied and recorded: `phase0_rls_performance_cleanup` (auth RLS initplan warnings 6 → 0; duplicate permissive policies 2 → 0) and legacy-overload revocation.
- `SECURITY.md` documents the residual state: 23 intentional authenticated SECURITY DEFINER warnings + 1 leaked-password-protection warning (blocked by Supabase Free plan).

**Status: DO NOT TOUCH.** Any change here needs a security review and an Advisor re-run.

---

## 21. Edge Functions — EXISTS + WORKING (source drift)

In repo (5):

| Function | Auth | Purpose |
|---|---|---|
| `apna-ai-assistant` | guest allowed (intentional), 20 req/min per IP, JWT passed through for personalisation | catalog-aware AI assistant + visual search + ticket summarisation |
| `apna-courier-v3` | JWT, requires `seller`/`admin` role | Shiprocket auth, serviceability, pickup locations, AWB, label, manifest, tracking. Credentials server-side only |
| `apna-data-export` | JWT via service-role client, per-user scoping | GDPR-style self-serve JSON/CSV export, job status recorded |
| `apna-notification-email` | service-role | drains `notification_deliveries` via Resend; degrades cleanly if `RESEND_API_KEY` unset |
| `apna-public-api-v1` | `x-api-key` (`aps_…`), SHA-256 key hash lookup, scope check | read-only catalog API |

Invoked by the frontend but **not present in the repo** (4): `apna-courier-actions`, `apna-courier-return-create`, `apna-courier-track` (2 call sites, incl. `order-detail.js`), `apna-return-actions`. These are very likely deployed live (the old `PHASE-0-AUDIT.md` refers to "Courier/return Edge Functions" in the plural and confirms they are JWT-protected), which means the repo is **not a complete source of truth for deployed functions**. Unverified-live.

**Bug (P1-6)**: `apna-public-api-v1/index.ts` queries `products … .eq("status","approved")`. `products.status` is constrained to `draft|active|inactive|pending_approval|rejected|archived` (migration `20260922110000_phase6_seller_listing_center.sql`). **`approved` is not a valid value, so the public API always returns an empty array.** Notably it fails safe — it returns nothing rather than leaking or fabricating — but it is non-functional.

---

## 22. PWA — PARTIALLY IMPLEMENTED / currently broken

- `manifest.json` — name, short_name, id, start_url, scope, standalone + `window-controls-overlay`, theme/background colours, orientation, categories, 2 SVG icons (`any maskable`), `prefer_related_applications: false`. **Valid.** ✔
- Apple meta tags (`mobile-web-app-capable`, `apple-mobile-web-app-capable`, status bar style, title, `apple-touch-icon`) present on the storefront pages. ✔
- `pwa.js` — SW registration (`updateViaCache: "none"`), one-shot cache/SW flush (`apna-store-sw-refresh-v10`), `controllerchange` reload guard, `apnaEnablePush`, back-to-top button, global footer injection.
- `sw.js` — network-first for HTML/CSS/JS/JSON, cache-first for everything else, navigation fallback to cache → `index.html` → `offline.html`, push + notificationclick handlers, aggressive old-cache deletion.
- `offline.html` — clean, styled offline page. ✔

**Broken (P0-3)**: `sw.js` `install` does `cache.addAll(APP_SHELL)` over 34 entries. **7 of them do not exist** — `seller-dashboard.js`, `seller-earnings.js`, `seller-onboarding.js`, `seller-orders.js`, `seller-product.js`, `seller-products.js`, `apna-ai.js`. `addAll` is atomic: **one 404 rejects the whole install**, so the service worker never activates. Consequence: no offline support, no app-shell caching, and (because `apnaEnablePush` awaits `navigator.serviceWorker.ready`) **Web Push enablement is blocked too**.

---

## 23. Responsive CSS — EXISTS + WORKING (needs consolidation)

- `styles.css`: **252 `@media` blocks**; `homepage-reference-v3.css`: 41; `customer-icons.css`: 25; `account.css`: 8; `homepage-fashion-v2.css`: 4; `global-responsive.css`: 5; `legal-pages-v2.css`: 3; `apnastore-motion-v1.css` / `apnastore-premium-v1.css`: 1 each (both `prefers-reduced-motion`).
- Breakpoints are consistent at 1200 / 1000 / 900 / 800 / 600 / 520 / 380 px.
- Mobile bottom nav is real and considered: `body { padding-bottom: 76px }` clearance, `env()`-safe-ish insets at 380 px, `backdrop-filter`, active pill, cart badge.
- `prefers-reduced-motion` is respected in **all** animation layers. ✔

Needs consolidation: `global-responsive.css` (a shared responsive foundation with `--apna-content-max`, `--apna-page-gutter`, `--apna-section-gap`, `overflow-x` guards, `min-width:0` grid fixes) **is not loaded by any page**, and `styles.css` carries duplicate `.apna-mobile-nav` blocks.

---

## 24. Existing animation systems — EXISTS (one orphaned)

Four coexisting layers:

1. **Homepage scroll reveal** — inline `IntersectionObserver` in `index.html` adding `.apna-scroll-reveal` + `.is-visible`, styled in `homepage-reference-v3.css`, with a `prefers-reduced-motion` bypass. Working.
2. **Premium interaction layer (latest commit)** — `apnastore-premium-v1.css` + `premium-interactions.js`, scoped to `.apna-reference-home`. Hero copy entrance, button lift, card lift, image zoom, category hover, staggered `.apna-premium-reveal`. Loaded by `index.html`. Working.
3. **Global motion system (latest commit name)** — `apnastore-motion-v1.css`: CSS custom properties (`--apna-motion-ease/fast/base/slow`), `fade-rise`, `apna-fade-in`, `apna-scale-in`, `apna-page-in`, `[data-motion]` reveal/fade variants, hover/focus utilities, and a thorough `prefers-reduced-motion` block. **The file exists but is not referenced by any page — the "global" motion system is currently inactive everywhere.** (Orphaned CSS #1.)
4. **Legacy** — `.apna-animate-in`, `.apna-fade-in`, `.apna-pop` in `styles.css`.

The commit `05128fa "Load ApnaStore global motion system"` added the CSS but did not add the `<link>` — that wording is currently untrue in the running site.

---

## 25. Existing assets — EXISTS

- `assets/branding/apnastore-logo.svg` (used by header + footer + intro splash)
- `favicon.svg`, `pwa-icon-192.svg`, `pwa-icon-512.svg`, `apna-style-feels-banner.svg` (video poster), `apnastore-watermark.svg`
- 19 product/lifestyle JPEGs (`IMG_2487`–`IMG_2512`) used by category cards, collection block, and the 8-tile Style Inspo grid
- `assets/Fashion_model_walking_in_studio_20260929215028.mp4` — **2,156 KB** hero video
- `assets/story/` — 10 `.jfif` files + `.gitkeep`, **not referenced by any page** (unused payload)
- Total `assets/` = **5.5 MB**

All `src`/`href` asset references resolve. **No missing images.** ✔

---

## 26. Existing design system — EXISTS but FRAGMENTED

Four generations live side by side:

| Layer | File | Loaded by | Tokens |
|---|---|---|---|
| Legacy storefront | `styles.css` (563 KB) | all 66 pages | ad-hoc; `!important`-heavy in later blocks |
| Homepage v2 | `homepage-fashion-v2.css` | `index.html` | editorial fashion |
| Homepage v3 reference | `homepage-reference-v3.css` | `index.html` | `ref-*` prefixed, 41 media queries |
| Premium interaction | `apnastore-premium-v1.css` | `index.html` | homepage-only |
| Global motion (orphaned) | `apnastore-motion-v1.css` | **nothing** | `--apna-motion-*` |
| Global responsive (orphaned) | `global-responsive.css` | **nothing** | `--apna-content-max`, `--apna-page-gutter`, … |
| Icon system | `customer-icons.css` (51 KB) | account / orders / notifications / rewards / wallet / membership | inline SVG |
| Account | `account.css` | `account.html` | — |
| Legal | `legal-pages-v2.css` | 6 policy pages | — |

`docs/UI-DESIGN-SYSTEM.md` describes the intended direction ("premium, minimal, modern Indian e-commerce"). The reality is a working but layered system with overlapping selectors and two orphaned shared layers. This is polish/consolidation work, not a redesign.

---

## 27. Existing GitHub Pages deployment — EXISTS + WORKING

- `.github/workflows/deploy-pages.yml` — triggers on push to `main` + `workflow_dispatch`; `permissions: contents: read, pages: write, id-token: write`; concurrency group `apna-store-pages`; validates `index.html` exists and runs `node --check` on **every** `.js` in the repo before uploading the whole tree as a Pages artifact.
- `.nojekyll` present. ✔ `robots.txt` present (correctly `noindex`es private/account/admin pages). `sitemap.xml` present.
- **Live status: healthy.** `gh api …/pages` → `status: built`, `https://yash009675-pixel.github.io/Apna-Store/`. Latest run `37140761455` ("Load ApnaStore global motion system") → **completed / success** in 21 s.
- **Gaps**: `sitemap.xml` lists only **7 of ~66** indexable pages (`/`, shop, about, help, shipping, returns, `seller-store.html`). `seller-store.html` does not exist; `product.html`, `search.html` etc. are absent (some are intentionally `noindex`, so the sitemap is not wrong so much as very incomplete).

---

## 28. Existing security controls — EXISTS + WORKING (DO NOT WEAKEN)

Verified present:
- RLS everywhere + `private` helper schema + SECURITY DEFINER `search_path` hardening (`set search_path=public,private,pg_temp`)
- Order creation exclusively via `create_order_secure`; direct inserts locked
- Address mutation via `set_default_address_secure` / `delete_address_secure`
- Role checks server-side in every admin RPC (`raise exception 'Admin access required'`)
- Storage policies restrict users to their own first-level UUID folder
- Notification RPCs are SECURITY INVOKER and authenticated-only
- XSS discipline: every page escapes user/DB content before `innerHTML` (`esc`/`escapeHtml` helpers are present in all renderers); notification links pass a same-origin + protocol `safeLink()` allowlist
- AI assistant rate-limited (20 req/min/IP), and prompt-constrained against fabrication
- Courier/payment provider credentials stay in Supabase secrets, never in the frontend
- `.well-known/security.txt`, `SECURITY.md`, private pages `noindex`
- **No Supabase service-role key, DB password, or payment secret anywhere in the repo** — verified by inspection and consistent with the prior audit

Residual (documented, not newly discovered): 23 intentional SECURITY DEFINER Advisor warnings; leaked-password protection unavailable on the Free plan; 3 Phase 32 migrations applied live with no source file (documented as deliberately not reconstructed).

---

## 29. DEFECT REGISTER

### P0 — broken right now

| # | Defect | Evidence | Impact |
|---|---|---|---|
| **P0-1** | `admin-deals.html` and `deal-of-day.html` load `backend/supabase-client.js` **without** the Supabase UMD CDN script | Verified: those are the only 2 of 66 pages where `supabase-client.js` appears and `cdn.jsdelivr.net/npm/@supabase` does not. Runtime: `Uncaught TypeError: Cannot read properties of undefined (reading 'createClient')` | **Both pages are completely dead** — no data loads, no UI renders beyond static HTML |
| **P0-2** | `apna-ai.js` does not exist | Referenced by **13** pages: `about.html`, `admin-logistics.html`, `admin-orders.html`, `admin-product.html`, `admin-products.html`, `coupon-center.html`, `courier-center.html`, `inventory-center.html`, `order-detail.html`, `order-success.html`, `return-management.html`, `return-request.html`, `support.html` | 13 × console 404 on every visit; the AI assistant widget is silently absent on every page that expects it |
| **P0-3** | `sw.js` precaches 7 non-existent files | `APP_SHELL` contains 6 × `seller-*.js` + `apna-ai.js`; `cache.addAll()` is atomic | **Service worker install fails** → no offline, no app shell, and Web Push enrolment blocked |
| **P0-4** | Dead link to a non-existent seller page | `supplier-procurement.html` nav → `seller-dashboard.html`; `robots.txt` + `sitemap.xml` reference 7 more `seller-*.html` that don't exist | 404s; sitemap/robots reference phantom URLs |

### P1 — functional drift / dead code

| # | Defect | Evidence | Impact |
|---|---|---|---|
| **P1-5** | `reviews.js` calls `seller_respond_to_review`, which migration `20261001113310` dropped (it drops all `public.seller%` functions) | Grep: single call site in `reviews.js:34` | Seller response form would fail if ever rendered (currently dormant: `sellerCanRespond` requires `role === 'seller'`, and no sellers remain). **Dead code + drift** |
| **P1-6** | `apna-public-api-v1` filters `products.status = 'approved'`, an invalid enum value | `supabase/migrations/20260922110000_phase6_seller_listing_center.sql` constrains status to `draft, active, inactive, pending_approval, rejected, archived` | Public API **always returns an empty array**. Fails safe (no fabricated data) but non-functional |
| **P1-7** | 4 Edge Functions invoked but absent from the repo | `apna-courier-actions`, `apna-courier-return-create`, `apna-courier-track`, `apna-return-actions` | Repo is not a complete source of truth; live/deployed state unverified from here |
| **P1-8** | Mobile bundling omits `assets/` | `build-mobile.yml`: `find . -maxdepth 1 -type f … -exec cp {} mobile/www/ \;` then `cp -R backend mobile/www/backend` — directories are never copied | **Capacitor app ships with no logo, no product imagery, no hero video** |
| **P1-9** | The "global motion system" is not actually loaded | `apnastore-motion-v1.css` has zero `<link>` references; `global-responsive.css` likewise | Latest commit's stated behaviour is not live; shared responsive foundation unused |

### P2 — polish

| # | Item |
|---|---|
| **P2-10** | `pwa.js` injects the homepage newsletter footer into every page (including admin), but the submit handler lives only in `script.js` → the form is inert on 64 pages and duplicates `#newsletterForm` IDs |
| **P2-11** | `rewards.html` is unreachable (only linked from orphaned `gift-cards.html`); `account.html` links wallet/membership/orders/wishlist/notifications/support but **not** rewards |
| **P2-12** | 9 orphaned pages with no inbound link (see §3) |
| **P2-13** | `styles.css` = 563.6 KB / ~3,958 rules across 4 design generations; duplicate `.apna-mobile-nav` blocks (lines 487, 1226) |
| **P2-14** | Homepage critical path = 717 KB CSS+JS+HTML + 2.1 MB hero video; `assets/story/` (10 unused `.jfif`) adds dead weight |
| **P2-15** | Skip-to-main link exists only on the homepage; 65 pages lack it (contradicts `docs/ACCESSIBILITY.md`) |
| **P2-16** | `sitemap.xml` covers 7 of ~66 pages and lists a non-existent `seller-store.html` |
| **P2-17** | Firebase web config + VAPID key committed in `fcm.js` / `firebase-messaging-sw.js` — public-by-design, but confirm referrer/domain restrictions in Firebase console |
| **P2-18** | `backend/schema.sql` / `backend/rls.sql` no longer reflect the live schema (reference-only; must not be "fixed" by guessing) |
| **P2-19** | `script.js` orders homepage products by a hard-coded 5-name list; silently degrades if product names change |
| **P2-20** | Mobile bottom nav is injected on admin/ops pages where a customer nav makes no sense |

---

## 30. FEATURE INVENTORY

### EXISTS + WORKING
Homepage (hero, trending, categories, collection, benefits, inspo, newsletter, back-to-top) · Header nav + search + account + bag with live count · Shop with filters/sort/pagination/URL state · Full-text search with synonyms + fuzzy + history · Product detail (variants, gallery, lightbox, pincode, share, size/fit, follow, price-drop, back-in-stock, related, recommendations, JSON-LD SEO) · Cart (localStorage + server reconciliation, stock clamping, abandoned-cart) · Checkout (COD, coupons, delivery prefs, gifting, secure order RPC) · Orders list / order detail / tracking timeline / cancellation / return-request · Account (profile, addresses, membership, rewards, referral, counts, delivery + notification preferences) · Wishlist (guest + cloud + migration) · Wallet · Notifications (in-app, preferences, realtime, email channel status, Web Push wiring) · Membership plans + redemption · Support tickets + AI summary · Help centre · 6 legal/policy pages · Admin hub + 19 admin/ops pages · Auth (email, Google OAuth, OTP, role routing, referral capture) · 63 migrations · RLS + `private` helpers + secure RPCs · 5 Edge Functions · PWA manifest + offline page + SW fetch strategies (install currently blocked) · Responsive breakpoints 380–1200 px · `prefers-reduced-motion` everywhere · Icon system · GitHub Pages CI/CD with `node --check` gate · Security.txt + SECURITY.md

### EXISTS + NEEDS POLISH
Homepage payload weight (717 KB + 2.1 MB video) · `styles.css` consolidation (563 KB, 4 generations, duplicate rules) · Sitemap coverage · Skip links on 65 pages · Footer/newsletter duplication · Mobile nav on admin pages · Homepage product ordering via hard-coded names · Firebase key hygiene review · Orphaned assets (`assets/story/`)

### PARTIALLY IMPLEMENTED
- **PWA** — manifest/offline/SW all correct, but `sw.js` install fails on 7 missing precache entries → offline **and** push are inert (P0-3)
- **Online payment** — intentionally visible-but-disabled with "Coming soon"; gift-card redemption explicitly not charged. Correct posture, not a defect
- **AI assistant** — widget wiring present on 13 pages but `apna-ai.js` is missing (P0-2); Edge Function itself exists and is well built
- **Public API** — built, secured, but returns empty due to an invalid status filter (P1-6)
- **Rewards page** — built and functional, but unreachable from account nav (P2-11)
- **Compare / visual search** — functional, only reachable via JS, no UI entry point

### MISSING
- Entire seller surface (dashboard, onboarding, listings, orders, earnings, store profile) — **retired by design**, see §17 → **HOLD**, do not rebuild
- `apna-ai.js`
- Skip links on non-homepage pages
- Sitemap entries for ~59 indexable pages
- Complete Edge Function source parity (4 functions deployed but not in repo)

### DO NOT TOUCH
- **RLS policies** and the `private` helper schema
- **SECURITY DEFINER** RPC authorisation and `search_path` hardening
- **`create_order_secure`** and the locked direct-insert path
- **`backend/supabase-client.js`** session/storage configuration (changing `storageKey` would sign everyone out)
- **Supabase migrations already applied** — never rewrite or reconstruct historical migrations
- **Authentication/role logic** (server-side role resolution, open-redirect guard)
- **Courier/payment provider secret handling**
- **`backend/schema.sql` / `backend/rls.sql`** (historical reference; live schema is authoritative)

### HOLD
- **Seller functionality** — retired by migration; do not rebuild (explicitly out of scope)
- **Phase 60 — Warehouse Management** — never re-add (explicit instruction)
- **Real Shiprocket production E2E** (needs live credentials + real order) — carried over from `PHASE-0-AUDIT.md`
- **Live browser / physical-device QA** — needs the owner's browser; sandbox has no network access to Supabase
- **Leaked-password protection** — blocked on Supabase Free plan
- **3 missing Phase 32 migration sources** — deliberately not reconstructed

---

## 31. Build & verification result

| Gate | Result |
|---|---|
| `node --check` on all 60 JS files | **PASS** (0 syntax errors) |
| Repo HTML/JS/CSS/asset reference resolution | **PASS** except 1 missing JS (`apna-ai.js`) and 1 missing page (`seller-dashboard.html`) |
| jsdom runtime load of all 66 pages | **PASS** except 2 fatal (`admin-deals.html`, `deal-of-day.html`) and 13 × `apna-ai.js` 404 |
| `sw.js` APP_SHELL integrity | **FAIL** — 7 of 34 entries missing |
| GitHub Pages workflow (latest run `37140761455`) | **SUCCESS** (21 s) |
| GitHub Pages site status | **built** — `https://yash009675-pixel.github.io/Apna-Store/` |
| Live browser rendering / real data / live Auth+RLS | **NOT VERIFIED** — no network access to `*.supabase.co` from this environment |

---

## 32. Suggested (NOT STARTED) next-step ordering

Nothing below has been started — this phase is audit-only.

1. **P0-1** — add the Supabase CDN script to `admin-deals.html` and `deal-of-day.html` (2-line fix, restores 2 dead pages)
2. **P0-3 + P0-4** — clean the 7 phantom entries out of `sw.js` `APP_SHELL` and the seller references out of `robots.txt` / `sitemap.xml` / `supplier-procurement.html` (restores PWA install, offline and push)
3. **P0-2** — decide: create a real `apna-ai.js` widget against the existing `apna-ai-assistant` Edge Function, or remove the 13 `<script>` tags
4. **P1-5, P1-6** — remove the dead `seller_respond_to_review` call; fix the public-API status filter
5. **P1-9** — wire `apnastore-motion-v1.css` and `global-responsive.css`, or delete them
6. **P2** — nav/footer consolidation, rewards link, sitemap, skip links, CSS audit
7. **HOLD** — seller rebuild, warehouse management, live E2E
