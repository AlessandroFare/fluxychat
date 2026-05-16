# Smoke Test Guide

Run the smoke test after every production deploy and before opening to new tenants.
The test exercises the 8 critical paths in order and exits 1 on the first failure.

---

## Prerequisites

### 1. Set the worker URL

```bash
# Production
export WORKER_URL=https://api.fluxychat.com

# Local dev
export WORKER_URL=http://127.0.0.1:8787
```

Override at runtime without changing the env var:

```bash
./smoke-test.sh --local   # forces http://127.0.0.1:8787
```

### 2. Set the test API key

```bash
export TEST_API_KEY=sk_test_...
```

The key must belong to a real project in D1. Create one via the dashboard
(Onboarding → Create project) or via the API:

```bash
curl -sS -X POST https://api.fluxychat.com/admin/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OWNER_JWT>" \
  -d '{"name":"smoke-test-project"}'
```

The response includes `apiKey`. Store it and export it before running.

### 3. Optional: set the test project ID

```bash
export TEST_PROJECT_ID=proj_...
```

If not set, the smoke test uses the project embedded in `TEST_API_KEY`'s JWT claims.
The test writes and deletes ephemeral state under this project only.

---

## Running the test

```bash
./smoke-test.sh
```

Or with explicit env:

```bash
WORKER_URL=https://api.fluxychat.com TEST_API_KEY=sk_test_... TEST_PROJECT_ID=proj_... ./smoke-test.sh
```

---

## Expected output on full pass

```
══════════════════════════════════════════
  Fluxychat Smoke Test
══════════════════════════════════════════
  Target: https://api.fluxychat.com

[1] POST /auth/token                  → PASS  (token 2341 chars, userId smoke-alice)
[2] POST /rooms                       → PASS  (roomId smoke-test-room)
[3] POST /messages                    → PASS  (messageId 1234)
[4] GET /messages/:roomId             → PASS  (message 1234 retrieved)
[5] POST /billing/checkout            → PASS  (checkout URL received)
[6] POST /messages (quota exceeded)   → PASS  (402 + resetsAt field present)
[7] GET /health                       → PASS  (degradedFeatures: [])
[8] DELETE /gdpr/delete               → PASS  (ok: true)

Results: 8/8 passed
All checks passed.
```

Each line shows the step number, HTTP flow, a PASS/FAIL marker, and a one-line detail.
The exit code is 0.

---

## Interpreting failures

### Step 1 fails — POST /auth/token

**Symptom:** `FAIL  [1] POST /auth/token`

**Likely causes:**
- `TEST_API_KEY` is invalid or the project it belongs to was deleted → verify via dashboard or `GET /admin/projects`
- The key is a live key used against a test worker → use a test-mode key (`sk_test_...`)
- The worker's `/auth/token` handler is returning 500 → check `wrangler tail` for errors

**Check:** `curl -sf -X POST https://api.fluxychat.com/auth/token -H "Content-Type: application/json" -d '{"apiKey":"sk_test_..."}' | jq .`

---

### Step 2 fails — POST /rooms

**Symptom:** `FAIL  [2] POST /rooms`

**Likely causes:**
- The JWT from step 1 is missing the `tid` (project ID) claim → mint a token with `POST /auth/token` that includes a valid `projectId` in the payload
- The `projectId` in the JWT has no `project_plans` row → run `wrangler d1 execute fluxychat --env production --command "INSERT OR IGNORE INTO project_plans (project_id, plan_name, billing_status, pricing_version, updated_at, created_at) VALUES ('<projectId>', 'free', 'manual', 'v1', datetime('now'), datetime('now'))"`
- A room with the test room name already exists and is inaccessible → the script uses `smoke-test-room-<timestamp>` to avoid collisions

**Check:** `curl -sf -X POST https://api.fluxychat.com/rooms -H "Content-Type: application/json" -H "Authorization: Bearer <JWT>" -d '{"name":"smoke-test","type":"group"}'`

---

### Step 3 fails — POST /messages

**Symptom:** `FAIL  [3] POST /messages`

**Likely causes:**
- Monthly message quota exhausted for the test project → check billing status and usage in dashboard, or temporarily raise limits via `POST /admin/projects/<id>/plan`
- `ROOM_ID` from step 2 was not captured → script bug if this fails; re-run from step 2

**Check:** `curl -sf -X POST https://api.fluxychat.com/messages -H "Content-Type: application/json" -H "Authorization: Bearer <JWT>" -d '{"roomId":"<roomId>","content":"test"}'`

---

### Step 4 fails — GET /messages/:roomId

**Symptom:** `FAIL  [4] GET /messages/:roomId`

