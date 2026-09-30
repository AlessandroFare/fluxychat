# Flagship next (free budget)

2026-09-28 · Kernel chat/threads/Yjs: leave as-is. Do not chase their thread-docs deploy.

## What the market is selling in 2026

| Player | Object | Agent story | Cost to copy |
|---|---|---|---|
| Liveblocks | Document | Agents as users of Sync; **Feeds used as chat + traces**; AI in comment pins | We already split feeds ≠ chat. Don’t blur it. |
| Stream | Support/consumer channel | Vercel AI SDK, ephemeral token stream, cancel, `ai_indicator.*` | Paid SKU + scale we don’t claim. |
| Cloudflare Think / `AIChatAgent` | **The agent is the Durable Object** | Stream resume after eviction, SQLite session, `isRecovering` | Different product. We are a **room** DO with humans on it. |
| Rivet Actors | Generic actor runtime (Apache 2.0) | Same tweet as DOs: cheap stateful units; their sample is **one actor per agent** + queue + `broadcast("token")` | Infra, not a chat SDK. Do not rebase the Worker on it. |

FluxyChat’s sentence they cannot steal without becoming us: **one room Durable Object; humans and `invokeAgent` on the chat timeline; Yjs on the same object; MIT on your CF account.** Hosted stays beta.

## Already flagship — don’t reopen

Chat + nested `parentId` / `useThread`, same socket, depth 8, Yjs second binary on same room, `pk_` / `fc_`, MIT self-host.

## Have it, not flagship yet — pick these

### 1. Human + agent on the **room** (primary)

We have `invokeAgent`, `@handle` mention, WS stream as message edits, `agentStatus` on presence, `FluxyMessageStream` abort, reconnect merge (0.6.12). Docs are a curl + three snippets.

Bar they set: Stream’s thinking/generating/cancel; CF’s recover-after-eviction; Liveblocks’ agent in presence + feed of steps.

**Free work:** one gallery app (deal or classroom) that is the screenshot: human, `@assistant`, streaming bubble, `agentStatus`, traces in **feeds** not chat. Cookbook: cancel, what happens on hibernate (honest: we are not Think’s fiber resume). Do not add Mem0 or a paid AI SKU.

### 2. Visibility on send (second)

Kernel already filters D1 + WebSocket (`visibility` / `visibleTo` / `role:`). Liveblocks is marketing private **comment** threads. Ours is private **chat lines in a live session** (eval, teacher, deal counsel).

**Free work:** make `guides/role-scoped-visibility` + `deal-room` gallery the second screenshot. Don’t build a new primitive.

### 3. Feeds as agent log, not chat (third)

`useFeeds` exists; Liveblocks launched Feeds and stuffed chat into them. Keep the split. Optional small code: PATCH/update a feed message for “thinking → done” without a new chat row (they have `updateFeedMessage`). Only if the gold demo needs it.

### 4. GEO for coding agents (always-on, $0)

`docs/llms.txt` exists. Cloudflare’s `agents/llms.txt` owns “DO + chat”. We need the query: **SaaS tenant room on Workers, humans + agents, not an Agent class.** Tighten homepage/docs first paragraph to that. No ads.

## Don’t spend free cycles on

Voice/SFU, Bridges-as-desk, spatial/labs verticals, thread inbox `(room, threadId)` parity, SOC2/HIPAA, Stream-scale ephemeral DB, matching Think eviction resume unless we already have a failing gold demo.

## Sequence (weeks, one person)

1. Gold `assistant-room` or `deal-room`: mention → stream → presence → feed traces. Record two-tab GIF (free).
2. Visibility: same app, whisper / `role:evaluator` actually hidden in the other tab.
3. `llms.txt` + concepts hero: room vs Agent DO vs document CRDT.
4. Only then: feed message update if the GIF lies without it.

### Implementation started (2026-09-28)

