# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Added

- OpenAPI (`apps/worker/openapi.yaml`): documented `/health`, `POST /auth/token` (API key `X-Fluxy-Api-Key`), billing routes, GDPR export/delete, and `402`/`429` responses on `POST /messages`; cross-link to bundled smoke script in spec intro.
- OpenAPI extended further: agents (`/agents`, `/agents/{id}`, invoke, runs), upload + attachments, benchmark, compliance report, stats (`/stats/*`), webhooks (register, `{id}`, verify, Stripe), admin deliveries/replay/reports/audit/plan upsert, `PATCH`/`DELETE` `/rooms/{id}`, SSE `GET /rooms/{id}/stream`; `GET /api/messages` documented as JWT-protected.
- Dashboard: public marketing route **`/landing`** (product story, CTAs to onboarding vs console) and Header link **Product**; `vitest.config.ts` aliases for `@`/`~`; production CSS imports use package-relative paths; assorted build/type fixes (`globals.css`, lucide icon, `Input` size prop, projects button variant).
- M5-A hardening complete: auth edge-case tests, webhook retry edge tests, deploy/rollback runbook, backup/restore drill script, external alert dispatch with dedupe, admin/mod audit trail endpoint.
- M5-B docs v1 complete: use-case docs, auth/JWT cookbook, troubleshooting guide, Next.js end-to-end snippets, contract/changelog policy.
- M5-C GTM readiness complete: runtime quota enforcement, pricing guardrails in `/stats/costs`, onboarding wizard page, launch KPI endpoint (`/stats/launch-kpis`), and release materials.
- Release demo script added at `docs/release/demo-script.md`.
- Suggested release notes added at `docs/release/release-notes-v0.2.0.md`.

### Fixed

- Worker integration tests: `FakeDB` mirrors quota SQL (`INSERT OR IGNORE`, guarded increment `UPDATE`) and Stripe `UPDATE project_plans` (full bind list); `createEnv` sets `RATE_LIMIT_FALLBACK_ALLOW` for KV-less runs; Stripe webhook e2e seed uses `manually_overridden` when asserting preserved custom limits.

## 0.1.0

### Added

- Worker (Cloudflare) with WebSocket rooms via Durable Objects.
- D1 persistence for rooms/messages/memberships.
- Webhook delivery queue with retry/backoff + admin replay.
- AI agents (`/agents*`) and usage stats (`/stats/ai`).
- Operational metrics (`/stats/ops`), alert rules/events, SLO snapshot (`/stats/slo`), cost breakdown (`/stats/costs`).

