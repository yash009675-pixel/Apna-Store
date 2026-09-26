# APNA STORE — MASTER WEBSITE PLAN

## Core rule
**Existing working features must NOT be removed.**
This roadmap is for improving, completing, and visually unifying the existing Apna Store.

Before changing any area:
1. Inspect the existing implementation.
2. Preserve existing working functionality and links.
3. Change only the required UI/UX or missing functionality.
4. Do not recreate a feature that already exists.
5. Keep customer, seller, and admin capabilities intact.

## Current product direction
Apna Store is a clothing-first shopping marketplace.

Visual direction:
- Clean, modern, premium fashion-store feel
- Warm off-white / beige customer background
- Black / charcoal primary typography
- No purple text
- Real clothing/product photography wherever available
- Strong editorial hero sections
- Simple product cards
- Mobile-first responsive layout
- Black/dark promotional banners and footer
- Minimal, uncluttered navigation

---

## 1. Customer storefront — visual system

### Home Page
**Current implementation to preserve**
- Dynamic marketing hero
- Dynamic categories
- Featured/trending products
- New Arrivals
- Recently Viewed
- Deals
- Flash Sales
- Deal of the Day
- Wishlist actions
- Product links
- Cart/mobile navigation
- Footer links
- PWA/mobile behavior

**Design target**
- Fashion hero
- Shop Men / Shop Women CTAs
- Shop by Category
- Trending Now
- New Arrivals
- New Collection banner
- Trust/benefits strip
- Recently Viewed when applicable
- Existing deals/flash-sale/deal-of-day access
- Premium footer

**Current step**
- Home V2 fashion storefront styling added in homepage-fashion-v2.css.
- Existing homepage functionality preserved.
- Category cards now use real product imagery when available, with fallback styling.

### Shop / Category
Preserve:
- Product catalog
- Category filtering
- Advanced filters
- Sorting
- Product cards
- Product navigation
- Responsive layout

Improve:
- Fashion-category visual hierarchy
- Cleaner filters
- Consistent product card system
- Mobile filter/sort UX

### Search
Preserve:
- Search
- Search analytics/event tracking
- Voice search
- Result rendering
- Empty-state handling

Improve:
- Search header
- Filters/sorting
- Mobile search UX
- Result readability

### Product Detail
Preserve:
- Product gallery
- Variants
- Quantity
- Add to bag
- Wishlist
- Reviews
- Recommendations
- Seller/store link
- Product analytics

Improve:
- Premium fashion product presentation
- Image gallery hierarchy
- Variant controls
- Mobile purchase area
- Related-product presentation

### Cart / Checkout / Order Success
Preserve:
- Cart quantity/remove
- Checkout
- Coupon support
- Order creation
- Order success
- Account/order navigation

Improve:
- Visual consistency
- Clear totals
- Mobile checkout flow
- Trust/reassurance UI

### Account / Customer
Preserve:
- Authentication/session
- Profile
- Addresses
- Orders
- Notifications
- Wallet
- Wishlist
- Membership
- Rewards

Improve:
- Clean customer dashboard
- Better navigation hierarchy
- Consistent cards/forms
- Mobile usability

### Supporting customer pages
Preserve and visually unify:
- About
- Help
- Shipping
- Returns
- Order detail
- Return request
- Wishlist
- Notifications
- Membership
- Rewards
- Coupon center
- Gift cards
- Partner services
- Visual/voice search
- Offline/PWA pages

---

## 2. Authentication

Preserve:
- Customer login/signup
- Google authentication where enabled
- Session handling
- Profile access
- Logout
- Protected customer functionality

Remaining verification:
- Real browser E2E
- Customer signup/login/profile verification
- Seller authorization verification
- Admin authorization verification

---

## 3. Seller system

Existing seller areas include:
- Seller dashboard
- Products/listings
- Product editor
- Orders
- Payments/earnings
- Growth/insights
- CRM
- Store
- Logistics
- Search trends
- Advertising/ad center
- Onboarding
- Seller academy

Preserve all existing seller functionality.

Remaining verification:
- Product/image/listing E2E
- Inventory E2E
- Seller order lifecycle
- Courier/Shiprocket E2E
- Payments/settlements QA
- Growth/insights real-data QA
- Search-trends real-data QA

---

## 4. Admin system

Existing admin/operations areas include:
- Admin dashboard
- Command center
- Deals
- Flash sales
- Logistics
- Membership
- Partner services
- Reviews
- Risk/security
- Settlements
- Inventory
- Returns
- Courier
- Packing
- Delivery
- Supplier/procurement
- Analytics/support systems

Preserve admin access and capabilities.

Remaining verification:
- Real admin browser E2E
- Authorization checks
- Operational workflows
- Security review
- Final production QA

---

## 5. Commerce / operations

Preserve and complete:
- Products/categories
- Inventory
- Orders
- Coupons
- Deals
- Flash sales
- Returns/exchange
- Reviews/ratings
- Delivery tracking
- Courier integration
- Seller payments
- Settlements
- Notifications
- Recommendations
- Analytics

Do not fabricate:
- Payment success
- Refund success
- Payout success
- Shipment/AWB/tracking success
- Real provider events

---

## 6. Mobile / PWA

Preserve:
- Responsive layouts
- Mobile bottom navigation
- PWA manifest/service worker
- Android/iOS build workflow

Final stage:
- Physical Android QA
- Physical iOS QA
- Full customer/seller/admin mobile regression
- Orientation and touch-target checks

---

## 7. Security / infrastructure

Preserve:
- Supabase RLS
- Secure RPC architecture
- Authenticated Edge Functions
- Admin/seller authorization
- GitHub Pages validation
- PWA infrastructure

Final review:
- SECURITY DEFINER review
- Security Advisor re-check
- Leaked-password protection when supported
- Phase 32 migration source reconciliation
- Performance Advisor review based on real usage

---

## 8. Final launch holds

These stay intentionally deferred:
- Production online payment activation
- Real payment/refund/payout provider E2E
- Google Play Store publishing
- Apple App Store publishing
- Final physical-device QA
- Final production security/performance sign-off
- Exact historical Phase 32 migration-source recovery

Phase 60 — Warehouse Management — remains permanently removed and must never be re-added.

---

## 9. Development order

### Stage A — Customer visual transformation
1. Home
2. Shop/category
3. Search
4. Product detail
5. Cart
6. Checkout
7. Account
8. Supporting customer pages

### Stage B — Functional verification
9. Customer E2E
10. Seller E2E
11. Admin E2E
12. Commerce/order verification
13. Logistics verification

### Stage C — Final hardening
14. Security
15. Performance
16. Mobile/PWA QA
17. Payment/provider verification
18. Store publishing
19. Final launch sign-off

**Rule for every stage: inspect first → preserve existing functionality → make one focused change → validate → deploy → move forward.**
