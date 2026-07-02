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

### Step A â€” Local sanity check

```bash
pnpm install
pnpm --filter @fluxy-chat/ai-agent test
pnpm --filter @fluxy-chat/dashboard test
pnpm --filter @fluxy-chat/worker test
pnpm --filter @fluxy-chat/dashboard build
```

### Step B â€” Apply D1 migrations

```bash
cd apps/worker
pnpm exec wrangler d1 migrations apply fluxychat --remote
```

If the deploy introduces no new migrations, this command should be a no-op.

### Step C â€” Deploy realtime Worker API

```bash
pnpm --filter @fluxy-chat/worker deploy
```

**Note on `wrangler deploy --env production`:** only use it if `apps/worker/wrangler.toml` defines an `[env.production]` section (or the target env) with consistent bindings/vars. While you use only the top-level block, the standard command is `pnpm --filter @fluxy-chat/worker deploy` (equivalent to `wrangler deploy` in the worker folder **without** `--env`).

### Step D â€” Deploy AI Agent service

```bash
pnpm --filter @fluxy-chat/ai-agent deploy
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

- persistent error-rate increase above SLO target for more than 5â€“10 minutes;
- auth/authz regression;
- widespread webhook delivery failure;
- message send/read incidents on pilot tenants.

### Step A â€” Stop escalation

- Freeze new deploys.
- Open an incident with `trace_id` and time window.

### Step B â€” Restore previous version

Use the Cloudflare dashboard or CLI with a known previous version.
For DB rollback, avoid destructive downgrades: prefer fix-forward or disabling a feature flag.

### Step C â€” Immediate mitigation

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
- Drill B: simulated rollback with recovery within â‰¤ 15 minutes.
- Drill C: validated restore of a test tenant from backup.

### Drill C â€” Practical procedure (tenant backup/restore)

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

1. `pnpm --filter @fluxy-chat/worker test`
2. `pnpm --filter @fluxy-chat/ai-agent test`
3. `pnpm --filter @fluxy-chat/dashboard test`
4. `pnpm --filter @fluxy-chat/dashboard build`
5. `pnpm --filter @fluxy-chat/worker deploy`
6. `pnpm --filter @fluxy-chat/ai-agent deploy`
7. Real onboarding from the dashboard
8. Send first message
9. First agent invoke
10. Verify `stats/ops`, `stats/slo`, `stats/costs`, `stats/launch-kpis`

## 8) Secrets rotation

Periodic rotation of cryptographic and provider secrets. Cadence: every
90 days for JWT, Clerk, and Stripe secrets; immediately on any
compromise suspicion. Each rotation has a grace window so in-flight
requests don't fail.

### 8.1) `JWT_SECRET` (worker)

The Worker accepts a previous secret during a 24h overlap window so
clients that haven't yet refreshed their token still verify.

1. Generate a new 256-bit secret:
   ```bash
   openssl rand -base64 32
   ```
2. Set `JWT_SECRET_PREVIOUS` to the current `JWT_SECRET` value.
3. Set `JWT_SECRET_PREVIOUS_EXPIRES_AT` to `now() + 24h` (ISO 8601, UTC).
4. Update `JWT_SECRET` to the new value.
5. Deploy the worker (`pnpm --filter @fluxy-chat/worker deploy`).
6. Wait 24h. Remove `JWT_SECRET_PREVIOUS` and `JWT_SECRET_PREVIOUS_EXPIRES_AT`.
7. Re-deploy.

In a compromise: skip the 24h window â€” set `JWT_SECRET_PREVIOUS_EXPIRES_AT` to a past timestamp so the previous secret is rejected immediately after deploy.

### 8.2) Clerk keys (dashboard + worker)

1. Roll the key in the Clerk dashboard: **API Keys â†’ Roll key**.
2. Update `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in:
   - Cloudflare Workers secrets (per env): `wrangler secret put CLERK_SECRET_KEY`
   - Vercel/Next.js env vars: dashboard or `vercel env rm` + `vercel env add`
3. Deploy both the worker and the dashboard in the same maintenance
   window. There is **no overlap window** for Clerk â€” the old key is
   invalidated the moment Clerk issues the new one.
4. Notify the team 15 minutes in advance; pause any automated test
   runs that depend on the Clerk test keys.

### 8.3) `STRIPE_WEBHOOK_SECRET` (worker)

1. Roll the secret in the Stripe dashboard: **Webhooks â†’ endpoint â†’ Roll secret**.
2. Stripe stops accepting signatures from the old secret immediately.
3. Update `STRIPE_WEBHOOK_SECRET` in the worker secrets:
   `wrangler secret put STRIPE_WEBHOOK_SECRET`.
4. Deploy the worker.
5. Verify by replaying one recent webhook from the Stripe dashboard
   (Webhooks â†’ endpoint â†’ Send test event) and confirming
   `200 OK` with `verified: true` in the response.

### 8.4) `WORKFLOW_SIGNING_SECRET` (worker, if enabled)

Treat identically to `STRIPE_WEBHOOK_SECRET`: roll the secret in
`secrets-crypto.js` rotation flow, redeploy, verify with a signed
request.

### 8.5) Per-tenant `project_secrets.jwt_secret`

The `admin/jwt-rotate` endpoint handles this for individual tenants.
Run only when a tenant reports a leak or on the tenant's request â€”
do not rotate globally.