**Likely causes:**
- The message from step 3 used a different `roomId` than the one fetched in step 4 → script bug; re-run
- D1 read is failing → check `/health` for degraded DB status

**Check:** `curl -sf "https://api.fluxychat.com/api/messages?roomId=<roomId>&limit=10" -H "Authorization: Bearer <JWT>" | jq ".messages | length"`

---

### Step 5 fails — POST /billing/checkout

**Symptom:** `FAIL  [5] POST /billing/checkout`

**Likely causes:**
- `STRIPE_SECRET_KEY` is not configured on the worker → check `wrangler secret list --env production`; missing key means the checkout endpoint returns 500
- Stripe is in test mode but the key is a live key, or vice versa
- The project already has an active subscription → the endpoint may redirect instead of returning a URL (the test passes on either)

**Check:** `curl -sf -X POST https://api.fluxychat.com/billing/checkout -H "Content-Type: application/json" -H "Authorization: Bearer <JWT>" -H "X-Project-Id: <projectId>" -d '{"planName":"starter"}'`

---

### Step 6 fails — POST /messages (quota exceeded)

**Symptom:** `FAIL  [6] POST /messages over quota`

**Likely causes:**
- The project has enough remaining quota that step 3 did not hit the limit and step 6's forced quota-exhaustion attempt also succeeds → this is expected on large-plan projects (e.g., Pro). The test tries to exhaust quota by sending 100 rapid messages. If the limit is very high (>1M messages/month), this step may not reliably trigger a 402 in a smoke window.
- The project is on the `free` plan with quota disabled → check `QUOTAS_ENABLED=true` on the worker

**Check:** `curl -sf -X POST https://api.fluxychat.com/messages -H "Content-Type: application/json" -H "Authorization: Bearer <JWT>" -d '{"roomId":"<roomId>","content":"quota test"}' -w "\n%{http_code}"` — look for `402` in the last line.

---

### Step 7 fails — GET /health

**Symptom:** `FAIL  [7] GET /health`

**Likely causes:**
- Worker is returning 500 or unreachable → check Cloudflare dashboard for worker status
- `degradedFeatures` is non-empty → one of DB, DO, KV, or R2 bindings is degraded. Run `wrangler tail` and look for `logInfo("request.received"` entries to confirm the worker is receiving requests

**Check:** `curl -sf https://api.fluxychat.com/health | jq ".degradedFeatures"` — an empty array `[]` is the expected value.

---

### Step 8 fails — DELETE /gdpr/delete

**Symptom:** `FAIL  [8] DELETE /gdpr/delete`

**Likely causes:**
- The test user (from step 1 JWT `sub` claim) has no data to erase → the endpoint returns `ok: true` even with nothing to delete, so this should only fail on a 500 or auth error
- The JWT lacks `admin` or `owner` role → the endpoint requires an admin/owner JWT; the test uses the member JWT minted in step 1 (which has `member` role only) → the test should use an admin JWT for step 8

**Check:** `curl -sf -X DELETE https://api.fluxychat.com/gdpr/delete -H "Authorization: Bearer <ADMIN_JWT>"`

---

## D1 migration commands

Run from `apps/worker/`.

### Preview the migration plan (dry run)

```bash
cd apps/worker
npx wrangler d1 migrations apply fluxychat --env preview --dry-run
```

### Reset a preview database to match production

```bash
cd apps/worker
npx wrangler d1 reset fluxychat --env preview
npx wrangler d1 migrations apply fluxychat --env preview
```

### Apply migrations to production

```bash
cd apps/worker
npx wrangler d1 migrations apply fluxychat --env production
```

### Verify migration status after apply

```bash
npx wrangler d1 execute fluxychat --env production \
  --command "SELECT name, applied_at FROM d1_migrations ORDER BY name DESC LIMIT 5" --json
```

Expected: rows for `0028_webhook_secret_encryption.sql`, `0029_stripe_webhook_events.sql`, and `0030_project_plans_override_flag.sql`.

### Full fresh-production DB sequence

```bash
# 1. Verify the database name and ID in wrangler.toml match the Cloudflare dashboard
cd apps/worker
grep "database_name\|database_id" wrangler.toml

# 2. Dry-run to see what will be applied
npx wrangler d1 migrations apply fluxychat --env production --dry-run

# 3. Apply all pending migrations (0002 through 0030, skipping any already applied)
npx wrangler d1 migrations apply fluxychat --env production

# 4. Confirm applied migrations
npx wrangler d1 execute fluxychat --env production \
  --command "SELECT COUNT(*) as migration_count FROM d1_migrations" --json
```

Expected migration count: **30** (0002 through 0030, plus the implicit schema.sql baseline).