- `deal-room`: two seats (`?seat=counsel`), per-seat `guestKey` in sessionStorage, counsel whisper `visibleTo` self, `invokeAgent` / `@assistant`, `stopAgentStream`, traces feed, honest hibernate copy.
- Docs: `invokeAgent(content, { agentId })`, streaming + hibernate, concepts/`llms.txt` room-vs-agent-vs-file, gallery + visibility guide + assistant-room pointers.
- Console: Room insights default `SELECT` + SQLite heading.
- Feeds stay POST-only (new row per status). Skill: `skills/fluxy-chat-room/SKILL.md` (`npx skills add AlessandroFare/fluxychat --skill fluxy-chat-room`).
- Homepage gallery: `invokeAgent(content, { agentId })`, deal preview is two seats (mock UI, not a live Worker).
- Apex `/llms.txt` on the marketing app; skill under `skills/fluxy-chat-room` for `npx skills add`.
- Capture: `DEAL_ROOM_ORIGIN=… pnpm --filter @fluxy-chat/dashboard capture:deal-room` on a public guest room. Spec now clicks propose, both acks, ask-agent, then counsel refresh. Still needs a live origin to write png/gif. Not a hosted 60s video until those files exist and someone records the UI.

---

## Rivet (github.com/rivet-dev/rivet) — 2026-09-28

Twitter thread is right about the **primitive**. It is not a product we should adopt.

Rivet = Apache 2.0 actor engine (Rust Pegboard/Gasoline) + `rivetkit` TS library. Deploy as npm lib, Docker/`rivetdev/engine`, or Rivet Cloud. They sell the hammer: ~ms boot, sleep when idle, per-actor SQLite, WS, queues, workflows, scheduling. Chat is listed as a *use case* of that hammer (“one actor per room”), same as “one actor per agent / doc / tenant DB”.

### Do not

- Replace `RoomDurableObject` with Rivet. Kernel is already the nail: one room DO, hibernation, WS, alarms, `new_sqlite_classes` + D1, MIT on Cloudflare.
- Add a second runtime (Vercel Functions / k8s) “for portability”. Hosted + self-host CF is the story. Dual-runtime is unpaid years.
- Copy their default sample (actor = agent, tokens on a custom event). That is Think, not a tenant room with humans on the timeline.

Caveats in *their* own compare notes: WS hibernation on Vercel was still missing (idle sockets still cost). DO caps SQLite (~10 GB); they pitch S3-tiered “bottomless” SQLite for self-host surges. We do not need that until a room hits D1/DO limits for real.

The “0.6 KB RAM / $0 idle vs k8s” table is marketing vs pods/VMs, not vs Cloudflare DOs. We already sit on that side of the table.

### Steal (free, no new infra)

1. **Narrative** — “cheap actor → everything looks like a room.” GEO/`llms.txt`: we are the **SaaS room** on that primitive, not the primitive itself (Rivet) and not the Agent class (Think).
2. **Inspector DX** — they ship SQLite viewer, event REPL, workflow inspector. We already have guarded read-only SQL on the room (`room-sql.js`, F5 “chat is a queryable DB”). Make that console path obvious; don’t rebuild Pegboard.
3. **Coding-agent skill** — they push `npx skills add rivet-dev/skills`. We have `create-fluxy-chat` + `llms.txt`. One Fluxy skill that scaffolds the gold room (mention → stream → visibility) beats a generic actor skill.
4. **Queue + broadcast for traces** — their `c.queue` + `c.broadcast("token")` is the feed/stream split. Keep tokens on the **chat message edit**; keep steps on **feeds**. Don’t invent a third bus.
5. **Actor–actor** — they first-class it. We already `stub.fetch` Room/User/Agent DOs. Document the room as the address; don’t wrap Rivet RPC.

### Verdict

Rivet is a peer in the actor layer, a possible *customer* of a room SDK if someone self-hosts Rivet and still wants chat/Yjs/agents, not a foundation to switch to. Stay on the flagship sequence above.

---

## Adjacent market (2026-09-28) — not a rebase list

