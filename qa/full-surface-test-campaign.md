# Full-surface test campaign

Status: **open**. Started 2026-09-11. Do not treat the product as "closed" until phases 0–4 are green. Labs (phase 5) can ship with holes if labeled labs.

This is the long pass: Worker HTTP + Durable Objects, every console page that is a product surface, and the packages a customer imports (`sdk`, `react`, `protocol`, `ui`, `create-fluxy-chat`).

Inventory at start:

- ~180 `apps/worker/src/routes/*-http.js` files
- `WORKER_ROUTE_PREFIX_INDEX` in `apps/worker/src/lib/worker-route-dispatch.js`
- ~149 `apps/dashboard/app/**/page.tsx` (mix of console + marketing/guides)
- ~16 Playwright specs under `apps/dashboard/e2e/` (mostly smoke)
- Hundreds of unit tests; `worker-route-coverage.test.js` only checks dispatch wiring, not behavior

Existing smoke is not this campaign. A page that loads is not "the feature works".

## Rules for every case

For a Worker action:

1. Unauthenticated → 401 (or documented public exception)
2. Wrong project / not a member → 403
3. Happy path with JWT (member vs admin where roles differ)
4. Bad body → 400, not 500
5. Quota → **402** `quota_exceeded` (project plan). Per-user flood → **429** `rate_limit_exceeded`. Do not treat 402 as a test bug.
6. Feature off / missing secrets → 503 with a named error (`realtime_sfu_not_configured`, `image_generation_disabled`), not a stack dump

For a dashboard product page:

1. No JWT: blocked, copy that tells you to get a token from Projects
2. With JWT: the primary action (create, list, send, join) hits the Worker and shows success or the Worker error
3. Empty list, one item, failure (network / 403 / 429)
4. Related pages that share state still agree (example: huddle mute vs local track)

For packages:

1. Public exports used in README / docs still typecheck and have a test
2. Errors are the documented classes (`FluxyNotMemberError`, rate limit), not `Error("undefined")`
3. `create-fluxy-chat` template still `doctor`s against a local worker

Do not write Zoom/HIPAA/SLA assertions. Verticals stay beta/labs as in `packages/sdk/src/readiness.ts`.

## Phase 0 — map (one session)

- Script or table: each `WORKER_ROUTE_PREFIX_INDEX` key → dispatcher file → existing `*.test.js` (yes/no)
- Split dashboard routes: **product** vs **marketing** (`guides/*`, `landing`, `compare`, `for-teams`, `features`, legal)
- Mark product pages that only GET vs pages that mutate

Output of this phase: fill the checklists below. Do not skip to Playwright until the Worker contracts for that slice exist.

### Phase 0 result (2026-09-11)

- ~180 `*-http.js` route modules. Most have **no sibling** `*.test.js`; behavior lives in `lib/*.test.js` or nowhere. Kernel HTTP contracts: `apps/worker/src/routes/kernel-http-contract.test.js`. Prefix index vs kernel names: `kernel-surface-map.test.js`.
- GDPR and billing are always-on (not in `WORKER_ROUTE_PREFIX_INDEX`).
- Dashboard: ~149 `page.tsx`. Public vs console: `isPublicSitePath` / `apps/dashboard/lib/kernel-surface-campaign.test.ts`. Kernel product: `/rooms`, `/inbox`, `/projects`, `/onboarding`, `/profile`, `/embed`, `/notifications`. Marketing: `/`, `/guides/*`, `/compare`, `/pricing`, `/features`, legal, `/status`.
- Public SEO copy is guarded against common LLM filler (`marketing-copy` + humanizer test). Keep that test green when editing landing/guides.

## Phase 1 — kernel (users live here)

Worker: rooms CRUD/join, messages send/list/edit/delete, threads, presence, attachments, JWT issue/refresh, guests/`pk_`, GDPR export/delete, CORS, WS connect + hibernation reconnect.

Dashboard: `/rooms`, inbox, notifications, projects, onboarding, profile, settings (auth-related), embed.

Packages: `FluxyChatClient` / room store connect, send, cursor pagination, reconnect backoff.

