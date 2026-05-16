 Prioritized Findings — M6 Security Review

  ---
  **Verification sweep (May 2026):** `checkAndConsumeProjectQuota` uses a conditional `UPDATE` so quota consumption is atomic at the boundary (revisit if any code path increments usage without this pattern). **Rate limiting:** when `RATE_LIMIT_KV` is bound, KV errors return `allowed: false` with `reason: kv_error` (no silent fallback); in-memory fallback only applies when KV is **not** configured and `RATE_LIMIT_FALLBACK_ALLOW=true` (or `ECC_HOOK_PROFILE=minimal`) — avoid `minimal` on public beta. **Outbound webhooks:** `resolveWebhookSigningSecret` fails closed on decrypt/key errors; webhooks with `secret_hash` / ciphertext / plaintext configured but no resolvable secret block pending deliveries (`signing_secret_unavailable`). Unsigned delivery remains allowed only for webhooks with no signing material. **GDPR erasure:** deletes R2 objects via attachment keys (URL → key) and lists the `{projectId}/{userId}/` upload prefix; D1 tables include moderation_events and operational_audit_events; `agent_runs` scoped by member/message rooms; **payload redaction** in `automation_events` + `webhook_deliveries` via `lib/gdpr-payload-redaction.js` (deep `userId` / `fromUserId` / `toUserIds`, etc.). **Dashboard JWT:** `sessionStorage` (not httpOnly) — see **Dashboard session & CSP** below. **Worker JWT (`lib/jwt-auth.js`):** dummy-key verify path for unknown projects; generic `401` after crypto; unit tests in `lib/jwt-auth.test.js`. **LLM tool calls (`lib/agent-tool-calls.js`):** rejects OpenAI `function.name` / `function.arguments` and Anthropic `tool_use` via shared validator. **Quota paths:** HTTP `POST /messages` and Room DO WS `message` / stream `start` both call `checkAndConsumeProjectQuota` with `messages_created` (see `lib/quota-paths.test.js`). **HTTP surface:** domain routes under `apps/worker/src/routes/*-http.js`; Stripe inbound webhook in `lib/stripe-billing.js` + `routes/billing-stripe-http.js`. **Tests (targeted):** `routes/gdpr-http.test.js` (D1 redaction + R2 `deleteUserAttachmentObjects`), `durable-objects/room-do.test.js` (WS quota), `lib/agent-tool-calls.test.js` (Anthropic edges). **CI:** PR/push runs unit tests + dashboard Playwright smoke; full worker+dashboard E2E is `workflow_dispatch` job `e2e-integrated` (requires repo secret `E2E_ADMIN_JWT` + worker `.dev.vars` in the runner environment).

  ---
  Dashboard session & CSP (pre-beta documentation)

  **Where tokens live:** Console admin/member JWTs are stored in `sessionStorage` under `fluxychat.dashboard.session.v1` (`apps/dashboard/app/components/dashboard-session.tsx`), with one-time migration from `localStorage`. They are **not** httpOnly cookies, so any XSS in the dashboard origin can read them until the tab closes.

  **Mitigations in product today:** Prefer short-lived member JWTs from your backend; do not paste production tokens into shared machines; use Clerk for human auth where enabled.

  **Recommended CSP for production dashboard** (adapt hostnames): enable `CSP_ENABLED=true` on the Worker where applicable; for Next.js, set headers via middleware or hosting config, for example:
  - `default-src 'self'`
  - `script-src 'self'` (avoid inline scripts; use nonces if required)
  - `connect-src 'self' <WORKER_URL> <CLERK_HOSTS>`
  - `img-src 'self' data: https:` (attachment CDN hosts as needed)
  - `frame-ancestors 'none'`
  - `base-uri 'self'`

  **Support correlation:** Worker responses include `X-Trace-Id` and, for HTTP `4xx`/`5xx`, `traceId` in the JSON body (`lib/http-json.js`). Dashboard `lib/worker-fetch.ts` appends `(trace: …)` from the header or body.

  **Dashboard CSP (opt-in):** set `DASHBOARD_CSP_ENABLED=true` in the dashboard env to emit CSP + frame denial headers from `middleware.ts` (see `.env.example`).

  ---
  Post-beta / load hardening (P2 — documented, not blocking first testers)

  **P2-2 / P2-3 / P2-5 — Room DO hibernation (partial mitigation May 2026):** `projectId` / `roomId` are persisted in DO storage on WS/SSE auth (`persistRoomContext`) and restored on wake (`ensureStorageHydrated` in `fetch`). In-memory `clients`, `userIds`, `wsRateLimitStore`, and SSE writers are still lost on hibernation; presence may briefly show stale counts; WS rate limits reset; SSE clients receive `data: {"type":"close","reason":"hibernation"}` when writers are cleaned up. Full fix: persist presence/rate buckets in D1 or DO storage.

  **P1-2 — JWT timing oracle (mitigated May 2026):** `lib/jwt-auth.js` runs HMAC verify with a dummy key **before** the `project_secrets` DB lookup; invalid `tid`/`sub` shapes get generic `401` without DB. Residual enumeration via DB timing is low priority unless observed in production.

  ---
  Beta gate (May 2026)

  Use this table for **closed beta** (internal + a few pilot tenants) vs **wider beta**. It reflects code/tests in-repo plus ops that must be run on a deployed host (`docs/m6-operational-checklist.md`).

  ### Code & CI (automated)

  | Gate | Status | Evidence / notes |
  |------|--------|------------------|
  | Monorepo unit tests | ✅ | `pnpm test` — worker (91), dashboard (6), sdk, ui, agent, ai-agent |
  | Worker modularization | ✅ | HTTP routes, `durable-objects/room-do.js`, `lib/agent-runtime.js`, shared libs |
  | Targeted security/regression tests | ✅ | `gdpr-http.test.js`, `jwt-auth.test.js`, `quota-paths.test.js`, `room-do.test.js`, `agent-tool-calls` Anthropic |
  | Dashboard production build | ✅ required | `pnpm --filter @fluxychat/dashboard build` must pass before console deploy |
  | CI on PR/push | ✅ | Unit tests + Playwright onboarding smoke (`e2e-smoke` job) |
  | Integrated E2E (worker + dashboard) | Manual | GitHub Actions `workflow_dispatch` → job `e2e-integrated`; secret `E2E_ADMIN_JWT` |

  ### Security mitigations (M6 — code complete for beta scope)

  | ID | Topic | Beta status |
  |----|--------|-------------|
  | P0-1 | GDPR R2 delete | ✅ `deleteUserAttachmentObjects` + test |
  | P0-2 | Quota race | ✅ Atomic `UPDATE … WHERE used_value + ? <= limit` (`project-plan-quota.js`) |
  | P0-3 | Stripe checkout dedup | ✅ `INSERT OR IGNORE` on `stripe_webhook_events` (`stripe-billing.js`); optional if billing off |
  | P0-4 | KV error → in-memory fallback | ✅ KV errors → `kv_error` / deny; do **not** set `RATE_LIMIT_FALLBACK_ALLOW` in prod |
  | P0-5 | GDPR missing tables | ✅ Erasure path covers moderation, automation redaction, agent_runs, audit |
  | P0-6 | Webhook HMAC length leak | ✅ `timingSafeEqual` in `lib/crypto-timing.js` |
  | P1-1 | Unsigned webhook on decrypt fail | ✅ Fail closed / block deliveries |
  | P1-2 | JWT timing oracle | ⚠️ Mitigated (dummy verify pre-DB); residual DB timing — monitor |
  | P1-3 | Malformed tool calls | ✅ `lib/agent-tool-calls.js` |
  | P1-4 | Post-erasure payload PII | ✅ `lib/gdpr-payload-redaction.js` |
  | P1-5 | Plaintext webhook secrets | ✅ Register requires encryption unless dev flag |
  | P1-6 | Stripe plan limit drift | ⏸ Post-beta if manual overrides used |

  ### Infra & config (must verify on target env)

  | Gate | Closed beta | Wider beta |
  |------|-------------|------------|
  | D1 migrations applied remote | Required | Required |
  | `RATE_LIMIT_KV` real namespace IDs in `wrangler.toml` | Recommended | **Required** (replace `REPLACE_WITH_*`) |
  | `ALLOWED_ORIGINS` explicit (not `*`) | Recommended | **Required** |
  | `WEBHOOK_SECRET_ENCRYPTION_KEY` if webhooks | If using webhooks | **Required** |
  | `DASHBOARD_CSP_ENABLED=true` | After UI smoke | Recommended |
  | R2 `ATTACHMENTS` bound | If uploads | Required |
  | ai-agent deploy + D1 ID | Only if @mention AI | If @mention AI |
  | Billing / Stripe live | Optional (`paymentsEnabled: false` OK) | Per GTM |

  ### Ops checklist (human — not substitutable by Vitest)

  1. Deploy worker (+ ai-agent if needed) — `RUNBOOK_DEPLOY_ROLLBACK.md`
  2. `pnpm run smoke:remote` with admin JWT on production/staging URL
  3. Pilot tenant: onboarding → room → message → (agent invoke) — `m6-operational-checklist.md` Fase 3
  4. Optional: `perf:workload-check` on real env — Fase 4

  ### Explicitly post-beta (documented, OK for first testers)

  - P2 DO hibernation: partial (`persistRoomContext`); presence/WS rate limits still in-memory
  - P2 SSE reconnect storms under load
  - Full JWT verify-before-DB / constant-time project lookup
  - SSRF hardening gaps on `isPrivateUrl` (decimal IP, DNS rebind) — see §2 in this doc

  **Verdict:** **Closed beta** is unblocked once dashboard build is green, smoke remote passes on deployed worker, and KV/origins are set for your threat model. **Wider/public beta** additionally requires KV IDs, production secrets checklist, and completed pilot Fase 3.

  ---
  P0 — Blocks go-live

  #: P0-1
  Finding: R2 objects never deleted on GDPR erasure (CRITICAL)
  Justification: GDPR Article 17 violation — PII persists in R2 storage after erasure is legally complete. No partial fix.
  ────────────────────────────────────────
  #: P0-2
  Finding: Quota race: concurrent requests at limit both pass (CRITICAL)
  Justification: Paying tenants exceed quota without detection. Every concurrent request pair at the boundary overages by 1. Hard fix: atomic UPDATE ... WHERE used_value
  +
    1 <= limit.
  ────────────────────────────────────────
  #: P0-3
  Finding: Stripe checkout.session.completed dedup race (HIGH → P0)
  Justification: Stripe retries → duplicate INSERT → 500 crash → compounding retries. Can double-charge a customer in the same billing cycle.
  ────────────────────────────────────────
  #: P0-4
  Finding: KV error silently falls through to in-memory fallback (HIGH → P0)
  Justification: catch swallows all KV errors → per-isolate limits active → attacker bypasses rate limits by N×isolate_count. KV degradation makes this actively
    exploitable today.
  ────────────────────────────────────────
  #: P0-5
  Finding: GDPR erasure missing 4 tables (moderation_events, automation_events, agent_runs, operational_audit_events)
  Justification: Non-compliant. User's moderation actions, audit trails, and agent run logs retained.
  ────────────────────────────────────────
  #: P0-6
  Finding: timingSafeEqual length branch leaks signature length (HIGH → P0)
  Justification: Timing oracle on HMAC verification. Attacker statistically fingerprinting signature length narrows brute-force search space. 6-line fix.

  ---
  P1 — Fix before first paying customer

  #: P1-1
  Finding: Decrypt failure silently fires unsigned webhook
  Justification: Encrypted row fails to decrypt → null → if (secret) guard skips signature header → unsigned webhook delivered. Receiver accepts unsigned payload with no
    error signal.
  ────────────────────────────────────────
  #: P1-2
  Finding: JWT exp checked after DB query; !row timing oracle (partially mitigated May 2026 — see verification sweep / `lib/jwt-auth.js`)
  Justification: Project ID enumeration via timing (~100 samples). Even a validly-signed expired token reveals project existence before rejection.
  ────────────────────────────────────────
  #: P1-3
  Finding: Malformed tool call passes undefined name/arguments (mitigated May 2026 — `lib/agent-tool-calls.js`)
  Justification: Was: no schema validation in extractOpenAIToolCalls. Now: normalize OpenAI `function.name` / `function.arguments`, reject invalid payloads before `executeToolCall`.
  ────────────────────────────────────────
  #: P1-4
  Finding: automation_events + webhook_deliveries payloads contain post-erasure userId (mitigated May 2026 — `lib/gdpr-payload-redaction.js`)
  Justification: Was: only shallow JSON_REPLACE on `$.userId`. Now: deep redaction on erasure + cancel pending deliveries; third-party systems that already received webhooks are out of band.
  ────────────────────────────────────────
  #: P1-5
  Finding: Webhook secrets stored plaintext when WEBHOOK_SECRET_ENCRYPTION_KEY absent (mitigated May 2026 — `prepareWebhookSecretForStorage`)
  Justification: Register/PATCH reject secrets without encryption unless `ALLOW_PLAINTEXT_WEBHOOK_SECRETS=true` (local dev). Set `WEBHOOK_SECRET_ENCRYPTION_KEY` in prod. Existing plaintext rows still need migration/re-encrypt.
  ────────────────────────────────────────
  #: P1-6
  Finding: Stripe upsert preserves plan_name but not limits on manual override
  Justification: If a tenant customizes limits post-purchase and then downgrades via Stripe, plan_name changes but custom limits persist — plan limits drift from plan
    name.

  ---
  P2 — Fix within 30 days


  #: P2-1
  Finding: 402 quota response has no Retry-After or reset timestamp
  Justification: SDK/client cannot surface "quota resets in N seconds" to the user. Contrast: rate limit 429 responses correctly include retryAfterSeconds.
  ────────────────────────────────────────
  #: P2-2
  Finding: Presence state lost on DO hibernation; reconnect storm risk
  Justification: this.clients/this.userIds cleared on wake. First reconnect broadcasts online: 1 to all hibernated clients simultaneously.
  ────────────────────────────────────────
  #: P2-3
  Finding: SSE writers orphaned on DO hibernation; no clean EOF
  Justification: TransformStream writable side dead after wake. Client hangs until timeout. No event: close or data: [DONE] sentinel.
  ────────────────────────────────────────
  #: P2-4
  Finding: broadcast() Set mutation inside for...of
  Justification: sseClients.delete(writer) during iteration. Works by accident (Set iterator not invalidated), but is a maintenance hazard. WS path silently swallows dead

    client errors.
  ────────────────────────────────────────
  #: P2-5
  Finding: WS rate limit store lost on DO hibernation
  Justification: Rate limit buckets reset on wake — same issue as in-memory fallback but scoped per-room. Less severe since DO is single-threaded.
  ────────────────────────────────────────
  #: P2-6
  Finding: ai-agent verifyWebhookSignature uses plain ===
  Justification: Not timing-safe. Inconsistent with main worker. Requires compromise of webhook endpoint first (lower severity).
  ────────────────────────────────────────
  #: P2-7
  Finding: ai-agent service JWT hardcoded 1h expiry, no refresh
  Justification: Workers running >1h silently get expired JWTs for bot-to-Fluxychat calls. No alerting.

  ---
  Summary count

  ┌──────────┬───────┬─────────────────────────────────────────────────────────────────────────────────┐
  │ Priority │ Count │                                    Key theme                                    │
  ├──────────┼───────┼─────────────────────────────────────────────────────────────────────────────────┤
  │ P0       │ 6     │ GDPR storage, quota revenue, payment processing, rate limit integrity, crypto   │
  ├──────────┼───────┼─────────────────────────────────────────────────────────────────────────────────┤
  │ P1       │ 6     │ Webhook auth failures, JWT timing oracle, LLM tool call integrity, erasure gaps │
  ├──────────┼───────┼─────────────────────────────────────────────────────────────────────────────────┤
  │ P2       │ 7     │ UX (no retry-after), DO hibernation state, dead client cleanup                  │
  └──────────┴───────┴─────────────────────────────────────────────────────────────────────────────────┘


