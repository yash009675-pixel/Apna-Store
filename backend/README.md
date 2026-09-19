# Apna Store — Backend Foundation

The current storefront is a static frontend. This folder prepares the database contract for the real marketplace backend.

## Target backend
Supabase/PostgreSQL + Auth + Storage.

## Tables
- profiles
- categories
- products
- product_variants
- addresses
- orders
- order_items
- wishlists
- reviews

## Important
Do not put Supabase service-role keys, payment secrets, or database passwords in GitHub.

## Next implementation
1. Create a Supabase project.
2. Run `schema.sql` in the SQL Editor.
3. Run `rls.sql` immediately after it; the policies protect browser access with Row Level Security.
4. Connect the storefront using the public project URL and publishable key.
5. Move account, wishlist, orders and products from localStorage to the database.
6. Add seller/admin approval flows and backend-only payment operations.

GitHub Pages is only suitable for the current static prototype. A production commercial marketplace needs an appropriate application host/backend.