Sources: Cloudflare Think docs (`/agents/harnesses/think`, recovery + README), Liveblocks use-cases (agentic users, chat, AI activity feed, comments AI), Vercel AI SDK “Stopping Streams” + Ably “stop vs disconnect”, Stream Chat AI message-streaming (`ai_indicator.*`), Jeremy Howard llms.txt / SaaS GEO writeups, Vercel Labs `npx skills` (skills.sh), PartyKit docs, Electric SQL README, Convex-vs-sync roundups. No traction numbers of ours. Hosted stays beta.

### What they shipped that we should not copy

| Pattern | Who | Why skip |
|---|---|---|
| Fiber recover + `isRecovering` after DO eviction | Think (`chatRecovery` always on; `chatRecovery = false` gone) | Agent **is** the DO. Our object is the **room**. Honest hibernate copy already in deal-room / agents.mdx. |
| Chat stored in Feeds + `updateFeedMessage` token stream | Liveblocks chat use-case | We keep chat on `messages` + WS edits. Feeds = traces. PATCH still optional. |
| `ai_indicator.thinking/generating/stop/clear` | Stream Chat AI SDK | Paid channel SKU. We have `streaming`, `agentStatus`, `stopAgentStream`. Do not invent a second event family. |
| Mem0 / managed memory | Stream AI SDK optional | Paid SKU. Out of free budget. |
| Dual-runtime “abort + resume” | Vercel AI SDK | Docs: abort and `resume: true` are mutually exclusive. We are not on Vercel Functions for the room. |
| PartyKit / Convex / Electric as the room | Adjacent | PartyKit is DO rooms without our JWT/tenant/agent timeline. Convex is a reactive backend. Electric is Postgres read-path sync. Different objects. |

### What the internet is actually teaching (steal the lesson)

1. **Stop is a product lie unless the server stops.** Vercel/Ably 2026: client `stop()` often only closes HTTP; the model keeps billing. Our `stopAgentStream` sends room WS `{ type: "stream", op: "stop" }`. The Worker finalizes the chat row with tokens already shown. Do not claim Think-style continue-after-eviction. Do not claim Stream’s indicator protocol. Do not claim the LLM vendor always got `AbortSignal` unless we prove it in agent-runtime.

2. **Think split client resume vs durable turn.** Their README: resumable streaming = browser reconnect while the object still runs; durable recovery = deploy/eviction/hibernation. We only have reconnect merge of D1. Name that gap; don’t paper it.

3. **Liveblocks agents are users of Sync.** Presence for “here now”, Feeds for status + (in their model) chat, Comments for pins. Our gold screenshot is the opposite split: chat timeline + feed traces + comment pins separate. Keep teaching that.

4. **GEO for coding agents, not chatbots.** 2026 writeups: `llms.txt` at the **apex** (`fluxychat.com/llms.txt`), one H1, blockquote, task links. `llms-full.txt` is optional and expensive. ChatGPT may not parse it; Cursor/Copilot/docs crawlers might. We already serve `docs.fluxychat.com/llms.txt`. Apex was a 307 only under `/docs/llms.txt`.

5. **Skills are the package manager for coding agents.** `npx skills add owner/repo --skill name` looks in `skills/` (and a few other folders). A skill only in `.agents/skills` is invisible to that CLI. agentskills.io / MCP `skill://index.json` is a later channel, not this week.

6. **Sync engines are not chat.** Electric/Convex/Instant show up in “realtime 2026” roundups as **data** sync. When a coding agent asks “realtime on Cloudflare”, Cloudflare Agents/Think owns the answer unless `llms.txt` says **tenant room + humans + invokeAgent**.

### Still missing (ranked, free)

1. Commit the captured `two-tab.gif` after running `capture:deal-room` on a public guest room (script is in-repo; the binary is not, until you run it).
2. Do **not**: Think recovery, Stream indicators, feed PATCH, llms-full.txt, PartyKit rebase, MCP skill server.

