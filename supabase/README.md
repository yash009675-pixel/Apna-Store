# Supabase database workflow

Apna Store uses Supabase migrations as the source of truth for schema and security changes.

## Rules

1. Every new database/schema/RLS/function change must be represented by a timestamped SQL migration under `supabase/migrations/`.
2. Apply and verify the change against the connected Apna Store Supabase project before considering the task complete.
3. Commit the migration to `main` in the same change set as the application code that depends on it.
4. Never commit secrets, service-role keys, access tokens, or production credentials.
5. Do not rewrite or fabricate historical migrations that were created before this repository mirrored the database history. The live Supabase migration history remains authoritative for that earlier baseline.
6. New migrations must be idempotent where practical (for example, use `IF EXISTS` / `IF NOT EXISTS` when safe).
7. Security-sensitive changes must be followed by a Supabase verification query/advisor review.

## Current repository coverage

The repository contains the recent catalog and checkout security migrations. The earlier Phase 0 database was established directly in Supabase before migration files were mirrored into this repository, so those historical SQL files are intentionally not reconstructed from memory.

## Phase 0 baseline

The connected project currently has the following migration history:

- 20260919075826 — apna_store_database_foundation
- 20260919075841 — apna_store_rls_security
- 20260919075859 — harden_security_definer_permissions
- 20260919081450 — secure_order_creation_and_inventory
- 20260919081522 — lock_direct_order_inserts
- 20260919081832 — seed_complete_product_variants
- 20260919094259 — harden_secure_order_variants_and_totals
- 20260919094341 — fix_secure_order_authoritative_totals
- 20260919124328 — add_profile_signup_trigger_and_role_helpers
- 20260919125128 — phase0_harden_rls_and_checkout_rpc
- 20260919125153 — move_rls_helpers_to_private_schema
- 20260919125406 — lock_private_rls_helper_execution
- 20260919214917 — fix_secure_order_uuid_generation (live migration history)
- 20260920130546 — phase22_category_brand_management

When a future database change is made, add the new migration file to the repository and verify that the live migration history contains the matching change.

## Verification

Before closing a database task:

- verify the intended schema/RLS/function behavior with a test query;
- run Supabase security advisors for security-sensitive changes;
- verify GitHub Actions deployment for any frontend change;
- record the commit/deployment result in the project audit.
