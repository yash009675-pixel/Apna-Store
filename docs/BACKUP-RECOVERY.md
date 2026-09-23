# Apna Store — Backup & Recovery

## Phase 71

Supabase currently does not provide automated daily backups or PITR for this project plan. Phase 71 therefore adds a recovery control plane and keeps the actual backup requirement explicit rather than pretending a database backup exists.

### Recovery sources

- **Database:** create an off-site logical dump with the Supabase CLI (`supabase db dump`).
- **Storage:** back up Storage objects separately; database backups contain Storage metadata, not the files themselves.
- **Application:** GitHub is the source of truth for frontend, migrations, and Edge Function source/configuration.
- **Configuration:** keep Auth/provider/webhook configuration documented, but never commit secrets.
- **Restore:** reconcile migration history and test recovery in an isolated project before production recovery.

### Database restore

A production restore should be treated as a controlled downtime operation. Before restoring:

1. Preserve the current migration/version state.
2. Preserve the latest logical dump and Storage export.
3. Restore the database or create an isolated recovery project.
4. Reconcile/apply migrations.
5. Restore Storage objects separately.
6. Verify Auth, Edge Functions, RLS, and critical customer/seller/admin flows.
7. Record a verified recovery checkpoint.

The admin RPC `admin_recovery_readiness()` exposes the current recovery posture and checklist. `recovery_checkpoints` records recovery evidence without storing backup contents or secrets.
