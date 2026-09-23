# Phase 74 — Third-party Integrations

Apna Store now has a centralized integration registry for external services.

- Provider records are stored in `integration_connections`.
- Admins can list and update integration status through protected RPCs.
- Secrets and API credentials are never stored in the registry.
- Existing integrations are registered for Shiprocket, Resend, OpenAI, Google OAuth and Apna Store Webhooks.
- Shiprocket remains disabled by default in this registry because real shipping actions must only occur through the existing authenticated logistics flow.
- Integration changes create audit events.
- RLS is enabled and direct client table access is revoked.
- The design remains compatible with the ₹0/month requirement; no paid integration service was introduced.