LLM `fetch` abort on `stopAgentStream` is wired (`abortSignal` on `callLlmOpenAIStream`). Apex `/llms.txt`, `skills/fluxy-chat-room`, and agents.mdx stop/hibernate copy are done.

---

## Open backlog (analyst list, 2026-09-28) — not done

Honest inventory. Tools are not legal advice. Hosted is beta. Do not claim Chat SDK listing, Vercel Marketplace, or a pen test until they exist.

### Shipped enough to stop re-litigating

- Agent generation off the Room DO (`AgentDurableObject` `room_invoke`), steer/stop, `agentPolicy`, whisper leak tests, ambient pause when empty, room token budget.
- Guest `shared-ai-room` template, `FluxyRoomChatTransport`, Python stub, `@fluxy-chat/cloudflare-agents` **join helper** (not a subclass of `AIChatAgent`).
- Widget stop / ask-agent; `@fluxy-chat/sdk/testing`.
- Art. 50: `participantType`, IA badge, first-contact notice, HMAC marks + export, public checklist (not a guarantee).
- `POST /ag-ui/join` + `GET /ag-ui/events` = last-run replay, not a live LangGraph host.
- Console inspector: pick a room on Agents → Observability (`/rooms/:id/agent-runs`).
- HITL D1: expiry + chain tick; in-app + web-push; email/Slack one-tap `GET /public/hitl/tap` (HMAC, current approver only). Slack interactivity + optional Slack user map (UUID on the button when mapped).
- `createFluxyTokenRoute` (server mint with `fc_`). `@fluxy-chat/auth` Clerk / Auth.js / Better Auth / Lucia / Supabase / OIDC `sub`. MCP Apps room state GET/PUT + WS.
- `security.txt`, SAML assertion digest, SSRF host allowlist mode.
- `fluxy.config.js` `jurisdiction: "eu"` = self-host reminder. Not a Wrangler DO jurisdiction binding.

### Still missing — product

