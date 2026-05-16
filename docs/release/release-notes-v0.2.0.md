# Fluxychat v0.2.0 (Suggested) — Release Notes

This release marks the completion of the M5 plan: production hardening, developer docs, and GTM readiness.

## Highlights

- Production hardening completed:
  - auth/authz edge-case test coverage
  - webhook retry edge coverage
  - deploy/rollback runbook + backup/restore drill
  - external alert dispatch with dedupe
  - persistent admin/mod audit trail
- Developer experience/docs v1 completed:
  - use-case docs, auth cookbook, troubleshooting
  - Next.js end-to-end snippets
  - public contract/changelog policy
- GTM readiness completed:
  - runtime quotas enforcement
  - pricing guardrails and gross margin visibility
  - onboarding wizard in dashboard
  - launch KPI endpoint and analytics section
  - release demo script

## New/Updated Endpoints

- `GET /stats/launch-kpis`
- `GET /stats/costs` (extended pricing guardrails section)
- `GET /admin/audit/events`

## Recommended rollout

1. Apply latest D1 migrations in production.
2. Deploy worker + dashboard using runbook.
3. Validate `/stats/slo`, `/stats/costs`, `/stats/launch-kpis`.
4. Run onboarding flow once on a pilot tenant.
5. Start controlled external rollout.

## Suggested tag

- `v0.2.0`