Heavy cases: two clients same room; message > max size; revoked JWT mid-session; guest vs member publish; `fc_` never in the browser.

## Phase 2 — agents

Worker: invoke, stream, tools allow-list, budget, queue, eval/rehearsal if advertised in console.

Dashboard: `/agents`, new/edit/invoke, llm-keys, platform, a2a.

Packages: `invokeAgent`, stream handlers.

Heavy cases: tool name not in allow-list; LLM `content` must be string (regression); 429 neurons; agent DO vs room DO.

## Phase 3 — collab + verticals we sell as beta

Worker + dashboard + SDK:

- Collab / Yjs (`/collab`)
- Edu polls/breakouts (`/edu`)
- Fleet GPS + device key (`/fleet`, driver)
- IoT HTTP ingest (`/iot`)
- Webhooks, automations that the console actually posts

Heavy cases: device key for the wrong device id; poll spoof `createdBy`; fleet GPS over quota; Yjs on the same WS as chat.

## Phase 4 — huddles (labs, but user-visible)

Worker: `/rooms/:id/realtime/*` including budget 429 (`monthly_gb`, `concurrent`, `video_disabled`, `disabled`).

Dashboard: `/huddles` join/leave, mute, camera blocked without `REALTIME_SFU_ALLOW_VIDEO`.

Do not call this production. Tests must still fail closed without secrets.

## Phase 5 — labs and the rest

Stream, game, spatial, health, events, finance, continuity, truth-market, marketplace, chatbot-builder, bridges, MCP, telephony, DLP, HIPAA page (honest "no BAA"), etc.

Minimum: 401/403 + one happy path if the page mutates. No fake "HIPAA compliant" tests.

## Phase 6 — Playwright against a real Worker

For each **product** page in phase 1–4: one spec that logs in (or pastes admin JWT in the console pattern we already use), runs the primary click, asserts network + UI.

Keep marketing pages as load + no console error only.

Hosted: after Worker deploy. Local: `wrangler dev` + dashboard.

## How to run a slice in a later chat

Say: "continua campagna test, fase N" and open `qa/full-surface-test-campaign.md`. Do **one phase**, write tests first (TDD), keep them in the matching `*.test.js` / `e2e/*.spec.ts`. Update the checklist in this file.

## Checklist (tick when that slice has behavioral tests, not just coverage)

Kernel

- [x] Rooms HTTP (create 400, list 200) — hibernation suite already in `hibernation.test.js`
- [x] Messages 401/400/403/402/429 + guest_read_only + PATCH/DELETE + oversize + CORS
- [x] Auth / guests / GDPR export 401 + erase 403 for members (revoked JWT already in `token-revocation.test.js`)
- [x] Presence POST 403 if not a member (was missing; wired in `presence-http.js`)
- [x] Attachments: drop `javascript:`/`data:`/`..` (`message-attachments-sanitize`)
- [x] Two sockets in a room both get the same chat `broadcast`
- [x] Dashboard rooms empty state without JWT ("Connect a session") + inbox/projects copy gates
- [x] SDK: `pk_` on WS query, **never `fc_`**; `createMessage` maps 403→`FluxyNotMemberError`, 429→`FluxyRateLimitError`
- [x] `create-fluxy-chat` doctor helpers (`parseEnvFile`, hosted hostname)

Playwright: `e2e/campaign.product.smoke.spec.ts` + `rooms.kernel.smoke.spec.ts` (no JWT). Integrated kernel/product specs mint JWT in globalSetup.

Agents

- [x] Invoke HTTP 401/400/422/404/429/402/409 + happy path (`agents-http-contract.test.js`)
- [x] Tool allow-list fail-closed (`agent-allowlist.test.js`) + LLM `content` string (`llm-message-content.test.js`)
- [x] Agent DO ping/schedule (`agent-do.test.js`)
- [x] Dashboard agents console JWT copy before list/invoke
- [x] SDK `invokeAgentRest` maps 429/404 (and 402/409/422) to typed errors

Packages public API: README exports pinned in `campaign-public-api` / `index.test`. Integrated Playwright mints JWT from the Worker (`/auth/token`); do not invent `tid` when `FLUXY_CONSOLE_PROJECT_ID` is empty.

