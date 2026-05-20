# Fluxychat Deploy & Rollback Runbook

Operational runbook for production releases of the edge backend (`apps/worker`) and AI service (`apps/ai-agent`).

## 1) Pre-deploy checklist (go/no-go)

- [ ] No open P0/P1 incidents on core flows (messages, webhooks, auth, agent invoke).
- [ ] All tests pass in CI or locally:
  - `pnpm test` (root: all workspaces with a `test` script)
  - `pnpm -r lint` (dashboard, `packages/sdk`, `packages/ui`; workspaces without `lint` are skipped)
- [ ] Production environment variables verified:
  - `JWT_SECRET` / tenant auth secrets
  - valid `DB` binding
  - `RATE_LIMIT_KV` set to a real namespace (not a placeholder)
  - AI provider variables (if used)
- [ ] D1 migrations present and validated in staging.
- [ ] Deploy window communicated.
- [ ] Rollback owner assigned.

## 1.1) Config checklist (real environment)

### Worker (`apps/worker`)

- [ ] `DB` binding points to the correct D1 database.
- [ ] `ROOM` Durable Object migrated and active.
- [ ] `RATE_LIMIT_KV` set to a real namespace ID.
- [ ] `REQUIRE_ADMIN_AUTH=true`.
- [ ] `QUOTAS_ENABLED=true`.
- [ ] `DEFAULT_PROJECT_ID` only for bootstrap/dev, not real traffic.
- [ ] Tenant secrets in `project_secrets` (`jwt_secret`) or via the intended admin flow.
- [ ] Pricing/plan defaults verified:
  - `QUOTA_MESSAGES_PER_MONTH`
  - `QUOTA_AGENT_INVOKES_PER_MONTH`
  - `QUOTA_WEBHOOK_DELIVERIES_PER_MONTH`
  - `DEFAULT_PRICING_VERSION`

### AI agent (`apps/ai-agent`)

- [ ] `FLUXY_BASE_URL` points to the deployed worker.
- [ ] `REQUIRE_WEBHOOK_SIGNATURE=true`.
- [ ] `WEBHOOK_SECRET` or `WEBHOOK_SECRET_<projectId>` configured.
- [ ] `JWT_SECRET` or `JWT_SECRET_<projectId>` configured, no placeholder fallback.
- [ ] Provider secrets present (`OPENAI_API_KEY` or equivalents for agent config).

### Dashboard (`apps/dashboard`)

- [ ] `NEXT_PUBLIC_FLUXYCHAT_WORKER_URL` points to the correct worker.
- [ ] Admin session available for `Projects`, `Admin`, `Analytics`, `Agents`.
- [ ] Onboarding validated with:
  - project create
  - member JWT mint
  - room create
  - first message
  - first agent invoke

## 2) Deploy procedure (production)

Run from the monorepo root.

### Step A — Local sanity check

```bash
pnpm install
pnpm --filter @fluxychat/ai-agent test
pnpm --filter @fluxychat/dashboard test
pnpm --filter @fluxychat/worker test
pnpm --filter @fluxychat/dashboard build
```

### Step B — Apply D1 migrations

```bash
cd apps/worker
pnpm exec wrangler d1 migrations apply fluxychat --remote
```

If the deploy introduces no new migrations, this command should be a no-op.

### Step C — Deploy realtime Worker API

```bash
pnpm --filter @fluxychat/worker deploy
```

**Note on `wrangler deploy --env production`:** only use it if `apps/worker/wrangler.toml` defines an `[env.production]` section (or the target env) with consistent bindings/vars. While you use only the top-level block, the standard command is `pnpm --filter @fluxychat/worker deploy` (equivalent to `wrangler deploy` in the worker folder **without** `--env`).

### Step D — Deploy AI Agent service

```bash
pnpm --filter @fluxychat/ai-agent deploy
```

## 3) Post-deploy smoke checks (within 10 minutes)

Use a valid admin token (JWT with `owner`/`admin`/`moderator` roles).

**End-to-end smoke (bash, from repo root):** with `TEST_API_KEY` (`fc_` prefix) and optional `TEST_PROJECT_ID` / `WORKER_URL`:

```bash
export TEST_API_KEY=fc_...
export TEST_PROJECT_ID=<optional-uuid-to-verify-tid>
./scripts/smoke-test.sh
# or: ./scripts/smoke-test.sh --local
```