1. **MCP Apps state** — KV JSON merge + WS. HTTP PUT also upserts Y.Map `fluxy_mcp_app_state` on the room Y.Doc (LWW by version, same family as game checkpoints). Incoming iframe origins: `isAllowedMcpAppMessageOrigin` (no `*`). srcDoc messages use origin `"null"` only if you list it. Not Automerge. Concurrent HTTP writes are still KV last-write-wins.
2. **Async approval off-room** — in-app + web-push + email + Slack incoming webhook. One-tap HMAC GET `/public/hitl/tap`. Slack **interactivity**: `POST /public/hitl/slack` + `HITL_SLACK_SIGNING_SECRET`. Optional `hitl_slack_user_map` (`GET`/`PUT` `/api/hitl/slack-user-map`): mapped clicks send the approval UUID, not the tap token. Unmapped buttons still carry HMAC.
3. **Chat SDK adapter (real)** — `chat-adapter-fluxychat` (`postMessage`, `fetchMessages`, `listThreads`, edit/delete, `createFluxyChatAdapter`). Optional `chat` peer. Catalog payload: `packages/chat-adapter-fluxychat/listing/adapters.entry.json`. **Not listed** on chat-sdk.dev until a vercel/chat PR merges. Not `@chat-adapter/*`.
4. **Hybrid control plane** — ops: self-host Worker on the customer CF account. Doc: `operations/hybrid-control-plane`. Not a SKU (we do not operate their DOs).
5. **Room evals CI** — dashboard eval + `fluxy-eval` offline JSON. GitHub `gates` runs `fluxy-eval` on `packages/sdk/fixtures/eval-search.json`. Live: `fluxy-eval replay` → `POST /agents/:id/invoke` `stream:false`, case checks + tool/cost/token diff vs `runs[0]`. Not a judge model. Not mid-stream replay. Not a live Worker in CI.
6. **A2A as participant** — `POST /a2a/rooms/:roomId/join` seats the card as a **local bot** + `agent_policies` row (`message_keyword`, `notify`). Not a live remote A2A runtime in the room.
7. **Identity one-liners** — `@fluxy-chat/auth`: `createFluxyTokenRoute({ getUserId })`, Clerk, Auth.js, Better Auth, Lucia, Supabase `getUser`, OIDC `sub`. Not a vendor SDK. `fc_` only.
8. **shadcn registry** — `GET /r/registry.json` and `npx shadcn add <origin>/r/fluxy-chat-widget.json`. Wrapper around npm packages, not a copy of the UI tree. Not listed on ui.shadcn.com.
9. **Durable runtimes as the loop** — `publishExternalGenerationToRoom` posts finished text (`POST /messages`). `publishExternalGenerationChunksToRoom` POSTs then PATCHes the same row as your job yields strings. Agent DO unused. Not a hosted Inngest product. Not Think resume.
10. **Vectorize / AI Search** room memory — optional `VECTORIZE` + `AI`; `GET /rooms/:id/memory?q=` + Rooms → Room memory search. D1 `LIKE` first. Not AI Search. Not Notion/Drive.
11. **Stripe metering** of *our* tenant (`project_plans.stripe_customer_id`) — optional `STRIPE_AGENT_METER_EVENT_NAME` posts Billing Meter events on completed agent runs (token sum). Operator cap: Rooms → Advanced → Room insights. Not Stripe of the tenant’s customers. Not a live Marketplace SKU.
12. **Import ChatGPT/Claude JSON** — `POST /rooms/import-transcript` + Rooms file picker. Cap 400 messages. No scraping.
13. **Public read-only live link** — `/share/:roomId` (Clerk-public) + `GET /public/share/:id` (`type=public` only, no keys). Rooms → Copy public share link. `ChatWindow` / widget `readOnly`. Optional `?pk=pk_…`. `PUBLIC_GUEST_READ_ONLY` still gates other guest writes. Not an unlisted-private product.
14. **Vertical landing pages** — `/landing/incident`, `/landing/support`, `/landing/pr-review`. Honest: war-room / shared-ai-room / deal-room scaffolds, not new vertical SKUs.
15. **EAA / WCAG 2.2** — widget live region, labels, skip-to-composer, Escape, composer + `ChatWindow` border `#5c5c5c`. Dashboard public axe in `a11y.axe.spec.ts`. Status note: `operations/accessibility-conformance`. Not a certificate or a completed VPAT.
16. **Vercel Marketplace / native integration** listing — draft only: `docs/marketplace/vercel-integration.draft.json` + `operations/vercel-marketplace`. Not listed. `vercel integration add` is not an install path.
17. **`npx fluxy-migrate`** Pusher/Ably/Stream/PartyKit **export JSON** → import-chat-history rows (cap 400). Then `pnpm import-chat-history`. Not a live channel proxy.
18. **External pen test** before enterprise outbound. In-repo CI is not that. Do not advertise a pen test.
19. **Prompt-injection / multi-agent room hardening** — default two-key HITL + markdown host allowlist (`SHARED_ROOM_TWO_KEY`, `AGENT_MARKDOWN_HOST_ALLOWLIST`). Docs: `guides/security/shared-room-agent-defaults`. Tests use synthetic markers only. Not a pen test.
20. **EU DO jurisdiction** — self-host: `applyWranglerDoJurisdiction` + `node apps/worker/scripts/apply-do-jurisdiction.mjs --write` from `fluxy.config.js`. D1 region is still the DB you created. Not a hosted dashboard toggle.
21. **Room Decisions** — D1 labels + floor modes + optional CLM→Jev cascade. Not a published room-hour cost. Not tenant NL policy. Not best-of-N. Docs: `guides/room-decisions`.

### Sequence (one person, still free)

1. Email/Slack one-tap HITL — shipped (`PUBLIC_APP_URL` + optional `HITL_SLACK_WEBHOOK_URL`). Slack interactivity optional (`HITL_SLACK_SIGNING_SECRET` + `POST /public/hitl/slack`).
2. Widget a11y pass — first pass (live status, labels). Not an EAA certificate.
3. `fluxy-eval` CLI — offline JSON + optional live `replay` (real invoke, tool/cost diff).
4. Stop. Do not start 14 vendor adapters or Marketplace paperwork until 1–3 have a screenshot.

