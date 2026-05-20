# M6-A / M6-D — Operational checklist (deploy, smoke, pilot, performance)

This document **does not replace** `RUNBOOK_DEPLOY_ROLLBACK.md` and `docs/performance-benchmark.md`: it cross-references them to close **M6-A** (rollout) and the executable part of **M6-D** (benchmark/SLO on a real env without inventing numbers).

## Account prerequisites (one-time)

- [ ] **Workers Paid** enabled on the Cloudflare account used for deploy.
- [ ] **D1** `fluxychat` (or chosen name) created; `database_id` in `apps/worker/wrangler.toml` aligned.
- [ ] **KV** for rate limits: create namespace and paste ID in `wrangler.toml` (replace `REPLACE_WITH_*`). Commands: see `RUNBOOK_DEPLOY_ROLLBACK.md` §1.1.
- [ ] **R2** attachments bucket created; `ATTACHMENTS` binding matches the real bucket.
- [ ] Worker **secrets** (`wrangler secret put …`) and vars documented in `apps/worker/.dev.vars.example` / runbook (Stripe, AI, etc. only if needed).

## Phase 1 — Migrations and deploy

Follow runbook **§2 Deploy**:

- [ ] `pnpm exec wrangler d1 migrations apply <database_name> --remote`
- [ ] `pnpm --filter @fluxychat/worker deploy`
- [ ] `pnpm --filter @fluxychat/ai-agent deploy` (if you use mention → AI agent)

## Phase 2 — Automated smoke (right after deploy)

With **admin JWT** (`tid` = project id, roles `owner`/`admin`/`moderator`) for the smoke tenant:

```bash
cd apps/worker
pnpm run smoke:remote -- --base-url https://<worker-host> --admin-jwt "<JWT>"
```

Or:

```bash
set SMOKE_BASE_URL=https://<worker-host>
set SMOKE_ADMIN_JWT=<JWT>
pnpm run smoke:remote
```

Implicit checks:

- [ ] `GET /health` → `200`, `ok: true` (if `degraded`, verify KV/R2 when you can).
- [ ] `GET /stats/slo`, `/stats/costs`, `/stats/launch-kpis` → `200` without `error` in JSON.

Combine with runbook **§3** curl smoke (webhook deliveries, auth/token, test message) for full coverage.

**Bash alternative:** from monorepo root, `./scripts/smoke-test.sh` (see `RUNBOOK_DEPLOY_ROLLBACK.md` §3) with `TEST_API_KEY=fc_...` — also exercises room/messages/GDPR without a pre-minted JWT.

## Phase 3 — End-to-end pilot (M6-A exit)

Define **one pilot tenant** (even internal) and complete:

- [ ] Dashboard → **Onboarding** (or equivalent API): project, API key, member JWT, room, first message, first agent invoke (if in scope).
- [ ] Dashboard → **Billing** → load plan (verify `project_plans` + usage).
- [ ] Dashboard → **Analytics**: cost/guardrail section and (if used) performance signal.

Record `project_id`, date/time, and any incidents in the runbook incident log if applicable.

## Phase 4 — Performance / SLO (M6-D)

After you have **member** + **admin** JWTs and a test `room-id`:

```bash
cd apps/worker
pnpm run perf:workload-check -- \
  --base-url https://<worker-host> \
  --member-token "<JWT_MEMBER>" \
  --admin-token "<JWT_ADMIN>" \
  --room-id <room> \
  --messages 120 \
  --concurrency 12 \
  --thresholds-file scripts/perf-thresholds.v1.json
```

Details and interpretation: `docs/performance-benchmark.md`.

- [ ] Run on **target env** (not localhost only); archive results (JSON export from Analytics if you use the export card).

## Phase 5 — Controlled rollout to external users

Minimum gates before opening to external users:

- [ ] Phase 2 + 3 OK on **production** (or staging-identical) env.
- [ ] Stripe (if monetization is on): production checklist in `docs/billing-stripe-runbook.md` (*Production exit criteria* section).
- [ ] Support / issue intake channel defined (email, form, or GitHub issues).

## Links

- Deploy / rollback: `RUNBOOK_DEPLOY_ROLLBACK.md`
- Stripe E2E: `docs/billing-stripe-runbook.md`
- Benchmark: `docs/performance-benchmark.md`

## SPEC matrix — out of scope for this file (reminder)

| Area | Typical action |
|------|----------------|
| §5 HTTP API | Implementation map: `docs/spec-implementation-map.md`. |
| §8 SDK/UI edge | Advanced upload test cases (drag-drop, network errors). |
| §9 Dashboard | Stripe prod verified + optional hosted docs site. |
| §10 Pricing | M6-B production exit. |
| §12 / §15 NFR | After pilot: tune `COST_*` / `PRICE_*` from real traffic (`/stats/costs`). |
