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
2. Run schema.sql in the SQL editor.
3. Connect the storefront using the public project URL and anon/publishable key.
4. Move account, wishlist, orders and products from localStorage to the database.
5. Add Row Level Security before real customer data is enabled.

GitHub Pages is only suitable for the current static prototype. A production commercial marketplace needs an appropriate application host/backend.
