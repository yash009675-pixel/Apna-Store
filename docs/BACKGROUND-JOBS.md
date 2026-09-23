# Phase 72 — Background Jobs

Apna Store uses Supabase Cron/pg_cron for recurring work without introducing a paid worker service.

## Current job

- `apna-rewards-birthday-daily`
- Schedule: `10 0 * * *`
- Handler: `public.run_background_job('apna-rewards-birthday-daily')`
- Business function: `public.process_birthday_rewards()`

## Job controls

The `background_jobs` table is the registry for recurring jobs. Direct client access is revoked. Admins inspect jobs through authenticated RPCs.

Each execution is recorded in `background_job_runs` with status, timestamps, duration, result, and error details.

## Failure behavior

A failed handler marks the run and job as `failed`, stores a bounded error message, and re-raises the error so pg_cron records the failure. The job is not silently reported as successful.

## Cost policy

Phase 72 uses the existing Supabase database scheduler. No paid worker, branch, or external queue is introduced.

## Verification

Verify:
1. The cron job exists and is active.
2. The registered job points to `run_background_job`.
3. Admin RPCs expose job/run health without direct table access.
4. A controlled run can be observed in `background_job_runs`.
5. Failed executions remain visible and do not become false successes.