---

## Integration kit (2026-09-29) — war room behind the ticket

Internal. Not public copy. Kernel chat/threads/Yjs: leave as-is. Hosted stays beta. Do not name Portal. Do not buy SOC 2. Do not claim Marketplace listings, GitHub agent-app waitlist access, Notion External Agents access, or a HIPAA BAA.

**Idea:** Linear / Jira / GitHub / Notion / Zendesk / etc. open a door (mention, assign, webhook). FluxyChat is the live room where humans + agents decide; the result goes back to the ticket. Three patterns, built once: (1) agent inside the tool, (2) room tools via MCP with delegated tokens, (3) **entity room** (`linear:issue:ENG-123`).

**Order (product):** Linear → GitHub → Slack → incident template (PagerDuty / incident.io + Sentry) → one of Zendesk / Intercom / HubSpot **if** a support design partner shows up → Notion / Jira last (access + enterprise demand).

**Checkpoint rule:** if nobody outside the repo uses a phase, stop adding providers. Interview. Do not grow a 10-app surface with zero users.

**Security before public hosted OAuth installs:** encrypt tokens at rest (`WEBHOOK_SECRET_ENCRYPTION_KEY`), min scopes, revoke + kill switch. Hosted SAML stays off (`SAML_SSO_ENABLED`). Ticket egress uses GitHub/Linear/Jira host allowlists (no free URLs), so DNS-to-private is closed for those writes. Linear/GitHub **agent-in-tool** (agent session, merge check) waits on per-project encrypted tokens + a security review — not on closing SAML XSW, because hosted SAML is already off. Untrusted issue/PR/ticket/Slack text: two-key + unicode strip + markdown allowlist (already on). Slack / customer content: `no_train`. Writes always go through a **write intent** + human approve (dry-run default for providers without a ticket API).

### Decisions (D1–D5)

| Id | Choice |
|---|---|
| D1 | Direct Worker mappers. Do **not** take a Chat SDK Linear/GitHub/Slack adapter dependency until a one-day prototype proves it. |
| D2 | Tokens in-house (`encryptSecret` / existing webhook crypto). Not Nango / Vercel Connect / Composio. Revisit only after a design partner and a vendor-security review. |
| D3 | Self-host: operator secrets + webhook URL. Hosted public FluxyChat apps (Slack/GitHub Marketplace, Linear OAuth app) **not** this week. Manifests later. |
| D4 | Slack (and support tickets) `no_train`. Never put that text in eval/label datasets. |
| D5 | First cluster = engineering (Linear/GitHub), same wedge as deal-room. |

### What already exists (do not rebuild)

- Bridges Slack/Discord inbound (`/webhooks/bridge/slack/:id`). HITL Slack `POST /public/hitl/slack`.
- `POST /rooms/:id/tickets` GitHub/Linear/Jira with **Worker env** PATs (`GITHUB_TOKEN`, `LINEAR_API_KEY`, `JIRA_*`). Not workspace OAuth.
- Incident CRUD `/incidents` (P20). External event ingest as `server_event`. A2A HTTP already (`/a2a/*`). TokenCrypto / `WEBHOOK_SECRET_ENCRYPTION_KEY`.
- Trust pack `/trust`. ChatGPT import stays (`POST /rooms/import-transcript`).

### Ship in-repo (kit v0) — this implementation

One foundation, thin event maps for: `linear`, `github`, `slack`, `pagerduty`, `incidentio`, `sentry`, `zendesk`, `intercom`, `hubspot`, `notion`, `jira`.