Beta verticals

- [x] Collab HTTP 401/400 + files list; Yjs update/awareness relay on the same room handler (`yjs-sync.test.js`)
- [x] Edu polls 401/400 `title_required` + spoofed `createdBy` ignored; breakouts 401/403 via `canAccessRoom`
- [x] Fleet GPS 401/400 lat + 403 `vehicle_mismatch` + ingest quota 429
- [x] IoT register 401 + readings with `iot_` key for another device 401
- [x] Webhooks register 401 + private URL `ssrf_blocked`; dashboard JWT copy on collab/fleet/iot/webhooks

Huddles (labs — not production)

- [x] SFU HTTP: 401, 403 membership, 503 `realtime_sfu_not_configured`, GET budget snapshot, 400 missing SDP, 429 `hourly` / `monthly_gb` / `concurrent` / `disabled` / `video_disabled` (`huddles-http-contract.test.js`). Lib budget already in `huddle-sfu-budget.test.js`.
- [x] Dashboard `/huddles` JWT gate + copy that video stays off unless `REALTIME_SFU_ALLOW_VIDEO=true`. Console client surfaces 429 reason + 503 via `parseWorkerJson`.
- [x] Two-tab Playwright **skipped** (SFU secrets stay in prod; do not fake them locally). Mute/camera UI is local until a hosted SFU run.

Phase 6 Playwright

- [x] No-JWT product smoke: rooms, projects, agents, collab, fleet, IoT, webhooks, huddles (`e2e/campaign.product.smoke.spec.ts`). 9 passed locally.
- [x] Huddles two-tab **skipped** — SFU secrets stay in prod (`e2e/huddles.labs.smoke.spec.ts`)
- [x] Marketing load already in `landing.smoke.spec.ts`
- [x] Integrated click+network with live Worker: kernel rooms/inbox/agents (`campaign.kernel.integrated` + inbox/agents specs) and product projects/collab/fleet/iot/webhooks/notifications/embed/llm-keys/a2a (`campaign.product.integrated`, 9 passed). JWT minted in `e2e/global-setup.integrated.cjs` from `/dev/provision` + `/auth/token`. Skip JWT at spec import (`skipWithoutAdminJwt`). Local: Worker `:8787` + Next `:3000` + `PLAYWRIGHT_SKIP_WEBSERVER=1` + `PLAYWRIGHT_CHANNEL=chrome`. Session seed binds `/` with `waitUntil: commit` (avoid `/projects` + reload, which aborted when Next hung).
- [ ] Onboarding wizard E2E (`onboarding.integrated`) still skips when Clerk hosted hides `admin-jwt-input`. Self-host without Clerk keys to run connect → mint → first message.

Packages

- [x] `@fluxy-chat/sdk` public API (`campaign-public-api.test.ts` + `api-report.test.ts`: FluxyChatClient, documented error classes, no worker-runtime leak)
- [x] `@fluxy-chat/react` README hooks (`useThread`, `useNotifications`, `useLocation`, `useWebPush`, `useUserChannel`, `useFluxyChatOptional`)
- [x] `@fluxy-chat/protocol` inbound guards + Room DO outbound list including `derived_set` / inbound `derived`
- [x] `@fluxy-chat/ui` chat primitives (`ChatWindow`, `MessageList`, `Bubble`, `Composer`, themes)
- [x] `create-fluxy-chat` doctor/smoke

Labs (minimum)

- [x] HIPAA GET BAA 401/403 + empty list (no “certified” stamp); DLP 401/400; live events 401/400 title; game leaderboard 401/empty; spatial 401/400/403; truth credits 401; events trigger 401; telephony 401/400; marketplace public list + admin 401/403; widgets 401/400; bridges 401; MCP 401 JSON-RPC (`labs-http-contract.test.js`)
- [x] Dashboard: HIPAA/health/finance honest copy (no BAA, no PAN); stream/game/dlp/bridges/builder/mcp/marketplace JWT or session bar
- [x] SDK `PLATFORM_READINESS.health` stays labs and says “No HIPAA BAA”
