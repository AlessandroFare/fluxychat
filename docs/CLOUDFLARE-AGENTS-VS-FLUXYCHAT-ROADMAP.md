# Cloudflare Agents vs FluxyChat — competitive roadmap

> Date: 2026-08-25  
> Clone: `docs/research/agents-main` (gitignored) = [cloudflare/agents](https://github.com/cloudflare/agents) `agents@0.21.0`, MIT  
> Online: Agents docs, Agents Week 2026, MCP 2026-07-28, SQLite DO mandate, AI Gateway unification, Sandbox / Browser Run  
> Companion: [FEATURE_ROADMAP.md](./FEATURE_ROADMAP.md) · [ROADMAP.md](../ROADMAP.md)

This is the **execution plan** after a full pass of the Cloudflare Agents monorepo. Do not treat Cloudflare as a chat competitor. Treat them as the **platform that can swallow the agent-runtime layer** of anyone who ships on Workers.

---

## 0. Thesis (read first)

Cloudflare Agents is **not** Sendbird. It is a **stateful agent OS on Durable Objects**: one DO per agent/session/room, hibernation, SQL, WebSockets, `@callable()` RPC, scheduling, MCP client+server, workflows + HITL, email, voice STT/TTS, Code Mode, sandbox FS, x402, observability, React hooks (`useAgent` / `useAgentChat` / `useVoiceAgent`).

**They cut our legs if** we sell “the Cloudflare-native way to run AI in a room” and a developer can `npm create cloudflare@latest -- --template cloudflare/agents-starter` and get streaming chat, tools, MCP, schedule, and voice for free on the same stack we pay to wrap.

**They do not replace us if** we stay the **multi-tenant product**: rooms, members, JWT projects, billing, moderation, omnichannel, CRDT, E2EE envelope, operator console, hosted + MIT self-host as a **chat kernel** that agents *join*, not a DIY Agent class.

| Layer | Cloudflare Agents | FluxyChat |
|-------|-------------------|-----------|
| Unit of scale | 1 Agent DO per session / user / game | 1 Room DO + D1 tenant DB + JWT project |
| Primary user | Developer building *their* agent | SaaS embedding *chat* (+ agents as guests) |
| State | `this.state` + DO SQLite (`ctx.storage.sql`) | D1 messages + room DO live state |
| DX | `class X extends Agent` + `useAgent` | `@fluxy-chat/sdk` `useChat` + REST |
| Monetization | Cloudflare usage (Workers, DO, AI, Sandbox) | Our plans / self-host CF bill |
| License | MIT, **no external PRs** (SDK moving fast) | MIT, we own the product surface |

**Strategic rule:** absorb *patterns* (lifecycle, schedule SQL, stream resume, MCP 2026-07-28, AI Gateway). Do **not** re-export `agents` as our public API. That makes us a thin wrapper Cloudflare will out-document.

---

## 1. What we actually read (repo inventory)

Monorepo (`pnpm` + Nx, Node 24, oxlint/oxfmt, vitest-pool-workers, Playwright, changesets).

| Package | Version (clone) | Role |
|---------|-----------------|------|
| `agents` | 0.21.0 | Core: `Agent extends DurableObject`, `Lifecycle.install`, routing, WS, RPC, schedule, MCP, email, workflows, x402, browser, skills, CLI |
| `@cloudflare/ai-chat` | 0.10.2 | Protocol adapter: persist messages, resumable streams, `useAgentChat` |
| `@cloudflare/think` | 0.16.0 | Opinionated harness: `getModel`/`getTools`, sessions, FTS5, compaction, non-destructive regen |
| `@cloudflare/codemode` | 0.5.1 | LLM writes TS that calls tools (not one-tool-per-step) |
| `@cloudflare/shell` | 0.4.3 | Sandboxed JS + virtual FS + git (`Workspace`) |
| `@cloudflare/voice` | 0.3.6 | `withVoice` / `withVoiceInput`, STT/TTS/VAD/interrupt, SQLite history |
| `@cloudflare/worker-bundler` | — | Runtime Worker Loader bundling |
| `hono-agents` | — | Hono middleware |
| `@cloudflare/channels` | 0.0.0 unpublished | Transport-neutral Slack/email/Telegram/voice adapters |

Also: `examples/` (playground kitchen-sink, 30+ demos), `design/` RFCs (sub-agents, fibers/recovery, Think, MCP, voice, workspace), `openai-sdk/` adapters, `experimental/memory`, MCP **conformance suites** (stateless + 2025-03-26 / 2025-06-18 / 2025-11-25 / 2026-07-28).

Core class (abridged from `packages/agents/src/index.ts`):

```ts
export class Agent<Env, State, Props> extends DurableObject<Env> {
  readonly lifecycle = Lifecycle.install(this);
  onStart(); onRequest(); onConnect(); onMessage(); onClose(); onError(); onAlarm();
  setState(state);          // broadcast to all sockets; readonly connections throw
  sql`...`;                 // ctx.storage.sql
  schedule(...); queue(); retry();
  // MCP client manager, OAuth across hibernation, workflows, email, agent-as-tool
}
```

Lifecycle is **vendored PartyServer** (`design/rfc-durable-object-lifecycle.md`): capabilities compose onto a plain DO; no published `Server` base.

Client: `AgentClient` on **partysocket** + typed `agent.stub.method()` for `@callable()`.

---

## 2. Overlap map (honest)

| Capability | Cloudflare | FluxyChat today | Verdict |
|------------|------------|-----------------|---------|
| DO hibernation WS | First-class in Lifecycle | Room DO + `do-ws-sessions`, recovery tests | We have it; they packaged it as DX |
| DO SQLite | Default, `new_sqlite_classes`, PITR 30d | We already use `new_sqlite_classes` on Room/User/IP/Supergroup | Align storage APIs, use SQL *in* room for hot state |
| Agent loop + tools | Think / AIChatAgent + AI SDK v6/v7 | `agent-runtime.js` + tools + HITL D1 + loop-control | We have product loop; they have framework DX |
| MCP **server** (rooms as tools) | Full SDK v2, elicitation, OAuth, RPC, dual protocol | Dual-era Streamable HTTP: **2026-07-28** `server/discover` + legacy `initialize` | **Aligned on protocol** (elicitation/OAuth still later) |
| MCP **client** (agent calls MCP) | `addMcpServer`, discover + legacy fallback | Catalog + examples; not Agents-class client | **Lag** |
| Stream resume after disconnect | AI chat recovery fibers, deployed e2e | Room streams exist; not agent-session resume product | **Lag** |
| Scheduling / cron on DO | SQL `cf_agents_schedules`, idempotent `onStart` | Room alarm **queue** (`do-alarm-scheduler`) + cron worker | Different: they schedule *agent callbacks*; we schedule *room jobs* |
| HITL / workflows | `workflows` + pause/resume | D1 `agent_durable_workflows` + approval gates | We have product; they have SDK + playground |
| Voice | `@cloudflare/voice` real STT/TTS pipeline | In-worker Whisper + TTS (`env.AI.run`) behind `/voice-ai/transcribe` + `/voice-ai/speak` + voice messages; duplex WS still client realtime | **Aligned on in-worker speech** (not their `withVoice` DX) |
| Email as channel | Cloudflare Email Service bind | Inbound `email()` handler + `/integrations/email/*` → room / Agent DO | **Aligned on inbound** |
| Code Mode + sandbox | Dynamic Worker + Workspace FS | Tool exec in-worker; no isolate loader / virtual FS | **Lag** (don't fake it) |
| x402 payments | First-class `agents/x402` | Cross-org settlement notes “x402 tomorrow” | Monitor + one spike |
| Multi-tenant JWT / billing / console | None (bring your own) | Core product | **Our weapon** |
| Multi-user rooms, presence, CRDT | Examples only | Production kernel | **Our weapon** |
| Omnichannel adapters (14) | Channels package **unpublished** 0.0.0 | Shipped adapters | **Our weapon (until they GA channels)** |
| Operator console | Playground demo | Next dashboard | **Our weapon** |
| E2EE / group cipher / attestation | Not their job | We have product crypto (no fake MLS claims) | **Our weapon** |
| Cross-org agent rooms, quorum, debate UX | Not in SDK | Moonshots shipped as MVP | **Our weapon** |

---

## 3. What they have that we do not (or only as stubs)

Numbered for the roadmap in §8.

### Runtime / DX

1. **`Agent` base class + `routeAgentRequest`** — one fetch router to named DOs.  
2. **`@callable()` RPC** — typed methods, React `agent.stub.increment()`.  
3. **Automatic state sync** — `setState` → all clients; readonly sockets.  
4. **Sub-agents / facets** — child DOs, nested URLs, `runAgentTool` with child timelines.  
5. **Schedule/cron in DO SQL** with idempotent `onStart` warnings.  
6. **Retries** classified: code-update reset vs memory-limit vs platform transient.  
7. **Observability** — spans, genai attributes, structured logs (package `agents/observability`).  
8. **CLI `agents`** + `create-cloudflare` template (90s to hello-agent).  
9. **Vite plugin** for local DO + HMR (`@cloudflare/vite-plugin` in examples).  
10. **Test matrix** — workers pool + Playwright hooks + MCP conformance + *deployed* recovery e2e.

### Chat / AI harness

11. **Resumable streaming** (fibers / chat recovery) — survive hibernation mid-token.  
12. **Think sessions** — tree messages, FTS5, compaction overlays, multi-session per DO.  
13. **Client tools + server tools** in one protocol (`cf_agent_chat_*`).  
14. **Concurrency strategies** on turns: queue / latest / merge / drop / debounce.  
15. **Context overflow recovery** example (dedicated).  
16. **AI SDK v7** first-class (`AI_SDK_V7_MIGRATION.md` in clone).

### MCP / tools / money

17. **MCP 2026-07-28 stateless** + `createMcpHandler` without a DO session.  
18. **MCP client auto-probe** `server/discover` then legacy `initialize`.  
19. **OAuth for MCP** persisted across hibernation + redirect.  
20. **Elicitation**, RPC transport, WebMCP (page-local tools).  
21. **Code Mode** + **Dynamic Workers** + **Workspace** (SQLite+R2 FS, bash, git).  
22. **x402** pay-per-tool.  
23. **Browser agents** (`agents/browser`) + Browser Run / Kitesurf (platform, not just SDK).

### Channels

24. **Voice pipeline that actually speaks** (Workers AI, AssemblyAI, Telnyx, ElevenLabs examples).  
25. **Inbound/outbound email agents**.  
26. **Slack / Telegram adapters** in Think + unpublished `channels` package.  
27. **Push notifications** example.  
28. **A2A example** (Google/Linux Foundation style demo).

### Platform news (not in clone, still binding)

29. **Agents Week 2026**: Sandboxes GA, Project Think, Browser Run, MCP portals, Code Mode token savings.  
30. **Workers AI + AI Gateway unification** — default gateway, cost/logs without extra product setup.  
31. **New DO namespaces must be SQLite** (2026-07-09 changelog).  
32. **Sandbox SDK 1.0 preview (`@next`)**, Devin Outposts on CF Containers.  
33. **MCP traffic detection / Gateway security** (Cloudflare blog).

---

## 4. What we have that they do not (weapons)

Use these in landing, docs, and sales. Do not dilute them by cloning their playground.

| Weapon | Why it wins vs Agents SDK |
|--------|---------------------------|
| **Room as product** | Multi-user, members, roles, presence, typing, delivery — Agents is 1:1 session by default |
| **Tenancy + JWT + quotas + Stripe plans** | They have `Env` bindings; we have a business |
| **Hosted + MIT self-host** | Same kernel; CF sells usage on *their* account |
| **Omnichannel 14 adapters already in product** | Their `channels` is 0.0.0 |
| **Operator console** | Billing, moderation queue, agent profiles, MCP settings, costs |
| **CRDT / collab / stream overlay** | Agents playground has tictactoe, not Excalidraw+HLS product |
| **E2EE envelope + attestation** | Agents store plaintext in DO SQLite |
| **Cross-org rooms, settlements, private terms** | Platform SDK will not ship escrow between two companies |
| **Decision quorum, debate UX, catch-up digest, cartography** | Product differentiation, not DO primitives |
| **Price narrative** | $0 entry, $1/M messages vs “just use Workers + DO + AI + Sandbox meters” |
| **create-fluxy-chat** | Compete on *time-to-chat-in-SaaS*, not time-to-Agent-class |

Positioning sentence:

> Cloudflare gives every developer an agent computer. FluxyChat is the **room those computers join** — with tenants, audit, and a bill that is not “whatever your DO did this month.”

---

## 5. Where they are *better* at the same thing

Steal the *engineering*, not the product.

| Ours | Theirs | Steal |
|------|--------|--------|
| Room DO ~large JS, custom session maps | `Lifecycle` + capabilities, hibernation close codes 1005/1006/1015 handled | Keep extracting `do-ws-sessions`; never send close on reserved codes |
| Alarm: single CF slot → we built a queue | Schedule table in DO SQL + idempotent cron | Same idea: persist jobs next to the object |
| MCP 2024-11-05 POST only | Dual protocol, conformance CI, OAuth | Upgrade protocol; add conformance tests |
| Agent runtime in worker lib, not a DO | Agent *is* the DO (local SQL, wake on schedule) | Optional **Agent DO** *beside* Room DO, not instead |
| Voice honesty in docs | Real `withVoice` | Workers AI behind room HTTP/WS; `withVoice` DX is theirs |
| Workflows in D1 | Workflows on CF Workflows + DO callbacks | Keep D1 for tenant audit; use CF Workflows for long HITL if it reduces custom resume bugs |
| `vitest` on node/jsdom | `vitest-pool-workers` + deployed e2e recovery | Add worker-pool tests for room + agent DO |
| Wrangler toml | `wrangler.jsonc` + `compatibility_date: 2026-06-11` + nodejs_compat everywhere | Bump dates; jsonc optional |
| Oxlint-level TS in worker is mixed JS | Strict TS, no `any`, export checks, sherif | Continue worker `checkJs` path |
| Agent-as-tool is custom A2A | `runAgentTool` + streaming child timeline in parent UI | Better UX for nested agents in the room canvas |

---

## 6. Best practices to copy (no license drama)

All MIT / public docs. Reimplement against our types.

1. **Hibernation**: persist per-socket attachment; reconstruct presence on wake (we started this). Reciprocate Close only when the peer sent a real frame.  
2. **Idempotent `onStart`**: never `schedule()` without `{ idempotent: true }` or a row check.  
3. **Readonly connections** for spectators / dashboards.  
4. **Named view of retries**: distinguish “CF recycled the isolate” vs “OOM” vs “network blip”.  
5. **Stream recovery**: checkpoint token/offset in DO SQL; client resumes by offset (Ably-like; they shipped it).  
6. **MCP**: probe stateless first; OAuth state in DO storage not memory.  
7. **Code Mode over 20 tool dumps**: fewer tokens, better multi-tool plans — optional advanced agent mode.  
8. **AI Gateway as default** for all LLM calls (logs, cost, provider failover) — we should route `agent-llm.js` through it.  
9. **Examples as product**: their playground *is* the docs. Our `create-fluxy-chat` + hosted demo must stay that good.  
10. **Conformance tests for MCP** — they run bash suites per spec date; we should too after protocol bump.  
11. **Don't animate/market fake voice**. They ship STT. We already documented accounting-only. Keep that until a real pipeline exists.  
12. **Facets / child DOs** for isolation (sandbox, browser session) instead of stuffing everything in Room DO.

---

## 7. Anti-goals (do not do)

- Rebrand FluxyChat as “Agents SDK for chat.” Cloudflare owns that SEO.  
- Depend on `agents` as the public Room API (`useAgent` instead of `useChat`).  
- Copy Think’s session tree into D1 without a migration story.  
- Claim MLS / in-worker STT because they have voice.  
- Wait for their unpublished `@cloudflare/channels` — ship our adapters.  
- Implement WebTransport in 2026 (already ⚠️ on FEATURE_ROADMAP).

---

## 8. Roadmap — work items

IDs: **CF-A-xxx**. Priority: 🔴 Now · 🟡 Next · 🟢 Later · ⚠️ Monitor.  
Effort: S / M / L.  
Rule: each 🔴 item must be **usable in console or SDK**, not a dead module.

### Wave 0 — stop the bleed (2–3 weeks)

| ID | P | Effort | Item | Why | Touch |
|----|---|--------|------|-----|--------|
| **CF-A-001** | ✅ | S | Positioning: docs + compare “Room kernel vs Agent OS” | Buyers comparing `npm i agents` | `room-os-positioning.mdx`, `compare-providers.ts` |
| **CF-A-002** | ✅ | S | MCP protocol version: dual-era 2026-07-28 + legacy initialize | Stop claiming “latest” without shipping it | `mcp-protocol.js`, docs |
| **CF-A-003** | ✅ | M | Route worker-shared LLM via **AI Gateway** (OpenAI + Anthropic URLs) | Cost, logs, failover | `ai-gateway.js`, `llm-providers.js`, `agent-llm.js` |
| **CF-A-004** | ✅ | M | Agent stream **offset resume** on room WS | Hibernation-safe token buffer + client offsets | `stream-offset.js`, `room-do.js`, SDK |
| **CF-A-005** | ✅ | S | `create-fluxy-chat` gold path mentions `@assistant` | Chat + mention in the starter | CLI outro + react template |
| **CF-A-006** | ✅ | S | Compatibility date 2026-06-11 (Browser Run still covered) | Platform SQLite / agents examples | `wrangler.toml` |

### Wave 1 — MCP and agent DX (3–6 weeks)

| ID | P | Effort | Item | Why | Touch |
|----|---|--------|------|-----|--------|
| **CF-A-010** | ✅ | L | MCP **2026-07-28** server: `server/discover` + stateless handler + legacy initialize | Their v0.20 changelog | `mcp-protocol.js`, `mcp-server.js`, `mcp-http.js` |
| **CF-A-011** | ✅ | M | MCP client: `server/discover` + legacy initialize fallback | Agents call remote MCP | `mcp-integration.js` |
| **CF-A-012** | ✅ | M | MCP conformance smoke (discover, 401 metadata, 405, headers) | Don't regress protocol | `mcp-http.test.js` |
| **CF-A-013** | ✅ | M | Elicitation / MRTR on `send_message` | Human-in-the-loop on the wire | `mcp-protocol.js`, mcp servers |
| **CF-A-014** | ✅ | L | Optional **Agent DO** (`AgentDurableObject`) for long-lived 1:1 copilots; Room DO stays multi-user | Don't put Think-sized state in the room hot path | `agent-do.js`, wrangler `AGENT` sqlite class |
| **CF-A-015** | ✅ | M | Typed **callable-style** internal RPC (not public API): room ↔ agent DO | Their stub DX internally | `do-rpc.js`, room `/rpc`, agent `/rpc` |
| **CF-A-016** | 🟢 | L | WebMCP / page-local tools | Browser agents are their story; we only if embed widget needs it | widget |

### Wave 2 — durability, schedule, observability (parallel)

| ID | P | Effort | Item | Why | Touch |
|----|---|--------|------|-----|--------|
| **CF-A-020** | ✅ | M | Persist agent schedules in **room DO SQL/KV** (cron + delay), idempotent claim | Ambient agents today vs their `schedule()` | `agent-schedules.js`, room-do alarm |
| **CF-A-021** | ✅ | M | Retry taxonomy on DO wake (code update / OOM / transient) | Their `retries.ts` | `do-retry-taxonomy.js`, room-do alarm, agent-runtime |
| **CF-A-022** | ✅ | M | OTel genai spans on LLM + tools (`gen_ai.*` via `otel_export_config`) | Enterprise RFPs | `genai-spans.js`, agent-runtime |
| **CF-A-023** | ✅ | S | Readonly spectator WS (dashboard / compliance) | Their readonly connections RFC | `ws-readonly.js`, `connectRoom({ wsReadonly: true })` |
| **CF-A-024** | ✅ | M | `vitest-pool-workers` for hibernation + schedule tests | Their CI bar | `apps/worker/pool`, `test:pool` |
| **CF-A-025** | ✅ | L | Point-in-time recovery for room SQL (30d PITR) | Console snapshot/restore + OpenAPI | `room-pitr.js`, `/rooms/:id/pitr`, insights panel |

### Wave 3 — voice, email, sandbox (only if honest)

| ID | P | Effort | Item | Why | Touch |
|----|---|--------|------|-----|--------|
| **CF-A-030** | ✅ | L | Voice: **Workers AI behind room HTTP** (`env.AI.run` Whisper + TTS) | They shipped `withVoice`; we ship speech on the room kernel | `workers-ai-speech.js`, `/voice-ai/transcribe`, `/voice-ai/speak` |
| **CF-A-031** | ✅ | M | Email inbound → room / agent (CF Email Workers pattern) | `email-agent` example | `email-inbound.js`, worker `email`, `/integrations/email` |
| **CF-A-032** | 🟢 | L | Code Mode **or** Dynamic Worker for untrusted tools | Token cost + isolation | experimental; don't block chat |
| **CF-A-033** | 🟢 | L | Sandbox SDK / Containers for “agent has a computer” | Agents Week GA; not our wedge unless coding-agent SKU | paid SKU later |
| **CF-A-034** | ⚠️ | — | Browser Run / Kitesurf | Platform product; wrap as MCP tool if customers ask | — |
| **CF-A-035** | ⚠️ | — | x402 / AP2 | Align with FEATURE_ROADMAP `#18` `#25` | settlement already notes x402 |

### Wave 4 — productization (our wedge, not theirs)

| ID | P | Effort | Item | Why |
|----|---|--------|------|-----|
| **CF-A-040** | ✅ | M | Console: agent run inspector (tokens, tools, status) | Their playground is the bar | `GET /rooms/:id/agent-runs`, insights panel |
| **CF-A-041** | ✅ | M | Nested agent timeline in room (parent sees child tool stream) | `run_agent` + `parentToolCallId` | `agent-nested-run.js`, workspace panel |
| **CF-A-042** | ✅ | S | Docs Diátaxis: “Build an agent *in a FluxyChat room*” vs “Build an Agent class on CF” | SEO defense | `build-agent-in-a-room.mdx` |
| **CF-A-043** | ✅ | M | Keep 14 adapters + matrix vs unpublished CF channels | Marketing table | `adapter-pattern.mdx` |
| **CF-A-044** | ✅ | M | Cross-org + quorum + E2EE as **default story** in enterprise deck | Things they will not ship |

---

## 9. Suggested sequence (calendar)

```
Now (sprint)
  CF-A-001 002 003 005 006 040
  CF-A-004 (stream resume) — start tests first

Next
  CF-A-010 011 012 014 020 021 022 023 041 042
  CF-A-024 hibernation pool tests; CF-A-043 adapter matrix
  CF-A-025 room PITR; CF-A-044 enterprise default story

  Later
  CF-A-016 032 033
  (WebMCP / Code Mode / Sandbox — real SKUs, not this wave)

Monitor weekly
  CF-A-034 035, @cloudflare/channels publish, Think GA, MCP spec dates
```

---

## 10. Decision log

| Decision | Choice | Reason |
|----------|--------|--------|
| Public API | Keep `useChat` / rooms | Don't become `useAgent` |
| Agent isolation | Add Agent DO later (CF-A-014), Room DO stays chat | Think-sized SQL in the room DO will hurt fanout |
| MCP | Upgrade; don't wait for CF to be “the” MCP host | Our tools are *rooms*; that's the product |
| Voice | Workers AI in-worker; no fake `withVoice` | Docs match `env.AI.run` |
| Sandbox / Code Mode | Later SKU | Not required to sell chat |
| Depend on npm `agents` | No for Room path; optional adapter later | Wrapper trap |

---

## 11. Weekly watch (15 min)

- [github.com/cloudflare/agents](https://github.com/cloudflare/agents) releases / `agents` npm  
- [developers.cloudflare.com/changelog/product-group/ai/](https://developers.cloudflare.com/changelog/product-group/ai/)  
- [blog.cloudflare.com](https://blog.cloudflare.com/) Agents / MCP / Durable Objects  
- `@cloudflare/channels` version (still 0.0.0 in clone)  
- MCP spec date vs `MCP_PROTOCOL_VERSION` in `mcp-server.js`

Refresh this file when `agents` minor bumps (0.21 → 0.22+) or MCP protocol in our worker changes.

---

## 12. Sources

**Local clone:** `docs/research/agents-main` — README, AGENTS.md, `packages/*`, `design/*`, examples list.  
**Code in FluxyChat:** `apps/worker/src/lib/agent-runtime.js`, `mcp-server.js`, `agent-durable-workflow.js`, `room-do.js`, `wrangler.toml`, `FEATURE_ROADMAP.md`.  
**Web (Aug 2026):** Cloudflare Agents docs; changelog Agents SDK v0.20.0 MCP 2026-07-28; SQLite-only new DO namespaces (2026-07-09); Agents Week in review; Workers AI + AI Gateway unification; Voice docs `@cloudflare/voice`; Sandbox SDK 1.0 preview; Browser Run / Kitesurf.