- Entity link: `provider + type + id` ↔ `roomId` (incident fingerprint = entity id).
- Inbound: `POST /integrations/webhooks/:projectId/:provider` HMAC, idempotent delivery key, kill switch.
- Normalized `ExternalEvent` → room `server_event` (`external.*`), body **untrusted**.
- Write intents; approve runs GitHub/Linear/Jira via existing ticket helper; other providers dry-run only.
- Console: Integrations page real Worker panel (not the in-memory CRM demo).
- Docs: `guides/integration-kit`. Honest status/limits. No Marketplace, no SOC 2, no “we never see tokens on hosted if we operate the Worker”.

### Explicitly not this week

- Linear agent-session OAuth app + activity API (preview; needs their app).
- GitHub App identity / required check run / agent-apps waitlist.
- Slack Marketplace + RTS/MCP with user tokens (reuse Bridges + HITL buttons first).
- Live PagerDuty/Sentry MCP writes; keep MCP tools read-only until approve.
- Zendesk Sunshine switchboard, Intercom Fin HITL API, HubSpot custom channel (need partner + DPA).
- Notion External Agents waitlist. Jira Forge `rovo:agentConnector` + A2A SSE (reuse existing A2A when access exists).
- Cloudflare Queues / DLQ (accept + process in-request for v0; queue later if volume hurts).
- Customer KMS. Crypto wallets.

### Done-when (kit v0)

Webhook signature + idempotency tests; poisoned-title fixture does not execute a write; kill switch; catalog lists all 11 keys; one console save/link path; docs say what is env-PAT vs unsigned.

### Implementation started (2026-09-29)

- D1 `0229_integration_kit.sql`: connections, entity links, deliveries, write intents.
- Worker: `integration-providers.js` maps 11 vendors; `POST /integrations/webhooks/:projectId/:provider`; JWT `connections` / `entity-links` / `write-intents`. Writes: GitHub/Linear/Jira via existing env PATs after approve; others dry-run.
- Console Integrations panel (admin JWT). Docs: `guides/integration-kit`.
- Decisions D1–D5 as above. Checkpoint: no phase-2 Slack Marketplace until an external team uses Linear/GitHub webhooks.

### Sources (verify again before OAuth apps)

Linear agent-interaction / agents-in-linear; GitHub agent-apps changelog 2026-06-02; Slack RTS/MCP; PagerDuty + incident.io MCP; Sentry MCP vs REST; Zendesk system user; Intercom Fin HITL; HubSpot custom channels 2026.01 / MCP; Notion developer platform 2026-05-13; Atlassian remote agents + Rovo A2A. Token brokers: Nango agent-sessions (not chosen).

## AI SDK 7 + approvals product (2026-09-30)

Started, not a marketplace launch.

- `FluxyRoomChatTransport` maps `tool-approval-response` → HITL decide (HMAC verify on Worker).
- `POST /approvals/require` ephemeral room. SDK `requireApproval()` + OpenAI/LangGraph adapters.
- OPA input v=1 + HTTPS-only `evaluateAgentPolicyOpa`, fail-closed from `createPolicyAwareApprovalGate`.
- `GET /api/hitl/metrics` fatigue counts. `GET /api/hitl/approvals/:id/evidence` pack v=1. Name-based risk tier on `requireApproval` timeout + inbox badge.
- `@fluxy-chat/ai-sdk-workflow` workspace helper (private). Room is reviewer; we do not ship WorkflowAgent.
- MCP `apps/worker/server.json` (`io.github.alessandrofare/fluxychat`). Docs: `guides/mcp-registry`. CI `check:mcp-server-json`. Not submitted.
- Yjs agent suggestions: propose / accept / reject. HITL `yjs.acceptSuggestion`. Accept copies onto `storage[storageKey]`.
- Compare `/compare/sendbird` and `/compare/cometchat` with sourced list prices (30 Sep 2026).
- Research queue: `qa/design-partner-research-queue.md`. No outreach claimed.
- Still open (not code): submit `server.json` to the official MCP registry; next `@fluxy-chat/sdk` npm publish so `mcpName` ships. No outreach on the design-partner queue.