Here's the full assessment:

  ---
  Security Review: apps/worker/src/worker.js

  ---
  1. JWT HMAC Verification

  Level: MEDIUM → CRITICAL in context

  verifyJwtAndGetContext (line 4739):
  // Line 4757: Claims extracted
  const { sub: userId, tid: projectId, roles = [], exp } = payloadJson;

  // Line 4761: exp checked AFTER claims extraction
  if (exp && Date.now() / 1000 > exp) {
    throw new Response("Token expired", { status: 401 });
  }

  // Line 4765-4769: projectId (attacker-controlled) used in DB query
  const row = await env.DB.prepare(
    "SELECT jwt_secret FROM project_secrets WHERE project_id = ?"
  ).bind(projectId).first();

  // Line 4785: HMAC verify — Web Crypto, timing-safe ✓
  const ok = await crypto.subtle.verify("HMAC", key, sig, data);

  Findings:
  - HMAC comparison is timing-safe via crypto.subtle.verify() — no timing oracle on the signature itself. ✓
  - exp is NOT checked first. Claims are extracted (line 4757) before expiry validation (line 4761). This means a validly-signed token for a revoked user
  still leaks userId/projectId/roles into the function's return value. Any caller that doesn't null-check before using auth.userId would operate on a stale
  identity.
  - Timing oracle on project existence. The if (!row) check (line 4770) creates an early return that reveals whether a projectId exists in project_secrets.
  An attacker can enumerate valid project IDs via response timing — no signature needed for this fingerprint.

  Recommendation: Move exp check to line 1 (before any claims extraction or DB ops). Add a constant-time delay or always query project_secrets even when exp
   is missing.

  ---
  2. isPrivateUrl() SSRF Guard

  Level: MEDIUM (guarded, but has gaps)

  isPrivateUrl (line 5621):
  function isPrivateUrl(urlString) {
    const parsed = new URL(urlString);
    const hostname = parsed.hostname.toLowerCase();
    // Blocks: http(s) schemes ✓, localhost/127.0.0.1/::1/0.0.0.0 ✓
    // Blocks: .local/.internal/.localhost TLDs ✓
    // Blocks: 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x, 0.0.0.0/8 ✓
    // Blocks: IPv6 fc00::/fd::/fe80:: ✓
    // ... but misses:
  }

  Unchecked bypass vectors:

  Bypass: Unclosed bracket IPv6
  Example: http://[::1/run
  Why it slips through: new URL() parses [::1 as hostname, no IPv6 detection
  ────────────────────────────────────────
  Bypass: IPv4-mapped IPv6
  Example: http://[::ffff:127.0.0.1]/
  Why it slips through: ::ffff:127.0.0.1 doesn't start with fc/fd/fe80
  ────────────────────────────────────────
  Bypass: Decimal IP
  Example: http://2130706433/
  Why it slips through: 2130706433 → 127.0.0.1, regex won't match
  ────────────────────────────────────────
  Bypass: Null-byte in hostname
  Example: http://localhost%00.example.com/
  Why it slips through: parsed.hostname becomes localhost, block fires — but %00 may be normalized earlier depending on input path
  ────────────────────────────────────────
  Bypass: DNS Rebinding
  Example: Attacker controls DNS for their domain → first resolves to public IP (passes check), second resolves to 169.254.169.254 (cloud metadata)
  Why it slips through: No binding check per request; no stored DNS anchor

  Recommendation:
  1. Add [ detection to catch unclosed IPv6 brackets.
  2. Normalize hostname (lowercase + punycode) before all checks.
  3. Add a DNS anchor: resolve the hostname once, store the first IP, reject if subsequent resolution differs and points to private range.
  4. Consider a blocklist on resolved IPs rather than hostname patterns.

  ---
  3. @mention → automation_events → Agent Execution Pipeline

  Level: LOW (not directly exploitable as system prompt injection, but worth monitoring)

  The data flow:
  User sends message "@agent hello"          → ws onMessage (line 6480)
    → automation_events INSERT with payload   → line 2964-2973
      → triggerCheck() / AgentRouter         → line 2964
        → executeAgentRun()                  → line 6013
          → systemPrompt = agentRow.system_prompt  (line 6018, DB-sourced)
          → messages = [system] + history + userMessage  (line 6038-6052)

  Key finding: The user message does not become the system prompt. It is appended as a user-role message in the conversation history (line 6050). This is
  safe from direct prompt injection.

  Potential indirect concern: If the system_prompt column in the bots table is user-configurable (set by the bot owner, not the message sender), malicious
  prompt templating could exist in a custom agent. But that's an insider/tenant threat, not a cross-user injection. The room name is not used anywhere in
  executeAgentRun — only userMessage (the triggering message content) reaches the LLM.

  Recommendation (defense-in-depth): Add a system prompt linting/filtering step that strips known prompt injection patterns (e.g., Ignore previous
  instructions, \n SYSTEM:\n) before the prompt is used in the LLM call.

  ---
  4. ?token= Query Param on WebSocket Connect

  Level: LOW (CF platform concern, not code defect)

  handleWebSocket (line 6408):
  webSocket.accept();
  const auth = await verifyJwtAndGetContext(request, this.env).catch((err) => {
    console.error("RoomDurableObject JWT verify error", err); // err is Error, not full URL
    return null;
  });

  verifyJwtAndGetContext reads the token from url.searchParams.get("token") (line 4744) — the query param is never directly logged in the worker code
  itself.

  Cloudflare Workers platform context:
  - CF Workers default access logs include the full request URL (path + query string). The ?token=... would be visible in CF Dashboard logs, Tail log
  streams, and any log drain attached to the worker.
  - CF log format: {"event":"fetch","request":{"url":"https://.../ws/room/...?token=..."}} — token is in the URL field.
  - console.error in the worker only logs the Error object, not the request URL — the code is careful here. ✓

  Recommendation:
  1. Prefer passing the token via Sec-WebSocket-Protocol header or a subprotocol — query strings are easier to accidentally include in shared logs.
  2. If query param is required, ensure CF log redacting is configured (if available in your CF plan).
  3. Alternatively: short-lived WS session tokens with tight expiry reduce the window of token exposure.

  ---
  Summary Table

  ┌─────┬────────────────────────┬──────────┬────────────────────────────────────────────────────────────────────────────────────────────┐
  │  #  │          Area          │ Severity │                                           Issue                                            │
  ├─────┼────────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 1a  │ JWT exp check ordering │ MEDIUM   │ Exp checked after claims extracted — stale auth context possible                           │
  ├─────┼────────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 1b  │ JWT timing oracle      │ HIGH     │ Project ID enumeration via !row timing (no sig needed)                                     │
  ├─────┼────────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 2   │ SSRF guard gaps        │ MEDIUM   │ IPv6 bracket edge case, IPv4-mapped, decimal IP, DNS rebinding                             │
  ├─────┼────────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 3   │ Prompt injection       │ LOW      │ User message not in system prompt; indirect risk only if agent owner sets malicious prompt │
  ├─────┼────────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 4   │ WS token logging       │ LOW      │ CF platform auto-logs URL with token; code itself is clean                                 │
  └─────┴────────────────────────┴──────────┴────────────────────────────────────────────────────────────────────────────────────────────┘



Code Review: RoomDurableObject — apps/worker/src/worker.js

  ---
  1. WebSocket Broadcast — Set Mutation During Iteration

  Level: MEDIUM

  broadcast() (line 6851):
  broadcast(message) {
    const payload = JSON.stringify(message);
    for (const client of this.clients) {   // ← iterates Set
      try {
        client.send(payload);              // ← async, can yield
      } catch {
        // ignore broken clients          // ← silently drops errors
      }
    }
    const sseData = `data: ${payload}\n\n`;
    for (const writer of this.sseClients) { // ← iterates Set
      try {
        writer.write(new TextEncoder().encode(sseData));
      } catch {
        this.sseClients.delete(writer);   // ← modifies Set while iterating!
      }
    }
  }

  Issue (line 6865): sseClients.delete(writer) inside the for...of loop. Set.delete() does not invalidate the current iterator — iteration continues safely.
   However, it's semantically wrong: deleting during iteration is a well-known antipattern and a maintenance hazard.

  WebSocket clients this.clients iteration (line 6853): client.send() is async but not awaited, so the loop fires all sends synchronously and yields at most
   once per client. If a client throws mid-send, the catch swallows it silently — no cleanup of dead clients in the WS path (unlike the SSE path). Live
  clients remain in this.clients indefinitely until a future send fails.

  Recommendation: Use for (const writer of [...this.sseClients]) to snapshot the Set before mutation. For WS clients, consider tracking dead sockets via a
  separate removeClients pass after the send loop.

  ---
  2. D1 Writes — Concurrent Insert + Broadcast Interleaving

  Level: LOW (handled by D1 transactionality, but ordering is non-deterministic)

  onMessage → message path (lines 6563–6674):
  // Step 1: INSERT (awaits)
  const result = await this.env.DB.prepare(
    "INSERT INTO messages ..."
  ).bind(...).run();
  messageId = result.meta.last_row_id;

  // Step 2: INSERT attachments (awaits)
  await this.env.DB.batch(attachments.map(...));

  // Step 3: INSERT mentions + events (awaits)
  await this.env.DB.batch(mentions.map(...));

  // Step 4: broadcast (sync, no await)
  this.broadcast(payload);

  Concurrent client scenario:
  - Client A inserts message → broadcast fires → Client B receives
  - Client B inserts message → broadcast fires → Client A receives
  - Both clients see messages in createdAt order if clients sort locally, or potential out-of-order display if the frontend appends by arrival time.

  No duplicate insert risk: D1 INSERT is atomic per statement. last_row_id is stable per connection.

  No lost message risk from insert/broadcast interleaving: If the DO hibernates after INSERT but before broadcast, schedulePostMessageAutomations (line
  6676) fires void-style — no await, no guarantee it runs. The message is in D1, but connected clients may not see it until the DO wakes on the next message
   or SSE ping.

  Recommendation: Make broadcast synchronous after all DB writes complete (it already is). Add idempotency: frontend deduplicates by id field on incoming
  messages.

  ---
  3. In-Memory State — Loss on Hibernation / Reconnect

  Level: MEDIUM (functional gap)

  State held in memory (initialized in constructor, line 6397):
  this.clients = new Set();           // ← lost on hibernation
  this.sseClients = new Set();        // ← lost on hibernation
  this.moderationCache = new Map();   // ← lost on hibernation
  this.userIds = new Map();           // ← lost on hibernation
  this.projectId = null;              // ← lost on hibernation
  this.wsRateLimitStore = new Map();  // ← lost on hibernation

  Recoverable on reconnect:

  ┌────────────────────────────────┬───────────────────────────────────────────────────────────────────────┬─────────────────────────────────────────┐
  │             State              │                               Recovery                                │                  Notes                  │
  ├────────────────────────────────┼───────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────┤
  │ this.clients / this.sseClients │ ✅ Re-add via handleWebSocket                                         │ Fresh clients.add() on each WS connect. │
  ├────────────────────────────────┼───────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────┤
  │ this.projectId                 │ ✅ Re-set in handleWebSocket                                          │ auth.projectId from JWT re-populates.   │
  ├────────────────────────────────┼───────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────┤
  │ this.userIds                   │ ✅ Re-populated on reconnect                                          │ Map refilled at line 6427.              │
  ├────────────────────────────────┼───────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────┤
  │ Online presence count          │ ✅ Rebuilt from this.clients.size + Array.from(this.userIds.values()) │ Accurate on reconnect.                  │
  └────────────────────────────────┴───────────────────────────────────────────────────────────────────────┴─────────────────────────────────────────┘

  NOT recoverable (lost on hibernation):

  State: this.moderationCache
  Impact: 10s cache purged. Next request hits D1.
  ────────────────────────────────────────
  State: this.wsRateLimitStore
  Impact: Rate limit resets. A client hammering messages before hibernation could be rate-limited; after hibernation the bucket is gone — limits bypassed
  for
     up to 1 request burst.
  ────────────────────────────────────────
  State: Presence for connected clients
  Impact: Other clients miss the presence broadcast for the disconnecting client until they reconnect.

  Recommendation: Use state.storage to persist wsRateLimitStore across hibernation if rate-limit integrity matters. Alternatively, rely on CF's global rate
  limiting (if configured) as a backstop.

  ---
  4. SSE via TransformStream — Hibernate Mid-Stream

  Level: MEDIUM (silent hang, not clean EOF)

  fetch() SSE path (lines 6923–6974):
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();  // ← local variable, no state persistence
  const encoder = new TextEncoder();
  this.sseClients.add(writer);          // ← writer reference kept in Set

  const heartbeat = setInterval(() => {
    try {
      writer.write(encoder.encode(": heartbeat\n\n"));  // ← if writer is closed, this throws
    } catch {
      clearInterval(heartbeat);
      this.sseClients.delete(writer);   // ← self-cleanup on failure
    }
  }, 30_000);

  const cleanup = () => {
    clearInterval(heartbeat);
    this.sseClients.delete(writer);
    try { writer.close(); } catch {}
  };

  const projectId = this.projectId;
  this.env.DB.prepare(...).then(async (result) => {  // ← fire-and-forget, no error surface
    ...
    await writer.write(...);  // ← if DO hibernated, promise hangs; .catch(() => {}) swallows error
  }).catch(() => {});

  Hibernation scenarios:

  1. DO hibernates before history write completes. The .then() promise never resolves. The client hangs on an empty response. No cleanup fires. The writer
  stays in this.sseClients — it gets a heartbeat (line 6941) or removed on the next heartbeat error.
  2. DO hibernates during SSE stream. The setInterval for heartbeat keeps firing as long as the isolate is alive. If the DO itself hibernates (no requests
  for ~10s), the interval is cleared when the isolate is destroyed. The client's read end of the TransformStream gets no EOF — just silence until the client
   times out or reconnects.
  3. Client disconnects. request.signal.abort fires → cleanup() → writer.close(). The SSE writer is removed from the Set. ✅

  No clean EOF on DO hibernation: The TransformStream read end is never explicitly ended. The client sees:
  GET /sse → 200 OK (headers) → hangs → timeout
  No data: [DONE]\n\n or event: close\n\n sentinel is ever written.

  Recommendation:
  1. Send a data: <heartbeat>\n\n immediately on connection so the client knows the stream is alive.
  2. Write a sentinel event on hibernation: use state.storage to track active SSE clients and write a final event if the DO wakes from hibernation.
  3. Alternatively, use CF's SSE + Durable Objects pattern where the DO signals via ReadableStream.close() when hibernating.

  ---
  Summary Table

  ┌─────┬───────────────────────────────┬──────────┬───────────────────────────────────────────────────────────────────────────────────────────────┐
  │  #  │             Area              │ Severity │                                            Finding                                            │
  ├─────┼───────────────────────────────┼──────────┼───────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 1   │ broadcast() Set mutation      │ MEDIUM   │ sseClients.delete() inside for...of; works by luck but is a maintenance hazard                │
  ├─────┼───────────────────────────────┼──────────┼───────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 1   │ WS dead client cleanup        │ LOW      │ catch swallows errors silently — dead WS clients never removed from this.clients              │
  ├─────┼───────────────────────────────┼──────────┼───────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 2   │ Concurrent insert ordering    │ LOW      │ No duplicates, but ordering is non-deterministic across concurrent clients                    │
  ├─────┼───────────────────────────────┼──────────┼───────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 3   │ wsRateLimitStore in-memory    │ MEDIUM   │ Rate limit buckets lost on hibernation — potential limit bypass                               │
  ├─────┼───────────────────────────────┼──────────┼───────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 4   │ SSE hibernation               │ MEDIUM   │ No EOF sentinel, no ReadableStream.close() on hibernation — clients hang silently             │
  ├─────┼───────────────────────────────┼──────────┼───────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 4   │ History fetch fire-and-forget │ LOW      │ Unawaited promise with .catch(() => {}) — history silently lost if DO hibernates during query │
  └─────┴───────────────────────────────┴──────────┴───────────────────────────────────────────────────────────────────────────────────────────────┘


 Stripe Webhook Review: apps/worker/src/worker.js

  1. Deduplication Race Condition

  Level: HIGH

  stripe_webhook_events dedup (line 4160):
  const seen = await env.DB.prepare(
    "INSERT OR IGNORE INTO stripe_webhook_events (id, event_type, created_at) VALUES (?, ?, ?)"
  ).bind(eventId, String(body.type || "unknown"), new Date().toISOString()).run();
  if (!Number(seen?.meta?.changes || 0)) {
    return json({ received: true, duplicate: true, id: eventId, type: body.type });
  }

  The race: INSERT OR IGNORE is not atomic relative to a concurrent second delivery. In D1 (SQLite under the hood), INSERT OR IGNORE defers to the unique constraint on
  id. If two identical eventId values arrive before the first transaction commits, both may see meta.changes = 1 (the constraint is only enforced on commit), and both
  pass the dedup gate — both events process. This is a textbook check-then-act race.

  Fix: The correct pattern is INSERT ... ON CONFLICT(id) DO NOTHING RETURNING id — but D1 doesn't support RETURNING. Instead, do a SELECT id FROM stripe_webhook_events
  WHERE id = ? first, then conditionally insert. Or accept at-least-once delivery and make the downstream checkout.session.completed handler idempotent (see #2).

  Signature verification order: ✅ Signature is verified before the dedup check (lines 4134–4152).

  ---
  2. checkout.session.completed → project_plans Upsert

  Level: HIGH (manual limits silently clobbered)

  upsertProjectPlanFromStripe (line 5163):

  UPDATE path (existing record):
  UPDATE project_plans SET
    plan_name = ?, billing_status = ?,
    stripe_customer_id = COALESCE(?, stripe_customer_id),
    stripe_subscription_id = COALESCE(?, stripe_subscription_id),
    updated_at = ?
  WHERE project_id = ?

  Only plan_name, billing_status, and timestamps are written. The limit fields (message_limit_monthly, agent_invoke_limit_monthly, etc.) are NOT updated. If the UPDATE
  runs twice, it reuses whatever limits were set at INSERT time. ✅ Safe from the upsert itself.

  INSERT path (new record):
  INSERT INTO project_plans (
    project_id, plan_name, billing_status, stripe_customer_id,
    stripe_subscription_id, message_limit_monthly, agent_invoke_limit_monthly,
    webhook_delivery_limit_monthly, pricing_version, updated_at, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

  This is the clobber risk: If Stripe retries checkout.session.completed and the first INSERT already committed, the second delivery hits the UPDATE path (no limit
  clobber). BUT if the first INSERT is still in-flight when the retry arrives, the race from #1 means both could process as INSERTs — the second INSERT would fail with a
  unique constraint violation and return a 500 (CF surfaces this as a Worker exception), which causes Stripe to retry again, compounding the problem.

  Manual override risk: If a tenant manually sets message_limit_monthly to a custom value after purchase, a customer.subscription.updated event (line 4203) also calls the
   UPDATE path — limits are not touched. BUT if the tenant downgrades to a lower plan via Stripe and a new checkout.session.completed fires for a new subscription, the
  old row is updated to the new plan name and the custom limits are preserved while the plan_name changes. The limits no longer match the plan name.

  ---
  3. Failed Webhook → Inconsistent Plan State

  Level: MEDIUM (correct error handling, but no compensation)

  checkout.session.completed handler (lines 4183–4200):
  if (eventType === "checkout.session.completed") {
    const projectId = await resolveStripeProjectId(env, {...});
    const planName = body.data?.object?.metadata?.plan_name || "starter";
    if (projectId) {
      await upsertProjectPlanFromStripe(env, {...});  // ← single D1 write
    }
  }

  No transaction wrapping the full flow. If upsertProjectPlanFromStripe partially fails (e.g. D1 write error after Stripe has already captured payment), the tenant is
  stuck on the old plan while Stripe shows them as paid. The handler has no compensation mechanism.

  Correct behaviors:
  - Stripe signature failure → 401 returned → Stripe retries ✅
  - D1 unavailable → unhandled exception → 500 → Stripe retries ✅
  - Missing client_reference_id → projectId null → returns early, Stripe retries ✅

  Scenario requiring compensation: Stripe succeeds, upsertProjectPlanFromStripe succeeds, but deliverWebhooks (line 4168) later fails silently. The plan is correct but
  the webhook delivery pipeline missed the trigger. This is low severity — the plan state is consistent, only the automation side effects are affected.

  ---
  Smoke Test Checklist: Fluxychat Worker on Cloudflare

  1. POST /auth/token — JWT Returned

  ┌───────────────┬────────────────────────────────────────────────────────────────────────────────────────────────┐
  │     Step      │                                             Action                                             │
  ├───────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Send          │ POST /auth/token with X-Fluxy-Api-Key header and {"userId":"u1","roles":["member"]} body       │
  ├───────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Check         │ HTTP 200, token field present, expiresIn > 0, claims match input                               │
  ├───────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Failure — 401 │ API key invalid or not found. → Config issue: check PROJECT_SECRETS row exists for the project │
  ├───────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Failure — 400 │ Missing userId. → Code bug: validation logic changed                                           │
  └───────────────┴────────────────────────────────────────────────────────────────────────────────────────────────┘

  ---
  2. POST /rooms + POST /messages — 201, Message Persisted

  ┌────────┬───────────────────────────────────────────────────────────────────────────────────────────┐
  │  Step  │                                          Action                                           │
  ├────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ Send   │ POST /rooms with JWT → capture roomId                                                     │
  ├────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ Send   │ POST /messages with roomId, content:"smoke-test" → expect 201                             │
  ├────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ Check  │ HTTP 201, response has id, createdAt                                                      │
  ├────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ Verify │ Query D1: SELECT content FROM messages WHERE room_id = ? ORDER BY created_at DESC LIMIT 1 │
  └────────┴───────────────────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────┬───────────────────────────────────────────────────────────────────────┐
  │     Failure      │                      Distinguish config vs code                       │
  ├──────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ 401 Unauthorized │ JWT expired or invalid → Config: check token TTL and signing secret   │
  ├──────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ 403 Forbidden    │ Room membership missing → Config: check room_members table            │
  ├──────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ D1 empty         │ INSERT silently dropped → Code: check D1 binding or schema mismatch   │
  ├──────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ 201 but no id    │ Response serialization bug → Code: check insertMessage return mapping │
  └──────────────────┴───────────────────────────────────────────────────────────────────────┘

  ---
  3. WebSocket Connect — Auth + Presence + History

  ┌──────────────────┬────────────────────────────────────────────────────────────────────┐
  │       Step       │                               Action                               │
  ├──────────────────┼────────────────────────────────────────────────────────────────────┤
  │ Connect          │ wss://<worker>/ws/room/<roomId>?token=<jwt>                        │
  ├──────────────────┼────────────────────────────────────────────────────────────────────┤
  │ Check (auth)     │ Connection accepted (101 Switching Protocols)                      │
  ├──────────────────┼────────────────────────────────────────────────────────────────────┤
  │ Check (presence) │ Receive {"type":"presence","online":1} within 2s                   │
  ├──────────────────┼────────────────────────────────────────────────────────────────────┤
  │ Check (history)  │ Receive {"type":"history","messages":[...]} with persisted message │
  ├──────────────────┼────────────────────────────────────────────────────────────────────┤
  │ Disconnect       │ Close socket, reconnect with same token                            │
  └──────────────────┴────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │         Failure          │                                               Distinguish                                                │
  ├──────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 1008 Unauthorized        │ JWT verify failed → Config: JWT secret mismatch, exp expired                                             │
  ├──────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ No presence on reconnect │ DO hibernated, clients set empty on wake → Code: see SSE hibernation finding                             │
  ├──────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Empty history            │ SELECT returned nothing or D1 issue → Config: check messages table row matches project_id+room_id filter │
  └──────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  ---
  4. Webhook Delivery — HMAC + Retry on 5xx

  ┌──────────────┬────────────────────────────────────────────────────────────────────────────────────────────────┐
  │     Step     │                                             Action                                             │
  ├──────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Setup        │ Identify an automation with a webhook_url pointing to your test endpoint                       │
  ├──────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Trigger      │ Send a message with @<agentHandle> to fire a mention event                                     │
  ├──────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Check (HMAC) │ Your test endpoint receives X-Fluxy-Signature header, verify matches HMAC-SHA256(secret, body) │
  ├──────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Simulate 5xx │ Return HTTP 500 from your test endpoint                                                        │
  ├──────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Check        │ Event re-delivered within Stripe's retry window (check your logs or D1 automation_events)      │
  └──────────────┴────────────────────────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │       Failure       │                                              Distinguish                                               │
  ├─────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ No signature header │ DELIVER_WEBHOOK_SECRET not configured → Config: set env var                                            │
  ├─────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ HMAC mismatch       │ Secret mismatch → Config: compare DELIVER_WEBHOOK_SECRET between worker and test endpoint              │
  ├─────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ No retry            │ Your test endpoint returned non-5xx → Config: verify HTTP status code handling                         │
  ├─────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Double delivery     │ D1 dedup table not working → Code: check stripe_webhook_events pattern — see race condition finding #1 │
  └─────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  ---
  5. POST /billing/checkout — Stripe Session URL Returned

  ┌───────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ Step  │                                                  Action                                                  │
  ├───────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Send  │ POST /billing/checkout with JWT, body: {"planName":"starter","successUrl":"https://example.com/success"} │
  ├───────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Check │ HTTP 200, sessionUrl is a valid https://checkout.stripe.com/... URL                                      │
  └───────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  ┌────────────────┬───────────────────────────────────────────────────────────────────────────┐
  │    Failure     │                                Distinguish                                │
  ├────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ 500            │ STRIPE_SECRET_KEY not set → Config: check env                             │
  ├────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ 400            │ planName not recognized → Config: check planLimitsForName covers the plan │
  ├────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ 200 but no URL │ Stripe returned error in body → Code: check Stripe SDK response parsing   │
  └────────────────┴───────────────────────────────────────────────────────────────────────────┘

  ---
  6. POST /agents/:id/invoke — AgentRun Row + LLM Call

  ┌────────────┬─────────────────────────────────────────────────────────────────────────────────────┐
  │    Step    │                                       Action                                        │
  ├────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
  │ Send       │ POST /agents/<botId>/invoke with JWT, body: {"message":"hello","roomId":"<roomId>"} │
  ├────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
  │ Check      │ HTTP 200, response has runId                                                        │
  ├────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
  │ Verify D1  │ SELECT * FROM agent_runs WHERE id = ? row exists                                    │
  ├────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
  │ Verify LLM │ Check callLlmForProvider log or external mock received the request                  │
  └────────────┴─────────────────────────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────┐
  │          Failure           │                                      Distinguish                                      │
  ├────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
  │ 404                        │ Bot not found for this project → Config: check bots table                             │
  ├────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
  │ LLM not called             │ provider/model null resolution failed → Config: check AI_API_KEY or ANTHROPIC_API_KEY │
  ├────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
  │ LLM called but no response │ Timeout or model error → Code: check executeAgentRun error handling                   │
  ├────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
  │ agent_runs row missing     │ D1 write failed silently → Code: check INSERT binding                                 │
  └────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────┘

  ---
  7. POST /messages Over Quota — 402 Quota Exceeded

  ┌───────┬──────────────────────────────────────────────────────────────────────────────────────────────┐
  │ Step  │                                            Action                                            │
  ├───────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Setup │ Consume the project's monthly quota (set message_limit_monthly to 0 for this project via D1) │
  ├───────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Send  │ POST /messages with valid JWT and message                                                    │
  ├───────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Check │ HTTP 402, response body error contains "quota_exceeded" or "exceeded"                        │
  └───────┴──────────────────────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────┐
  │           Failure            │                                      Distinguish                                      │
  ├──────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
  │ 201 (quota not enforced)     │ QUOTAS_ENABLED=false → Config: check env var                                          │
  ├──────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
  │ 201 (quota not enforced)     │ getProjectQuotaLimit returned null (plan not found) → Config: check project_plans row │
  ├──────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
  │ 402 but message went through │ Race between check and insert → Code: check checkAndConsumeProjectQuota atomicity     │
  ├──────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
  │ 500                          │ D1 unavailable → Config: check env.DB binding                                         │
  └──────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────┘

  ---
  8. GET /health — Degraded Features Empty When KV and R2 Configured

  ┌────────────┬───────────────────────────────────────────────────────────────────────┐
  │    Step    │                                Action                                 │
  ├────────────┼───────────────────────────────────────────────────────────────────────┤
  │ Verify env │ Confirm RATE_LIMIT_KV and ATTACHMENTS are set in Cloudflare dashboard │
  ├────────────┼───────────────────────────────────────────────────────────────────────┤
  │ Send       │ GET /health (no auth needed)                                          │
  ├────────────┼───────────────────────────────────────────────────────────────────────┤
  │ Check      │ degraded is undefined (not present), degradedFeatures is undefined    │
  ├────────────┼───────────────────────────────────────────────────────────────────────┤
  │ Check      │ checks.kv = "connected", checks.r2 = "connected"                      │
  ├────────────┼───────────────────────────────────────────────────────────────────────┤
  │ Check      │ ok = true, HTTP 200                                                   │
  └────────────┴───────────────────────────────────────────────────────────────────────┘

  Failure: degraded: true present
  Distinguish: KV/R2 binding is falsy in worker env → Config: Cloudflare dashboard binding not set to KV namespace/R2 bucket
  ────────────────────────────────────────
  Failure: degraded: false present
  Distinguish: degraded should be absent, not false → Code: logic error at line 300 (degraded || undefined — should be degraded ? {} : undefined)
  ────────────────────────────────────────
  Failure: ok: false, HTTP 503
  Distinguish: env.DB or env.ROOM missing → Config: D1 binding or Durable Object binding missing
  ────────────────────────────────────────
  Failure: degradedFeatures absent when KV/R2 absent
  Distinguish: Missing feature gate → Code: line 308 always writes degradedFeatures object even when both are connected — cosmetic only

  ---
  Config vs. code distinction summary:

  ┌───────────────────────────────────────────────┬─────────────────────────────────────────────────────┐
  │                    Symptom                    │                     Likely root                     │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ Auth failures (401/403)                       │ Config: JWT secret mismatch, exp expired            │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ D1 data missing                               │ Config: table schema, project_id filter mismatch    │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ LLM not called                                │ Config: API key missing                             │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ Quota not enforced                            │ Config: QUOTAS_ENABLED or missing project_plans row │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ 503 health                                    │ Config: D1/DO binding not set in Cloudflare         │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ Functional gap (rate limits bypass, SSE hang) │ Code: in-memory state, hibernation handling         │
  └───────────────────────────────────────────────┴─────────────────────────────────────────────────────┘


Security Review: Rate Limiting — apps/worker/src/worker.js

  ---
  1. Per-Instance In-Memory Fallback — Blast Radius Quantification

  checkAndConsumeRateLimit (line 4690):

  const localRateLimitStore = new Map();   // ← line 4688: module-level singleton

  export async function checkAndConsumeRateLimit(env, options) {
    if (env.RATE_LIMIT_KV) {
      try { ... }  // KV path
      catch (err) { logInfo("rate_limit.kv_fallback", ...); }  // ← KV error → fallthrough
    }
    // Fallback for local/dev if KV binding is not configured.
    const entry = localRateLimitStore.get(key);
    // ... local in-memory counting
  }

  Mechanism: localRateLimitStore is a module-level Map. In Cloudflare Workers, each isolate is an independent JS VM — this Map is not shared across instances. Every CF
  Worker instance gets its own copy.

  Blast radius:

  ┌──────────────────────────────────────────┬───────────────────────────────────────────────┐
  │                 Scenario                 │               Requests allowed                │
  ├──────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ 1 isolate, rate limit 60/min             │ Correct: 60/min                               │
  ├──────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ 10 isolates, limit 60/min                │ Attacker can send 600/min (10× bypass)        │
  ├──────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ 100 isolates (CF auto-scales under load) │ Attacker can send 6,000/min (100× bypass)     │
  ├──────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ Per-instance memory limit                │ No cross-instance visibility — no enforcement │
  └──────────────────────────────────────────┴───────────────────────────────────────────────┘

  Additional blast radius factor: The KV catch block at line 4713 also falls through to the local fallback. If KV throws transient errors (network partition, namespace
  permission revoked), every request that hits a healthy isolate silently downgrades to per-instance counting. Under heavy load with KV degradation, the effective global
  limit is multiplied by the number of active isolates.

  Severity: HIGH. Rate limiting provides no global enforcement when KV is absent or degraded. This defeats the purpose of the feature entirely in multi-isolate
  deployments.

  ---
  2. KV Read Failure — Silent Bypass vs. Fail-Closed

  KV path (lines 4699–4715):
  if (env.RATE_LIMIT_KV) {
    try {
      const storageKey = `rl:${key}:${bucketTs}`;
      const existingRaw = await env.RATE_LIMIT_KV.get(storageKey);     // ← can throw
      const existing = Number(existingRaw || "0");
      if (existing >= limit) return { allowed: false, ... };
      await env.RATE_LIMIT_KV.put(storageKey, String(existing + 1),   // ← can throw
        { expirationTtl: ... });
      return { allowed: true, ... };
    } catch (err) {
      logInfo("rate_limit.kv_fallback", { key, error: ... });
    }  // ← falls through to local fallback
  }

  get() failure: If RATE_LIMIT_KV.get() throws (e.g., KV unavailable), the catch block executes. The rate limit check does not fail closed — it falls through to the local
   in-memory store. Rate limits are still enforced, but per-instance only (see #1).

  put() failure: This is the subtle bypass. If get() succeeds (bucket counter read), but put() fails (KV write error after read), existing was read but never incremented.
   The next request from any isolate reads the same counter value — the request was allowed but the increment was lost. This is a TOCTOU-style bypass: the counter read
  and increment are not atomic.

  Severity: MEDIUM. The catch block prevents hard bypass (rate limits stay active via local fallback), but the put() failure creates a non-atomic read-modify-write
  window. Under KV errors, the local fallback limits still work — but they are per-isolate (see #1), compounding the problem.

  Recommendation: The local fallback should have a comment that it's intentionally a last resort. Consider failing closed (return { allowed: false }) if KV is expected
  but unavailable, so operators notice the degradation in /health.

  ---
  3. KV Key Namespacing — Cross-Tenant Interference

  const storageKey = `rl:${key}:${bucketTs}`;   // line 4702

  The caller passes key — let's verify how it's constructed:

  Searched for 1 pattern, read 2 files (ctrl+o to expand)

● Security Review: Rate Limiting — apps/worker/src/worker.js

  ---
  1. In-Memory Fallback — Per-Instance Rate Limits

  Level: HIGH

  checkAndConsumeRateLimit (line 4690):
  const localRateLimitStore = new Map();  // ← module-level, one per isolate instance

  export async function checkAndConsumeRateLimit(env, options) {
    const { key, limit, windowSeconds } = options;
    // ...
    if (env.RATE_LIMIT_KV) {
      // KV path...
    }

    // Fallback: module-level Map
    const entry = localRateLimitStore.get(key);
    if (!entry || entry.expiresAt <= now) {
      localRateLimitStore.set(key, { count: 1, expiresAt: now + windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    // ...
  }

  Blast radius when RATE_LIMIT_KV is unset:

  Cloudflare Workers runs multiple isolate instances (typically one per region, scaling with traffic). Each isolate has its own separate module-level Map instance. There
  is no shared state between isolates.

  ┌─────────────────────────────────────────┬────────────────────────────────────────────┐
  │            Attacker scenario            │      Effective rate with 5 instances       │
  ├─────────────────────────────────────────┼────────────────────────────────────────────┤
  │ Send 60 msgs/min to 5 different regions │ 60 × 5 = 300 msgs/min (not 60)             │
  ├─────────────────────────────────────────┼────────────────────────────────────────────┤
  │ Per-tenant: msg:{projectId}:{userId}    │ Same — each instance tracks its own bucket │
  ├─────────────────────────────────────────┼────────────────────────────────────────────┤
  │ Burst from 5 devices in same region     │ Each device hits a fresh bucket            │
  └─────────────────────────────────────────┴────────────────────────────────────────────┘

  Callers that hit this fallback (when KV binding is absent):
  - POST /messages — msg:${authProjectId}:${authUserId}:${roomId} — line 564
  - POST /agents/:id/invoke — agent:${auth.projectId}:${agentId} — line 1022
  - POST /reports — report:${authProjectId}:${userId} — line 2157

  Quantified blast radius: An attacker with a valid JWT can send up to (instances) × limit requests per window before being rate-limited. For a 60 req/min limit with 5
  isolates, 5× the intended limit is the effective ceiling. For agent invokes (default 60 RPM), this means 300 RPM against a model with a $0.002/1K tokens cost could be
  exploited for API bill padding.

  Note: RoomDurableObject.consumeWsRateLimit (line 6870) has the same pattern — per-DO-instance in-memory Map — but the DO is single-threaded per room, so the
  per-instance issue is less severe there.

  Fix: Fail closed when KV is absent — return { allowed: false } on the fallback path instead of allowed: true.

  ---
  2. KV Read Failure — Silent Bypass

  Level: HIGH

  if (env.RATE_LIMIT_KV) {
    try {
      const storageKey = `rl:${key}:${bucketTs}`;
      const existingRaw = await env.RATE_LIMIT_KV.get(storageKey);  // ← KV read
      const existing = Number(existingRaw || "0");
      if (existing >= limit) {
        return { allowed: false, retryAfterSeconds };
      }
      await env.RATE_LIMIT_KV.put(storageKey, String(existing + 1), {...});  // ← increment
      return { allowed: true, retryAfterSeconds: 0 };
    } catch (err) {
      logInfo("rate_limit.kv_fallback", { key, error: err instanceof Error ? err.message : String(err) });  // ← catches ALL errors
    }
  }

  The catch block falls through to the in-memory fallback. Every error type — network timeout, KV internal error, rate-limit exceeded on KV itself, 100x expirationTtl
  value — is silently caught and the request proceeds without any rate limiting.

  Specific scenarios where this bypasses limits:
  - KV read times out (CF KV has ~10ms reads but can spike) → request allowed, no counter written
  - KV read returns null for an existing key (CF KV eventual consistency edge case) → counter resets to 0
  - KV namespace not bound in staging vs. production → both would silently fall through identically

  The error is only logged via logInfo — not surfaced to the caller, not tracked in metrics. An attacker can probe the system by sending requests until KV errors, at
  which point they bypass all rate limits indefinitely.

  Fix: Fail closed in the catch block — return { allowed: false, retryAfterSeconds: 5 } instead of falling through to in-memory.

  ---
  3. KV Key Namespacing — Cross-Tenant Interference

  Level: LOW (keys are properly namespaced, but one subtle gap)

  KV key patterns:
  rl:msg:${authProjectId}:${authUserId}:${roomId}    // line 564 — projectId × userId × roomId ✅
  rl:agent:${auth.projectId}:${agentId}              // line 1022 — projectId × agentId ✅
  rl:report:${authProjectId}:${userId}              // line 2157 — projectId × userId ✅
  rl:${key}:${bucketTs}                             // line 4702 — caller-supplied key ✅

  Properly namespaced: All callers include ${projectId} in the key, so cross-tenant interference is prevented at the key level. Tenant A's messages cannot bleed into
  Tenant B's quota.

  Subtle gap: fetchAppContext (line 5802) uses a cache key without project-level isolation in its naming:
  const cacheKey = `ctx:${projectId}:${roomId}:${userId}:${contextFetchUrl}`;
  This is a cache key (not a rate limit), but if contextFetchUrl is user-controlled or can be set to the same URL by two tenants, the cache could serve stale context.
  However, the key includes projectId, so this is mitigated.

  Actual concern: The checkAndConsumeRateLimit function accepts a free-form key string from callers (line 4691: const { key, ... } = options). A malicious caller could
  pass key: "admin" or key: "../etc/passwd" if they control the call site. The callers are internally scoped to project+user IDs, but this is a trust boundary — if a
  future caller is added without proper namespacing, the key is passed directly into rl:${key}:${bucketTs} with no sanitization. This is a defense-in-depth concern rather
   than an active vulnerability.

  ---
  Summary Table

  ┌─────┬─────────────────────────┬──────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │  #  │          Area           │ Severity │                                                    Finding                                                     │
  ├─────┼─────────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 1   │ In-memory fallback      │ HIGH     │ Per-isolate Map — effective limit = limit × instance count. Attacker can bypass by hitting different isolates. │
  ├─────┼─────────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 1   │ DO WS rate limit        │ MEDIUM   │ Same pattern in RoomDurableObject.wsRateLimitStore. Lost on DO hibernation (from previous review).             │
  ├─────┼─────────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 2   │ KV catch-all bypass     │ HIGH     │ Any KV error silently falls through to in-memory path. Attacker can probe for KV failure conditions.           │
  ├─────┼─────────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 3   │ Key namespacing         │ LOW      │ All callers include projectId. Free-form key parameter is a latent defense-in-depth risk.                      │
  ├─────┼─────────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 2   │ KV read → null handling │ MEDIUM   │ Number(null || "0") treats missing key as 0 — counter reset possible on CF KV eventual consistency edge case.  │
  └─────┴─────────────────────────┴──────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Remediation Priority

  1. Fail closed on KV error — change catch to return { allowed: false, retryAfterSeconds: 5 }
  2. Fail closed on missing KV binding — remove the in-memory fallback entirely (or gate behind ALLOW_LOCAL_RATE_LIMIT)
  3. Add KV read idempotency — use KV.put(..., { if: undefined }) or KV.list to detect stale reads
  4. Sanitize rate limit keys — validate key format before constructing the storage key


 Security Review: GDPR Delete (DELETE /gdpr/delete) — apps/worker/src/worker.js

  ---
  1. D1 Tables Covered by Erasure

  Level: HIGH — Several tables are completely missed.

  The erasure handler (lines 3288–3329) covers 5 tables but skips 4:

  ┌──────────────────────────┬────────────┬──────────────────────────────────────────────────────────────────────────┬───────────┐
  │          Table           │  Covered?  │                                Operation                                 │   Lines   │
  ├──────────────────────────┼────────────┼──────────────────────────────────────────────────────────────────────────┼───────────┤
  │ messages                 │ ✅         │ Soft-delete (content replaced with '[REDACTED BY GDPR ERASURE REQUEST]') │ 3289–3293 │
  ├──────────────────────────┼────────────┼──────────────────────────────────────────────────────────────────────────┼───────────┤
  │ message_reactions        │ ✅         │ DELETE                                                                   │ 3296–3300 │
  ├──────────────────────────┼────────────┼──────────────────────────────────────────────────────────────────────────┼───────────┤
  │ read_receipts            │ ✅         │ DELETE                                                                   │ 3303–3307 │
  ├──────────────────────────┼────────────┼──────────────────────────────────────────────────────────────────────────┼───────────┤
  │ room_members             │ ✅         │ DELETE                                                                   │ 3310–3314 │
  ├──────────────────────────┼────────────┼──────────────────────────────────────────────────────────────────────────┼───────────┤
  │ message_mentions         │ ✅         │ DELETE                                                                   │ 3318–3321 │
  ├──────────────────────────┼────────────┼──────────────────────────────────────────────────────────────────────────┼───────────┤
  │ attachments              │ ❌ MISSING │ None                                                                     │ —         │
  ├──────────────────────────┼────────────┼──────────────────────────────────────────────────────────────────────────┼───────────┤
  │ moderation_events        │ ❌ MISSING │ None                                                                     │ —         │
  ├──────────────────────────┼────────────┼──────────────────────────────────────────────────────────────────────────┼───────────┤
  │ automation_events        │ ❌ MISSING │ None                                                                     │ —         │
  ├──────────────────────────┼────────────┼──────────────────────────────────────────────────────────────────────────┼───────────┤
  │ agent_runs               │ ❌ MISSING │ None                                                                     │ —         │
  ├──────────────────────────┼────────────┼──────────────────────────────────────────────────────────────────────────┼───────────┤
  │ operational_audit_events │ ❌ MISSING │ None                                                                     │ —         │
  └──────────────────────────┴────────────┴──────────────────────────────────────────────────────────────────────────┴───────────┘

  moderation_events (line 2396): Contains user_id on reports/flags against the user. The user's own moderation actions are not erased.

  agent_runs (line 1172): Contains user_id in its query — logs who triggered an agent. Not cleared.

  operational_audit_events (line 2419): Contains actor_user_id, actor_roles, metadata_json. The erased user's audit trail (who they acted on) is retained.

  webhook_deliveries: Not even listed as a table to check, but payload columns can contain user IDs (see #3).

  ---
  2. R2 Attachments — Metadata Only

  Level: CRITICAL

  // Line 3804: Only D1 metadata deleted when room is purged
  await this.env.DB.prepare(
    "DELETE FROM attachments WHERE project_id = ? AND room_id = ?"
  ).bind(projectId, roomId).run();
  // R2 objects are never deleted

  The GDPR erasure (line 3289–3293) does not even run this query for user erasure — it's absent entirely. But even in the room purge path (line 3804), only the D1
  attachments row is deleted. The corresponding R2 object (env.ATTACHMENTS.delete(fileKey)) is never called.

  Impact: User uploads to attachments are orphaned in R2 forever. The file data (potentially PII-laden content) remains stored even after erasure. This is a GDPR Article
  17 violation — the physical storage is not cleared.

  Note: The file download handler (line 446) also only checks D1 metadata — it never validates that the attachments row still exists, so deleted D1 rows create orphaned
  R2 objects with no access control gap. But the PII storage obligation remains.

  ---
  3. Post-Erasure userId Leakage in Broadcasts and Webhooks

  Level: HIGH

  The erased userId survives in multiple live data flows:

  Broadcast payloads (lines 6660–6674, 6699–6706, 6731–6739, 6755–6762):
  const payload = {
    type: "message",
    id: messageId,
    userId,           // ← still present in broadcast
    senderId: userId,  // ← still present in broadcast
    ...
  };
  this.broadcast(payload);  // sent to all WS/SSE clients

  After erasure, the user can no longer send messages, but their historical senderId and userId are frozen into every broadcast event for all rooms they were a member of.
   This is unavoidable for historical data, but the concern is ongoing broadcasts — the erased user's ID still propagates to other connected clients.

  Mention events in automation_events (line 6617–6623):
  { "fromUserId": "<erased_user>", "toUserIds": [...], "messageId": 123 }
  Erasure doesn't delete automation_events. If a message containing an @mention was sent before erasure, the fromUserId persists in the event payload.

  Webhook delivery payloads stored in webhook_deliveries (line 5420):
  "INSERT INTO webhook_deliveries (id, project_id, webhook_id, webhook_url, event_type, payload, status, ...)"
  // payload column contains userId in JSON
  If the webhook was triggered before erasure and the delivery is pending/failed, the payload column still contains the user's data. No purge of webhook_deliveries occurs
   for user erasure.

  webhook_deliveries also not cleaned: Not only are pending payloads not purged — there's no mechanism to retroactively clean delivered webhook payloads. The erased
  user's data exists in third-party systems that received those webhooks.

  ---
  4. Erasure Atomicity — Partial Failure State

  Level: MEDIUM

  // Lines 3288–3329 — sequential awaits, no transaction
  await env.DB.prepare(
    "UPDATE messages SET content = '[REDACTED...]' ... WHERE ..."
  ).run();                      // ← step 1

  await env.DB.prepare(
    "DELETE FROM message_reactions ..."
  ).run();                       // ← step 2

  await env.DB.prepare(
    "DELETE FROM read_receipts ..."
  ).run();                       // ← step 3

  await env.DB.prepare(
    "DELETE FROM room_members ..."
  ).run();                       // ← step 4

  await env.DB.prepare(
    "DELETE FROM message_mentions ..."
  ).run();                       // ← step 5

  writeAuditEvent(...).catch(() => {});  // ← fire-and-forget

  No DB.batch() wrapping. Each statement is a separate transaction. If step 1 succeeds and step 2 fails (e.g., D1 write error after a schema change), the tenant is in a
  half-deleted state:
  - Messages redacted ✅
  - Reactions still present ❌
  - Read receipts still present ❌
  - Room memberships intact ❌

  The writeAuditEvent call uses .catch(() => {}) — the audit row for the erasure itself may not be written if the DB write fails, making it impossible to prove the
  erasure was requested.

  Fix: Wrap all D1 operations in a single DB.batch() statement array, or use explicit transactions if D1 supports them. Add an erasure idempotency token so repeated
  requests complete the same operation deterministically.

  ---
  Summary Table

  #: 1
  Area: Tables fully covered
  Severity: HIGH
  Finding: 4 of 9 tables untouched: attachments (D1), moderation_events, automation_events, agent_runs, operational_audit_events
  ────────────────────────────────────────
  #: 2
  Area: R2 storage deletion
  Severity: CRITICAL
  Finding: No env.ATTACHMENTS.delete() call anywhere. R2 objects orphaned forever.
  ────────────────────────────────────────
  #: 2
  Area: Attachments D1 on erasure
  Severity: HIGH
  Finding: attachments rows not deleted on user erasure (only on room purge, and still no R2 delete)
  ────────────────────────────────────────
  #: 3
  Area: Broadcast userId leakage
  Severity: MEDIUM
  Finding: senderId/userId frozen in ongoing broadcasts — unavoidable for historical, but ongoing propagation
  ────────────────────────────────────────
  #: 3
  Area: automation_events payload
  Severity: HIGH
  Finding: fromUserId persists in mention/DM event payloads after erasure
  ────────────────────────────────────────
  #: 3
  Area: webhook_deliveries payload
  Severity: HIGH
  Finding: PII in webhook JSON not purged; delivered webhooks have already sent data to third parties
  ────────────────────────────────────────
  #: 4
  Area: No transaction wrapper
  Severity: MEDIUM
  Finding: Sequential awaits — partial failure leaves half-deleted state; audit row may be missing


Security Review: Webhook Secret Handling — apps/worker/src/worker.js

  ---
  1. AES-GCM Encryption vs. Legacy Plaintext Fallback

  Level: MEDIUM — The plaintext path is reachable in production under multiple conditions.

  Encryption path (encryptWebhookSecret, line 4659):
  async function encryptWebhookSecret(env, secret) {
    const key = await getWebhookEncryptionKey(env);
    if (!key) return null;   // ← plaintext fallback triggered here
    // AES-GCM encrypt...
  }

  getWebhookEncryptionKey (line 4642):
  const raw = String(env.WEBHOOK_SECRET_ENCRYPTION_KEY || "").trim();
  if (!raw) return null;     // ← if env var absent/empty
  try {
    const keyBytes = base64ToBytes(raw);
    if (keyBytes.byteLength !== 32) return null;  // ← if key not 32 bytes
    // ...
  } catch {
    return null;               // ← if base64 decode fails
  }

  Conditions that trigger plaintext fallback in production:

  ┌──────────────────────────────────────────┬──────────────────────────────────────────┬────────────────────────────────┐
  │                Condition                 │                 Trigger                  │           Likelihood           │
  ├──────────────────────────────────────────┼──────────────────────────────────────────┼────────────────────────────────┤
  │ WEBHOOK_SECRET_ENCRYPTION_KEY not set    │ Env var absent from Cloudflare dashboard │ High — requires migration step │
  ├──────────────────────────────────────────┼──────────────────────────────────────────┼────────────────────────────────┤
  │ Env var set but value is whitespace-only │ String(env.VAR || "").trim() → empty     │ High — accidental              │
  ├──────────────────────────────────────────┼──────────────────────────────────────────┼────────────────────────────────┤
  │ Env var base64 decodes to non-32 bytes   │ byteLength !== 32                        │ Medium — wrong key format      │
  ├──────────────────────────────────────────┼──────────────────────────────────────────┼────────────────────────────────┤
  │ Env var base64 is invalid                │ base64ToBytes throws                     │ Medium — copy-paste error      │
  └──────────────────────────────────────────┴──────────────────────────────────────────┴────────────────────────────────┘

  When encryptWebhookSecret returns null (lines 4659–4672), the caller at line 2226 stores null for both secret_ciphertext and secret_iv, and the raw secret is stored in
  the plaintext secret column.

  Storage decision chain:
  body.secret provided
    → encryptWebhookSecret(env, body.secret)
        → WEBHOOK_SECRET_ENCRYPTION_KEY valid?
            → YES: stores {secret_ciphertext, secret_iv}, secret = null ✅
            → NO:  returns null, stores secret = raw plaintext ⚠️
        → NO body.secret: stores secret = null

  webhook_hash is always stored (line 2228), but secret_hash alone only verifies, it cannot decrypt. The plaintext secret column is used for HMAC signing in the delivery
  path (line 5461: decrypted || w.secret).

  Fix: Add a feature flag that blocks webhook creation if WEBHOOK_SECRET_ENCRYPTION_KEY is not configured, or fall back to a server-generated secret stored only encrypted
   (reject plaintext secrets at the API boundary).

  ---
  2. timingSafeEqual — Length Branch and Char-by-Char Loop

  Level: HIGH

  function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;  // ← early return on length mismatch
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  The length check at line 5609 creates a timing oracle. An attacker can distinguish length === 32 from length !== 32 with ~100 samples via statistical timing analysis —
  the branch misprediction cost is measurable (~1–2ns per sample, detectable with 100× amplification). Knowing the signature length narrows brute-force from 2^256 to 2^n
  where n is the remaining bits.

  The char-by-char loop is correct (XOR + OR accumulation, result === 0 final check) — it operates in constant time once inside the loop. But the early exit on length
  mismatch leaks length information.

  Note on the delivery path (line 5598): Stripe's verifyStripeWebhookSignatureAsync uses the same timingSafeEqual function with the same length-leak. The Stripe signature
   format is well-known so the length leak there is lower severity (HMAC-SHA256 = 64 hex chars, always fixed). But POST /webhooks/verify signs arbitrary payloads with no
  fixed-length guarantee.

  Fix: Use crypto.subtle.compareFallback or implement a constant-time length comparison: always iterate the full length of both strings, XOR both at each position, and
  return result === 0. A simple rewrite:

  function timingSafeEqual(a, b) {
    const len = Math.max(a.length, b.length);
    const aPadded = a.padEnd(len, '\0');
    const bPadded = b.padEnd(len, '\0');
    let result = 0;
    for (let i = 0; i < len; i++) {
      result |= aPadded.charCodeAt(i) ^ bPadded.charCodeAt(i);
    }
    return result === 0;
  }

  ---
  3. NULL Ciphertext/IV — HMAC Delivery Signing

  Level: MEDIUM — silently falls back to plaintext, which is safe, but the fallback path has a subtle condition.

  Delivery path (lines 5459–5462):
  for (const w of wRows.results || []) {
    const decrypted = await decryptWebhookSecret(env, w);
    webhookSecrets[w.id] = decrypted || w.secret;  // ← fallback to plaintext
  }

  decryptWebhookSecret (line 4674):
  async function decryptWebhookSecret(env, row) {
    const key = await getWebhookEncryptionKey(env);
    if (!key) return null;              // ← returns null if no encryption key
    if (!row?.secret_ciphertext || !row?.secret_iv) return null;  // ← returns null
    // ... AES-GCM decrypt ...
    return new TextDecoder().decode(pt);
  } catch {
    return null;                        // ← returns null on decrypt failure
  }

  If secret_ciphertext/secret_iv are NULL (legacy row with no encryption):

  ┌──────────────────────────────────────────────────────────────────┬──────────────────────────────┬─────────────────────────────────────────────────────────────┐
  │                             Scenario                             │ decryptWebhookSecret returns │                    webhookSecrets[id] =                     │
  ├──────────────────────────────────────────────────────────────────┼──────────────────────────────┼─────────────────────────────────────────────────────────────┤
  │ WEBHOOK_SECRET_ENCRYPTION_KEY set, row has NULL ciphertext/iv    │ null                         │ w.secret (plaintext) ✅                                     │
  ├──────────────────────────────────────────────────────────────────┼──────────────────────────────┼─────────────────────────────────────────────────────────────┤
  │ WEBHOOK_SECRET_ENCRYPTION_KEY missing, row has ciphertext/iv     │ null                         │ w.secret (plaintext) ✅ — but plaintext is encrypted in DB! │
  ├──────────────────────────────────────────────────────────────────┼──────────────────────────────┼─────────────────────────────────────────────────────────────┤
  │ WEBHOOK_SECRET_ENCRYPTION_KEY set, decrypt fails (corrupt iv/ct) │ null                         │ w.secret (plaintext) ✅ — but ciphertext may be garbage     │
  └──────────────────────────────────────────────────────────────────┴──────────────────────────────┴─────────────────────────────────────────────────────────────┘

  The subtle bug: If WEBHOOK_SECRET_ENCRYPTION_KEY is configured but the row has NULL ciphertext/iv (legacy plaintext row), the delivery succeeds using the plaintext
  w.secret. This is correct behavior. However, if the key IS set AND ciphertext/iv exist BUT decryption fails (e.g., corrupted IV, wrong key version),
  decryptWebhookSecret returns null and the code falls back to w.secret — but w.secret is null for encrypted rows. The signature header is not set (if (secret) guard at
  line 5473), so the webhook fires without X-Fluxy-Signature.

  The real issue is not security but availability: A row with valid ciphertext/iv that fails decryption (e.g., key rotation scenario) silently loses its signature. The
  receiver has no signal that this is an authentication failure vs. a missing-secret configuration. The webhook fires without a signature header, and the receiver's
  "verify" endpoint will return valid: false — but only if it checks. Most receivers would silently accept unsigned payloads.

  Fix: If decryption fails, throw an error rather than falling back to a missing secret. Log a webhook.secret_decrypt_failed event so operators are alerted. Do not
  silently fire unsigned webhooks.

  ---
  Summary Table

  ┌─────┬──────────────────────────────────┬──────────┬─────────────────────────────────────────────────────────────────────────────────────────────────┐
  │  #  │               Area               │ Severity │                                             Finding                                             │
  ├─────┼──────────────────────────────────┼──────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 1   │ Plaintext fallback in prod       │ MEDIUM   │ WEBHOOK_SECRET_ENCRYPTION_KEY unset/malformed → plaintext secrets stored and used for signing   │
  ├─────┼──────────────────────────────────┼──────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 1   │ No enforcement on creation       │ MEDIUM   │ API accepts plaintext secrets with no warning; no migration path to re-encrypt existing secrets │
  ├─────┼──────────────────────────────────┼──────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 2   │ timingSafeEqual length leak      │ HIGH     │ if (a.length !== b.length) return false — leaks signature length via timing side channel        │
  ├─────┼──────────────────────────────────┼──────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 3   │ Silent unsigned fallback         │ MEDIUM   │ Decrypt failure → null → if (secret) guard skips signature → unsigned webhook fires silently    │
  ├─────┼──────────────────────────────────┼──────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 3   │ NULL ciphertext/iv + key set     │ LOW      │ Legacy plaintext rows correctly fall back to w.secret; not a security flaw                      │
  ├─────┼──────────────────────────────────┼──────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 3   │ Decrypt error silently swallowed │ MEDIUM   │ catch { return null } in decryptWebhookSecret — corrupt ciphertext/iv undetected                │
  └─────┴──────────────────────────────────┴──────────┴─────────────────────────────────────────────────────────────────────────────────────────────────┘

  Remediation Priority

  1. Fix timingSafeEqual length leak — remove the early-return on length mismatch
  2. Fail on decrypt error — throw instead of returning null when ciphertext/iv are present but decryption fails
  3. Add webhook-secret encryption enforcement — reject new webhook registrations without WEBHOOK_SECRET_ENCRYPTION_KEY configured; warn on existing plaintext rows in
  health endpoint
  4. Rotate corrupted secrets — add a secret_key_version column to support key rotation without silent downtime


 Security Review: Webhook Secret Handling — apps/worker/src/worker.js

  ---
  1. AES-GCM Encryption vs. Legacy Plaintext Fallback

  Level: MEDIUM — The plaintext path is reachable in production under multiple conditions.

  Encryption path (encryptWebhookSecret, line 4659):
  async function encryptWebhookSecret(env, secret) {
    const key = await getWebhookEncryptionKey(env);
    if (!key) return null;   // ← plaintext fallback triggered here
    // AES-GCM encrypt...
  }

  getWebhookEncryptionKey (line 4642):
  const raw = String(env.WEBHOOK_SECRET_ENCRYPTION_KEY || "").trim();
  if (!raw) return null;     // ← if env var absent/empty
  try {
    const keyBytes = base64ToBytes(raw);
    if (keyBytes.byteLength !== 32) return null;  // ← if key not 32 bytes
    // ...
  } catch {
    return null;               // ← if base64 decode fails
  }

  Conditions that trigger plaintext fallback in production:

  ┌──────────────────────────────────────────┬──────────────────────────────────────────┬────────────────────────────────┐
  │                Condition                 │                 Trigger                  │           Likelihood           │
  ├──────────────────────────────────────────┼──────────────────────────────────────────┼────────────────────────────────┤
  │ WEBHOOK_SECRET_ENCRYPTION_KEY not set    │ Env var absent from Cloudflare dashboard │ High — requires migration step │
  ├──────────────────────────────────────────┼──────────────────────────────────────────┼────────────────────────────────┤
  │ Env var set but value is whitespace-only │ String(env.VAR || "").trim() → empty     │ High — accidental              │
  ├──────────────────────────────────────────┼──────────────────────────────────────────┼────────────────────────────────┤
  │ Env var base64 decodes to non-32 bytes   │ byteLength !== 32                        │ Medium — wrong key format      │
  ├──────────────────────────────────────────┼──────────────────────────────────────────┼────────────────────────────────┤
  │ Env var base64 is invalid                │ base64ToBytes throws                     │ Medium — copy-paste error      │
  └──────────────────────────────────────────┴──────────────────────────────────────────┴────────────────────────────────┘

  When encryptWebhookSecret returns null (lines 4659–4672), the caller at line 2226 stores null for both secret_ciphertext and secret_iv, and the raw secret is stored in
  the plaintext secret column.

  Storage decision chain:
  body.secret provided
    → encryptWebhookSecret(env, body.secret)
        → WEBHOOK_SECRET_ENCRYPTION_KEY valid?
            → YES: stores {secret_ciphertext, secret_iv}, secret = null ✅
            → NO:  returns null, stores secret = raw plaintext ⚠️
        → NO body.secret: stores secret = null

  webhook_hash is always stored (line 2228), but secret_hash alone only verifies, it cannot decrypt. The plaintext secret column is used for HMAC signing in the delivery
  path (line 5461: decrypted || w.secret).

  Fix: Add a feature flag that blocks webhook creation if WEBHOOK_SECRET_ENCRYPTION_KEY is not configured, or fall back to a server-generated secret stored only encrypted
   (reject plaintext secrets at the API boundary).

  ---
  2. timingSafeEqual — Length Branch and Char-by-Char Loop

  Level: HIGH

  function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;  // ← early return on length mismatch
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  The length check at line 5609 creates a timing oracle. An attacker can distinguish length === 32 from length !== 32 with ~100 samples via statistical timing analysis —
  the branch misprediction cost is measurable (~1–2ns per sample, detectable with 100× amplification). Knowing the signature length narrows brute-force from 2^256 to 2^n
  where n is the remaining bits.

  The char-by-char loop is correct (XOR + OR accumulation, result === 0 final check) — it operates in constant time once inside the loop. But the early exit on length
  mismatch leaks length information.

  Note on the delivery path (line 5598): Stripe's verifyStripeWebhookSignatureAsync uses the same timingSafeEqual function with the same length-leak. The Stripe signature
   format is well-known so the length leak there is lower severity (HMAC-SHA256 = 64 hex chars, always fixed). But POST /webhooks/verify signs arbitrary payloads with no
  fixed-length guarantee.

  Fix: Use crypto.subtle.compareFallback or implement a constant-time length comparison: always iterate the full length of both strings, XOR both at each position, and
  return result === 0. A simple rewrite:

  function timingSafeEqual(a, b) {
    const len = Math.max(a.length, b.length);
    const aPadded = a.padEnd(len, '\0');
    const bPadded = b.padEnd(len, '\0');
    let result = 0;
    for (let i = 0; i < len; i++) {
      result |= aPadded.charCodeAt(i) ^ bPadded.charCodeAt(i);
    }
    return result === 0;
  }

  ---
  3. NULL Ciphertext/IV — HMAC Delivery Signing

  Level: MEDIUM — silently falls back to plaintext, which is safe, but the fallback path has a subtle condition.

  Delivery path (lines 5459–5462):
  for (const w of wRows.results || []) {
    const decrypted = await decryptWebhookSecret(env, w);
    webhookSecrets[w.id] = decrypted || w.secret;  // ← fallback to plaintext
  }

  decryptWebhookSecret (line 4674):
  async function decryptWebhookSecret(env, row) {
    const key = await getWebhookEncryptionKey(env);
    if (!key) return null;              // ← returns null if no encryption key
    if (!row?.secret_ciphertext || !row?.secret_iv) return null;  // ← returns null
    // ... AES-GCM decrypt ...
    return new TextDecoder().decode(pt);
  } catch {
    return null;                        // ← returns null on decrypt failure
  }

  If secret_ciphertext/secret_iv are NULL (legacy row with no encryption):

  ┌──────────────────────────────────────────────────────────────────┬──────────────────────────────┬─────────────────────────────────────────────────────────────┐
  │                             Scenario                             │ decryptWebhookSecret returns │                    webhookSecrets[id] =                     │
  ├──────────────────────────────────────────────────────────────────┼──────────────────────────────┼─────────────────────────────────────────────────────────────┤
  │ WEBHOOK_SECRET_ENCRYPTION_KEY set, row has NULL ciphertext/iv    │ null                         │ w.secret (plaintext) ✅                                     │
  ├──────────────────────────────────────────────────────────────────┼──────────────────────────────┼─────────────────────────────────────────────────────────────┤
  │ WEBHOOK_SECRET_ENCRYPTION_KEY missing, row has ciphertext/iv     │ null                         │ w.secret (plaintext) ✅ — but plaintext is encrypted in DB! │
  ├──────────────────────────────────────────────────────────────────┼──────────────────────────────┼─────────────────────────────────────────────────────────────┤
  │ WEBHOOK_SECRET_ENCRYPTION_KEY set, decrypt fails (corrupt iv/ct) │ null                         │ w.secret (plaintext) ✅ — but ciphertext may be garbage     │
  └──────────────────────────────────────────────────────────────────┴──────────────────────────────┴─────────────────────────────────────────────────────────────┘

  The subtle bug: If WEBHOOK_SECRET_ENCRYPTION_KEY is configured but the row has NULL ciphertext/iv (legacy plaintext row), the delivery succeeds using the plaintext
  w.secret. This is correct behavior. However, if the key IS set AND ciphertext/iv exist BUT decryption fails (e.g., corrupted IV, wrong key version),
  decryptWebhookSecret returns null and the code falls back to w.secret — but w.secret is null for encrypted rows. The signature header is not set (if (secret) guard at
  line 5473), so the webhook fires without X-Fluxy-Signature.

  The real issue is not security but availability: A row with valid ciphertext/iv that fails decryption (e.g., key rotation scenario) silently loses its signature. The
  receiver has no signal that this is an authentication failure vs. a missing-secret configuration. The webhook fires without a signature header, and the receiver's
  The real guard concern: MAX_TOOL_ITERATIONS is a module-level constant (line 5674), not parameterized. If the limit needs to change per-plan (e.g., starter = 3, pro =
  10), it requires a code deployment. This is a maintainability issue, not a security flaw.

  ---
  4. Malformed Tool Call — Error Propagation

  Level: HIGH

  executeToolCall (line 5768):
  try { args = JSON.parse(toolCall.arguments); } catch { args = {}; }

  Empty args on parse failure. If the LLM returns {"id":"abc","name":"search","arguments":"not json"}, parsing silently fails and args = {} — the tool is called with an
  empty object, potentially with unintended side effects or silent failures on the developer's endpoint.

  Unhandled JSON parse exception in the outer for loop (line 6120–6125):
  for (const tc of extracted.toolCalls) {
    const toolResult = await executeToolCall(env, toolExecuteUrl, tc, projectId, traceId);
    // ...
  }

  If executeToolCall throws (not returns an error object) — e.g., res.json() on a non-JSON response throws an unhandled rejection — the for loop terminates, the loop
  breaks out of context, and the agent run returns with whatever lastContent was captured so far. No error message is written to the room. The agent_runs row is NOT
  inserted (the INSERT is inside the result.status === "completed" block at line 1077), so there is no database record of the failed run either — just a logError entry.

  The toolResult.success = false path (line 5785: tool_execute_http_${res.status}) is handled correctly and returns an Error: tool_execute_http_500 message to the LLM.
  But unhandled exceptions bypass this entirely.

  extractOpenAIToolCalls (line 5736): No validation that tc.function?.name exists or that tc.function?.arguments is a string. If the LLM returns a malformed tool call
  with missing fields, tc.name is undefined and tc.arguments is undefined — both passed into executeToolCall and the tool endpoint.

  extractAnthropicToolCalls (line 5753): JSON.stringify(block.input) — if block.input is not a plain object (e.g., undefined or a circular reference), JSON.stringify
  throws. This is a potential unhandled rejection that propagates out of extractLlmResponse, out of the loop at line 6075, and is caught by the outer try/catch at line
  6057 — which throws the error upward, causing the entire agent run to fail with a 500 (line 1153). This path does write an agent_runs row with status: "failed" (line
  6072 → 1140) and logs the error. ✅ Better behaved.

  Fix: Add schema validation in extractOpenAIToolCalls — reject tool calls missing id, name, or arguments. Add a try-catch around JSON.stringify(toolResult.result) in
  buildToolResultMessage to truncate oversized responses.

  ---
  ai-agent Worker: Additional Findings

  verifyWebhookSignature (handlers.js:30):
  return actualHex === expectedHex;  // ← NOT timing-safe

  Plain === comparison. An attacker who can measure response timing can brute-force the HMAC-SHA256 signature byte-by-byte. Low severity (requires a compromised webhook
  endpoint), but inconsistent with the timingSafeEqual used in the main worker.

  generateServiceJWT (handlers.js:343): The service JWT generated for bot-to-Fluxychat communication signs with exp: Math.floor(Date.now() / 1000) + 3600 — hardcoded
  1-hour expiry. No refresh mechanism. If the ai-agent worker runs longer than 1 hour, JWTs expire mid-operation. No alerting on expiry.

  ---
  Summary Table

  #: 1
  Area: tool_execute_url SSRF
  Severity: LOW
  Finding: Same isPrivateUrl guard as context_fetch_url — same bypass vectors, but higher blast radius (executing actions vs. reading data)
  ────────────────────────────────────────
  #: 2
  Area: Tool result sanitization
  Severity: MEDIUM
  Finding: No size/content validation — large or sensitive tool responses injected into LLM context; res.json() throws unhandled if endpoint returns non-JSON
  ────────────────────────────────────────
  #: 3
  Area: Max iterations
  Severity: LOW
  Finding: Correctly enforced in code (loop bound to 5). Iteration 6 exits cleanly but returns partial lastContent. Not configurable per-plan.
  ────────────────────────────────────────
  #: 4
  Area: Malformed tool call
  Severity: HIGH
  Finding: Missing schema validation on extractOpenAIToolCalls — undefined name/arguments passed through. Unhandled parse exceptions in LLM responses may cause silent
  loop
    termination with no room message or DB record
  ────────────────────────────────────────
  #: 4
  Area: buildToolResultMessage
  Severity: MEDIUM
  Finding: JSON.stringify(toolResult.result) — no size guard, could exceed context or degrade LLM response quality
  ────────────────────────────────────────
  #: —
  Area: ai-agent HMAC compare
  Severity: LOW
  Finding: Plain === in verifyWebhookSignature — not timing-safe, inconsistent with main worker
  ────────────────────────────────────────
  #: —
  Area: ai-agent JWT expiry
  Severity: LOW
  Finding: Hardcoded 1h JWT with no refresh — potential mid-operation expiry in long-running workers


Architecture Analysis: RoomDurableObject Hibernation Resilience

  ---
  1. Instance Variable Map

  ┌───────────────────────┬──────────────────────────────────┬──────────────────────────────────────┬──────────────────────────────────────────────────────────────────┐
  │       Variable        │               Type               │               Purpose                │                      Hibernation survivor?                       │
  ├───────────────────────┼──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ this.state            │ DurableObjectState               │ CF DO runtime handle, injected by CF │ ✅ Provided by CF on wake                                        │
  ├───────────────────────┼──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ this.env              │ Env                              │ CF bindings (DB, R2, KV, etc.)       │ ✅ Provided by CF on wake                                        │
  ├───────────────────────┼──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ this.clients          │ Set<WebSocket>                   │ Active WS connections                │ ❌ Lost — empty on wake                                          │
  ├───────────────────────┼──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ this.sseClients       │ Set<WritableStreamDefaultWriter> │ Active SSE writers                   │ ❌ Lost — empty on wake                                          │
  ├───────────────────────┼──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ this.moderationCache  │ Map<string, {state, expires}>    │ 10s moderation cache                 │ ❌ Lost — rebuilt from D1 on next check                          │
  ├───────────────────────┼──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ this.userIds          │ Map<WebSocket, userId>           │ WS→userId lookup                     │ ❌ Lost — userId readable from this.userIds.get(ws) in onMessage │
  ├───────────────────────┼──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ this.projectId        │ string | null                    │ Cached project ID for room           │ ❌ Lost — re-set from JWT in handleWebSocket                     │
  ├───────────────────────┼──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ this.wsRateLimitStore │ Map<string, {count, expiresAt}>  │ Per-DO rate limit buckets            │ ❌ Lost — limits reset on wake                                   │
  └───────────────────────┴──────────────────────────────────┴──────────────────────────────────────┴──────────────────────────────────────────────────────────────────┘

  ---
  2. Recovery Behavior Per Variable

  this.clients + this.userIds — Lost on hibernation.

  When a WebSocket connects after wake:
  this.clients.add(webSocket);      // Set is empty — starts fresh
  this.userIds.set(webSocket, userId);  // Populated only for this new connection
  this.projectId = auth.projectId;   // Re-set from JWT

  Effect: this.clients.size === 1 for the connecting client. broadcast() will only reach that client. All previously connected clients are gone from the DO's view — they
  are unaware until they detect silence and reconnect.

  On reconnect storm: When the DO wakes (e.g., via SSE heartbeat or an HTTP request), all dormant WS clients that were silently disconnected will attempt to reconnect.
  Each reconnect calls handleWebSocket — which broadcasts presence: {online: 1} to all other reconnecting clients simultaneously. With N dormant clients and M new
  connections, this produces O(N×M) simultaneous presence broadcasts.

  this.moderationCache — Not a correctness issue. The cache is a performance optimization. On wake, the first message for any user hits D1 for a moderation lookup (line
  6899). Cache miss is expected.

  this.wsRateLimitStore — Rate limits reset on wake. A client hammering messages before hibernation gets a clean slate after wake. This is a bypass vector (from the rate
  limiting review) — not a recovery design flaw per se, but worth noting.

  this.sseClients — SSE writers are orphaned. The writable side of the TransformStream is held in this.sseClients. When the DO hibernates, those writers are dead
  references — writes to them will throw. The SSE heartbeat guard (line 6940–6945) cleans up dead writers, but only when the heartbeat fires. If the DO hibernates before
  the next heartbeat, clients hang until timeout.

  ---
  3. SSE TransformStream Hibernation Behavior

  // Line 6934: TransformStream created
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();   // ← held in this.sseClients
  this.sseClients.add(writer);

  // Line 6939–6946: heartbeat via the writable side
  const heartbeat = setInterval(() => {
    try {
      writer.write(encoder.encode(": heartbeat\n\n"));  // ← throws on dead writer
    } catch {
      clearInterval(heartbeat);
      this.sseClients.delete(writer);  // ← cleanup only on heartbeat error
    }
  }, 30_000);

  Hibernation behavior:

  When the DO hibernates, the setInterval is destroyed with the isolate. The writable side (writer) is still in this.sseClients (in memory, now stale). The readable side
  (readable) in the client's fetch() response is still open — it has no data and no EOF signal.

  Client-side: The SSE client SDK (e.g., EventSource, or a fetch-based SSE reader) is waiting on the readable stream. Since the DO never writes a terminator and never
  calls readable.cancel(), the client hangs until its own timeout fires. There is no clean EOF.

  The cleanup() function (line 6948):
  const cleanup = () => {
    clearInterval(heartbeat);
    this.sseClients.delete(writer);
    try { writer.close(); } catch {}  // ← closes writable, signals EOF on readable
  };
  request.signal.addEventListener("abort", cleanup, { once: true });

  This only fires on request.signal abort (client disconnect). It does not fire on DO hibernation. There is no hibernation notification handler.

  No reconnect signal. The client SDK has no event: close or data: [DONE] sentinel to interpret as a reconnect trigger. It must rely on application-level timeout or
  manual reconnection logic.

  ---
  4. Minimal Change: Recoverable Presence via state.storage

  Problem statement: this.clients and this.userIds are lost on hibernation, causing:
  - Presence shows "1 user" when a client reconnects, even if 10 clients were connected before
  - Reconnect storm: all clients reconnect simultaneously after DO wake

  Design constraints:
  1. No reconnect storm: Presence should be recoverable without all clients hammering the DO at once
  2. Minimal change: Should not require a schema migration or a new D1 table
  3. Storage consistency: The presence set stored in state.storage must be kept in sync with this.clients in real-time

  Proposed design (3 changes):

  Step 1 — Store connected user IDs in state.storage on connect/disconnect.

  // In handleWebSocket(), after adding the client:
  await this.state.storage.put("presence", {
    userIds: [...this.userIds.values()],
    updatedAt: Date.now(),
  });
  this.broadcast({ type: "presence", online: this.clients.size, users: [...this.userIds.values()] });

  Step 2 — On DO wake (first request), restore presence from storage before processing.

  // At the top of handleWebSocket(), BEFORE adding the new client:
  const stored = await this.state.storage.get("presence");
  if (stored?.userIds?.length) {
    // Seed the presence broadcast so already-connected-but-hibernated clients
    // see the correct count immediately on their next poll/push
    this.broadcast({
      type: "presence",
      online: stored.userIds.length,
      users: stored.userIds,
      _recovered: true,
    });
  }

  Step 3 — Prevent reconnect storm with jittered reconnect delay.

  The reconnect storm is a client-side problem, not a server-side one. The DO cannot prevent clients from reconnecting immediately. The mitigation is on the client SDK
  side:

  // Client-side: exponential backoff with ±20% jitter
  const delay = Math.min(30_000, baseDelay * (1 + (Math.random() - 0.5) * 0.4));
  setTimeout(connect, delay);

  Combined with a presence recovery signal (_recovered: true), clients that see a recovered presence count matching their expected count can skip reconnecting entirely.

  Code sketch — minimal changes to handleWebSocket and onClose:

  // handleWebSocket — after auth check, before this.clients.add():
  const stored = await this.state.storage.get("presence").catch(() => null);
  if (stored?.userIds?.length) {
    // Clients that are hibernated but still connected should see correct presence
    this.broadcast({
      type: "presence",
      online: stored.userIds.length + 1,
      users: [...stored.userIds, auth.userId],
    });
  } else {
    this.broadcast({
      type: "presence",
      online: this.clients.size + 1,
      users: [...this.userIds.values(), auth.userId],
    });
  }

  // After adding client:
  this.clients.add(webSocket);
  this.userIds.set(webSocket, auth.userId);
  this.projectId = auth.projectId;

  // Persist presence:
  await this.state.storage.put("presence", {
    userIds: [...this.userIds.values()],
    updatedAt: Date.now(),
  });

  // onClose:
  onClose(webSocket) {
    this.clients.delete(webSocket);
    this.userIds.delete(webSocket);
    this.broadcast({
      type: "presence",
      online: this.clients.size,
      users: Array.from(this.userIds.values()),
    });
    // Persist updated presence:
    this.state.storage.put("presence", {
      userIds: [...this.userIds.values()],
      updatedAt: Date.now(),
    }).catch(() => {});
  }

  Why this works without a reconnect storm:

  - state.storage operations are atomic with the request — no race between presence reads and writes
  - The presence broadcast on wake is sent to already-connected clients (via their active WS/SSE connections), not to reconnecting ones
  - Reconnecting clients receive the seeded presence immediately in their history response or the next presence event
  - The _recovered flag allows client SDKs to distinguish hibernation recovery from a real presence change, enabling them to suppress redundant reconnects

  Limitation: state.storage persists until explicitly deleted or overwritten. If the last client disconnects and the DO hibernates, the presence set is stale (it holds
  the old user IDs). The next client to connect will seed a broadcast with the old presence count. Add a updatedAt timestamp and invalidate presence entries older than 5
  minutes on DO wake:

  const stored = await this.state.storage.get("presence");
  if (stored && Date.now() - stored.updatedAt < 5 * 60 * 1000) {
    // use stored presence
  } else {
    // treat as empty — DO was hibernated after last disconnect
    await this.state.storage.delete("presence");
  }


Code Review: Quota Enforcement — apps/worker/src/worker.js

  ---
  1. project_usage_monthly — Read-Then-Write Pattern

  Level: HIGH — not atomic.

  checkAndConsumeProjectQuota (line 5246):
  async function checkAndConsumeProjectQuota(env, options) {
    const limit = await getProjectQuotaLimit(env, options.projectId, options.metricName);
    if (!limit) return { allowed: true, ... };  // quotas disabled if no plan row

    // Step 1: READ
    const existing = await env.DB.prepare(
      "SELECT used_value FROM project_usage_monthly WHERE id = ?"
    ).bind(id).first();
    const used = Number(existing?.used_value || 0);
    const nextUsed = used + Number(options.amount || 1);

    // Step 2: CHECK
    if (nextUsed > limit) {
      return { allowed: false, ... };   // ← early exit, no write
    }

    // Step 3: WRITE (INSERT or UPDATE)
    if (!existing) {
      await env.DB.prepare("INSERT INTO project_usage_monthly ...").run();
    } else {
      await env.DB.prepare("UPDATE project_usage_monthly ...").run();
    }
    return { allowed: true, ... };
  }

  Classic check-then-act race. The function reads the counter, computes the new value, then writes it back. Between the SELECT and the UPDATE, concurrent requests see the
   same stale used value. This is not a single atomic SQL statement — it is 2–3 round trips to D1.

  D1/SQLite under Cloudflare provides no transaction isolation between Worker instances. There is no SELECT ... FOR UPDATE equivalent, no row-level locking, and no
  optimistic concurrency control (no version column or CAS check).

  ---
  2. Simultaneous Requests at Exactly the Quota Limit

  Level: CRITICAL — both requests can pass before either increments.

  Request A arrives. existing.used_value = 999, limit = 1000, nextUsed = 1000. Check passes (1000 > 1000 is false). Returns { allowed: true }.

  Request B arrives concurrently (before A's INSERT commits). D1 hasn't written yet, so B's existing is still 999. Check passes. Both A and B return allowed: true.

  A writes INSERT. used_value = 1000.

  B writes UPDATE. used_value = 1001.

  Both messages were accepted. The tenant is 1 message over quota. Every concurrent request at the boundary sees the same counter value and passes the check.

  The window is bound only by D1 write latency — on Cloudflare, D1 writes can take 10–50ms, which is a wide concurrent window for Workers to process requests in parallel.

  Beyond the boundary: Even if the UPDATE commits before the second request's SELECT, the UPDATE overwrites used_value = 1001 without checking whether another concurrent
  increment has already pushed it past the limit. The check-then-act is applied to the UPDATE as well.

  ---
  3. 402 Response — No Retry-After or Reset Timestamp

  REST path (line 551–561):
  return json(
    {
      error: "quota_exceeded",
      metric: quotaResult.metricName,
      limit: quotaResult.limit,
      used: quotaResult.used,
      month: quotaResult.monthKey,
    },
    { status: 402 }
  );

  No Retry-After header. No resetAt field. No resetsAt field. No nextAvailableAt field. monthKey ("2026-05") is the month identifier, not a reset timestamp.

  The SDK / client cannot compute when the quota resets. They only know:
  - limit: 1000 — the cap
  - used: 1000 — currently at cap
  - month: "2026-05" — which month (but not the day, and not in Unix time)

  The month resets at YYYY-MM+1-01T00:00:00Z, but neither the server nor the SDK knows the current UTC date to compute this. The client would have to independently know
  the reset logic.

  monthKeyUtc (line 5091):
  function monthKeyUtc(date = new Date()) {
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  No way to derive the reset timestamp from monthKey alone. The SDK must know the convention "month resets on the 1st of the next month UTC."

  WebSocket path (line 6502–6513) — same gap:
  webSocket.send(JSON.stringify({
    type: "error",
    message: "quota_exceeded",
    details: {
      metric: quotaResult.metricName,
      limit: quotaResult.limit,
      used: quotaResult.used,
      month: quotaResult.monthKey,
    },
  }));
  No retryAfterSeconds field.

  Contrast with rate limiting (line 570–575): The HTTP rate limit response does include Retry-After:
  { error: "rate_limit_exceeded", retryAfterSeconds: messageRate.retryAfterSeconds }
  { status: 429, headers: { "Retry-After": String(messageRate.retryAfterSeconds) } }

  The quota path could follow the same pattern but does not.

  ---
  Summary Table

  #: 1
  Area: Quota check atomicity
  Severity: HIGH
  Finding: Read-then-write across 2–3 D1 round trips. No atomic increment.
  ────────────────────────────────────────
  #: 2
  Area: Concurrent requests at limit
  Severity: CRITICAL
  Finding: Two simultaneous requests at quota limit both pass before either increments. Tenant goes over quota by N-1 for N concurrent requests.
  ────────────────────────────────────────
  #: 2
  Area: No optimistic locking on UPDATE
  Severity: HIGH
  Finding: UPDATE writes without checking if another concurrent increment already reached the limit.
  ────────────────────────────────────────
  #: 3
  Area: 402 no Retry-After
  Severity: MEDIUM
  Finding: No reset timestamp in response body or headers. SDK must independently know the month-reset convention.
  ────────────────────────────────────────
  #: 3
  Area: WebSocket quota error
  Severity: MEDIUM
  Finding: Same gap — retryAfterSeconds absent from WebSocket error payload.

  Fixes (minimal)

  For atomicity: Use a single D1 statement with a conditional write:
  UPDATE project_usage_monthly
    SET used_value = used_value + ?
    WHERE id = ? AND used_value + ? <= ?
  ;
  -- Then SELECT to verify the write succeeded (rows affected = 1)
  -- If rows affected = 0, the quota was exceeded

  For concurrent limit race: The UPDATE-as-increment approach above is atomic for the increment step. Add a post-UPDATE check:
  const updated = await env.DB.prepare(
    "UPDATE project_usage_monthly SET used_value = used_value + 1 WHERE id = ? AND used_value + 1 <= ?"
  ).bind(id, limit).run();
  if (!updated.meta.changes) {
    return { allowed: false, ... };  // quota was exceeded at write time
  }

  For Retry-After: Add to the 402 response:
  // Derive reset timestamp
  const [year, month] = quotaResult.monthKey.split("-").map(Number);
  const resetDate = new Date(Date.UTC(year, month, 1));  // 1st of this month
  const resetTimestamp = Math.ceil(resetDate.getTime() / 1000) + (32 - new Date().getUTCDate()) * 86400;
  const retryAfterSeconds = Math.max(1, resetTimestamp - Math.floor(Date.now() / 1000));

  // In response:
  {
    error: "quota_exceeded",
    retryAfterSeconds,
    resetsAt: resetDate.toISOString(),
    ...
  }