Covers: `/auth/token`, `/rooms`, `/messages`, `/api/messages`, `/billing/checkout` (also accepts `501` if Stripe is absent), quota probe, `/health`, `DELETE /gdpr/delete`.

**Quick option (stats only):** from `apps/worker`, after exporting or passing base URL and JWT:

```bash
pnpm run smoke:remote -- --base-url https://<worker-domain> --admin-jwt "<JWT_ADMIN>"
```

Automatically checks `/health`, `/stats/slo`, `/stats/costs`, `/stats/launch-kpis`. Then complete the curls below for ops and webhooks.

```bash
curl -sS https://<worker-domain>/health
curl -sS -H "Authorization: Bearer <JWT>" https://<worker-domain>/stats/ops?minutes=15
curl -sS -H "Authorization: Bearer <JWT>" https://<worker-domain>/stats/slo?minutes=15
curl -sS -H "Authorization: Bearer <JWT>" https://<worker-domain>/admin/webhooks/deliveries?limit=20
```

Minimum validations:

- [ ] `/health` returns `ok: true`.
- [ ] Error rate not in an abnormal spike.
- [ ] No rapid increase in webhook `failed` deliveries.
- [ ] `auth/token` and test message send exercised on smoke tenant.
- [ ] `/stats/costs` exposes `plan` and `usage` consistent with the smoke tenant.
- [ ] AI agent mention webhook rejects requests without a signature.

## 4) Rollback procedure (fast path)

Trigger rollback if:

- persistent error-rate increase above SLO target for more than 5–10 minutes;
- auth/authz regression;
- widespread webhook delivery failure;
- message send/read incidents on pilot tenants.

### Step A — Stop escalation

- Freeze new deploys.
- Open an incident with `trace_id` and time window.

### Step B — Restore previous version

Use the Cloudflare dashboard or CLI with a known previous version.
For DB rollback, avoid destructive downgrades: prefer fix-forward or disabling a feature flag.

### Step C — Immediate mitigation

- Temporarily disable the impacted feature (e.g. agent invoke, custom webhooks) if possible.
- Confirm recovery with section 3 smoke checks.

## 5) Minimum incident log (required)

For every rollback record:

- start/end timestamp;
- on-call owner;
- user/tenant impact;
- trigger metric (e.g. `requests_error`, `webhook_delivery_failed`);
- action taken;
- final state.

## 6) Monthly operational drill

Recommended frequency: once per month.

- Drill A: full deploy + smoke checks.
- Drill B: simulated rollback with recovery within ≤ 15 minutes.
- Drill C: validated restore of a test tenant from backup.

### Drill C — Practical procedure (tenant backup/restore)

Prerequisites:

- source room populated (`DRILL_SOURCE_ROOM_ID`);
- valid tenant API key;
- reachable worker (`FLUXY_BASE_URL`).

Command:

```bash
cd apps/worker
FLUXY_BASE_URL="https://<worker-domain>" \
FLUXY_API_KEY="fc_..." \
DRILL_SOURCE_ROOM_ID="room_prod_like_1" \
DRILL_MESSAGE_LIMIT="20" \
pnpm run drill:tenant-recovery
```

What the script verifies:

- export backup JSON from the source room (`/export/messages.json`);
- create a dedicated recovery room;
- controlled replay of backup messages;
- re-export the recovery room and compare counts.

Output:

- JSON artifact in `apps/worker/drills/tenant-recovery-<timestamp>.json`;
- `isRecoveryValid: true` when the recovery check passes.

Expected outcomes:

- runbook updated;
- operational gaps turned into roadmap tasks;
- evidence of mean recovery time.

## 7) End-to-end validation sequence

Run in this order before each closed rollout:

1. `pnpm --filter @fluxychat/worker test`
2. `pnpm --filter @fluxychat/ai-agent test`
3. `pnpm --filter @fluxychat/dashboard test`
4. `pnpm --filter @fluxychat/dashboard build`
5. `pnpm --filter @fluxychat/worker deploy`
6. `pnpm --filter @fluxychat/ai-agent deploy`
7. Real onboarding from the dashboard
8. Send first message
9. First agent invoke
10. Verify `stats/ops`, `stats/slo`, `stats/costs`, `stats/launch-kpis`
