# FluxyChat — Feature Roadmap & Implementation Guide

> Consolidated technical roadmap (Aug 2026). Merges product research, zero-budget constraints, and **verified code inventory**.
> Companion docs: [ROADMAP.md](../ROADMAP.md) (business/phases), [ROADMAP_REALTIME_FEATURES.md](../ROADMAP_REALTIME_FEATURES.md) (AI SDK parity matrix).

## How to use this document

| Symbol | Meaning |
|--------|---------|
| 🔴 **Now** | Ship in current sprint — high leverage, code partially exists |
| 🟡 **Next** | Q3–Q4 2026 — parity or differentiation |
| 🟢 **Later** | 2027+ — verticals, research, paid-aggregator exceptions |
| ⚠️ **Monitor** | Do not implement yet — track spec/browser maturity |
| ✅ | Implemented and usable in repo |
| 🟨 | Partial — demo/tests exist, production hardening needed |
| ⬜ | Net-new |

**Workflow for every item:** research → align with [ROADMAP.md](../ROADMAP.md) ADL → implement → test → docs → dashboard UI → landing if warranted.

**Protocol layers (complementary, not interchangeable):**

| Layer | Protocol | FluxyChat role |
|-------|----------|----------------|
| Agent → tool | MCP | ✅ MCP audit CI, agent runtime |
| Agent → user | AG-UI / A2UI | ✅ `#5` live chat + workspace |
| Agent → agent | A2A (Linux Foundation) | ✅ `#24` production adapter |
| Agent → commerce | x402 / AP2 / UCP | ⬜ research `#18`, `#25` |

---

## Executive summary

FluxyChat is already far beyond “chat SDK”: 15 omnichannel adapters, Room DO realtime, agent runtime, embeddings, voice pipeline, CRDT/Yjs, generative UI primitives, E2E envelope, MLS scaffold, federation bridge SDK, OTel export, MCP audit CI.

The gap is not feature count but **productization**: wire partial modules into one coherent UX, harden multi-user policies (branch/retry done), and ship observability + search + AG-UI as defaults tenants can turn on without ops.

**Highest-leverage differentiators (2026 research — no competitor in realtime chat has these natively):**

1. **Cross-Org Agent Rooms** (`#32`) — moonshot: agenti AI di org diverse in room neutra con escrow + audit bilaterale
2. **Agent workspace live in chat** (`#26`) — team watches agent work step-by-step in a shared room canvas ✅
3. **Counterfactual Replay** (`#44`) — branch + re-run tool_call side-by-side (composizione branch + OTel unica)
4. **A2A adapter** (`#24`) — external agent discovery via Agent Card ✅

**Recommended execution order (next 10 weeks — updated round 3):**

1. Async Decision Quorum (`#52`) — lowest effort, high async-team value
2. Enterprise blockers: guest anti-spam (`#58`), status page (`#62`), SSO/SAML spike (`#54`)
3. Smart catch-up digest (`#33`) + Passkeys (`#36`)
4. Counterfactual Replay MVP (`#44`)
5. Cross-Org Agent Rooms MVP pilot (`#32`) with 1 design partner
6. Semantic search polish (done) + Chat Cartography MVP (`#53`)
7. Ambient agents policy engine (`#38`)
8. Moderation console (`#57`) + media pipeline (`#56`)

---

## Production readiness matrix (execution order 1–11)

| # | Item | Ship status | Production gate |
|---|------|-------------|-----------------|
| 1 | Semantic search UI + toggle | ✅ Production | Tenant toggle, hybrid FTS+vector, `/search` + `/settings/search` |
| 2 | Agent workspace live (`#26`) | ✅ Production | Live steps in room chat via `AgentWorkspacePanel` |
| 3 | Unified voice pipeline (`#12`) | ✅ Production | Default `unified` mode in SDK + `/voice-ai` |
| 4 | Thread summary + AI link unfurl (`#22`, `#23`) | ✅ Production | `ThreadSummary` + `aiSummary` in link previews |
| 5 | AG-UI adapter (`#5`) | ✅ Production | `AgentUiRenderer` wired in workspace panel; SDK `agentWorkspaceStepsToUiParts` |
| 6 | Langfuse/OTel eval (`#9`) | ✅ Production | Dataset eval with tool/latency checks; auto OTel queue + `/admin/agent-eval/flush-otel` |
| 7 | Ephemeral + retention (`#19`) | ✅ Production | Room TTL applied on WS + REST send; D1-safe batched purge cron |
| 8 | Smart routing (`#21`) | ✅ Production | Live DO presence + `agent_capacity`; notify assignee; optional load bump |
| 9 | Silero VAD (`#10`) | ✅ Production | Frame VAD + optional ONNX (jsDelivr); PCM path in pipeline; hybrid turn detection |
| 10 | A2A adapter (`#24`) | ✅ Production | HTTPS validation, external Agent Card fetch, task delegation to remote endpoint |
| 11 | Matrix + audit WORM (`#16`, `#20`) | ✅ Production | Health cron, outbound retry, R2 archive, hash chain verify + `AUDIT_CHAIN_ENABLED` |

**Next wave (production gates):**

| # | Item | Ship status | Production gate |
|---|------|-------------|-----------------|
| 14 | Data residency (`#14`) | ✅ Production | D1 policy, write-path enforce REST+WS, `/settings/residency` |
| 13 | Visual moderation (`#13`) | ✅ Production | Image attachments + stream frames → vision AI → `ai_moderation_queue` |
| 15 | Accessibility WCAG 2.2 | ✅ Production | `a11y.axe.spec.ts` + `a11y.admin.integrated.spec.ts` (E2E_ADMIN_JWT) |
| RT | Realtime hardening (audit subset) | ✅ Production | JWT refresh + idempotent retry + location privacy + push race guard + stream parts bridge |
| 29 | Bandwidth budget CI | ✅ Production | `check:bandwidth-budget` — synthetic N-bot payload regression gate |
| 31 | Post-quantum TLS docs | ✅ Production | `/security` PQ checklist + panel; Cloudflare ML-KEM edge |
| Game | NPC rate limits | ✅ Production | `POST /games/npcs/:id/interact`, `GAME_NPC_RATE_LIMIT_RPM`, D1 `game_npcs` |
| 4 | Room auto-translate | ✅ Production | Per-room target lang, D1 cache, `message.auto_translated` fan-out |
| 5 | AG-UI live chat tools | ✅ Production | `AgentUiRenderer` + `toolThreadEventsToUiParts` in fluxychat |
| 6 | Room E2E admin UI | ✅ Production | `/settings/e2e` enable/rotate + audit on key rotation |
| 8 | AI notification priority | ✅ Production | `notification-priority.js` scoring + low-priority push batching |
| 7 | CRDT / Yjs message-list | ✅ Production | `yjs-message-list.js`, `message-crdt-yjs.ts`, CRDT snapshot API + multi-tab BroadcastChannel sync |
| Stream | Live commerce MOQ/inventory | ✅ Production | `live-stream-commerce.js`, checkout-click tracking, demo Worker wiring |
| Stream | Stripe native checkout | ✅ Production | `live-stream-stripe-checkout.js`, webhook finalize, migration `0178` |
| Stream | VOD replay + chat timeline | ✅ Production | `live-stream-replay.js`, CF reconcile, `/api/live/events/:id/replay`, viewer page |
| Stream | Multi-angle replay sync | ✅ Production | `0179` angle-linked replays, `SyncedReplayPlayer`, reconcile-angles |
| Game | Checkpoints + quest moderation | ✅ Production | Versioned D1 checkpoints, quest keyword gate + approve flow |
| Game | Checkpoint Yjs CRDT merge | ✅ Production | `yjs-game-checkpoint.js`, `game-checkpoint-crdt-yjs.ts`, room DO sync |
| MCP | Marketplace mcp-audit badge | ✅ Production | D1 `0163`, CI webhook, audit grade badge in `/marketplace` MCP Apps tab |
| Game | Tournament brackets (D1) | ✅ Production | `game-tournament.js`, `/games/tournaments`, dashboard bracket UI |
| 30 | MLS group registry + client sync | ✅ Production (coordination) | `room-mls.js`, `room-mls-sync.ts`, D1 epoch/devices, `/settings/e2e` |
| 16 | Matrix appservice webhook auth | ✅ Production | `0180`, Bearer token on `POST /webhooks/matrix/:id`, rotate + dashboard |
| 9 | Langfuse OTLP preset | ✅ Production | `POST /otel/configs/langfuse`, `/agents/observability`, `docs/LANGFUSE_VPS_RUNBOOK.md` |
| 7b | CRDT live Yjs WS push | ✅ Production | Room DO broadcasts Yjs updates on message sync |
| 6b | E2E member join re-wrap | ✅ Production | `rewrapE2eKey` on POST `/rooms/:id/members` |
| Game | Checkpoint cross-room federation | ✅ Production | `POST /games/checkpoints/:key/federate` |
| Stream | Angle CF auto-provision | ✅ Production | `provisionMissingAngleLiveInputs` in reconcile-angles |
| 10 | Silero self-host ONNX URL | ✅ Production | `NEXT_PUBLIC_SILERO_VAD_WASM_URL` / `onnxModelUrl` in SDK |
| 11 | Linear MCP CI | ✅ Production | `examples/mcp/linear`, CI matrix + marketplace badge |

**Ops checklist before deploy:** apply D1 migrations `0163`–`0198`, set env vars in `apps/worker/.dev.vars.example`, run `pnpm run check:upptime`, smoke-test dashboard routes (`/settings/firmware`, `/settings/status`, `/embed`, `/truth-market`).

**Research Round 3 — production gates (🔴 Now wave):**

| ID | Item | Ship status | Production gate |
|----|------|-------------|-----------------|
| 52 | Async Decision Quorum | ✅ Production | D1 `0181`, `message-decisions.js`, SDK `createDecision`/`ackDecision`, `DecisionView` in chat |
| 33 | Smart catch-up digest | ✅ Production | `smart-catch-up-digest.js`, `GET /catch-up/digest`, SDK `getRoomCatchUpDigest`, catch-up banner |
| 34 | Room sentiment dashboard | ✅ Production | `room-sentiment.js`, `GET /sentiment`, SDK `getRoomSentiment`, `/search` mood panel |
| 59 | Scheduled send | ✅ Production | D1 `scheduled_messages`, SDK `scheduleMessage`, composer + menu in `fluxychat.tsx` |
| 54 | SSO/SAML + SCIM console | ✅ Production (console) | `/settings/identity`, `identity-client.ts`, Worker `identity-access-http.js` |
| 58 | Guest anti-spam | ✅ Production | `GET /public/guest-hardening`, Turnstile + IP limit on guest-session, `/embed` live status |
| 36 | Passkeys / WebAuthn | ✅ Production | D1 `0182`, `webauthn-passkeys.js`, `/webauthn/*`, `/settings/identity` register UI |
| 44 | Counterfactual Replay | ✅ Production (MVP) | D1 `0183`, `counterfactual-replay.js`, `/rooms/:id/counterfactual`, compare UI in chat |
| 62 | Public status page | ✅ Production | `.upptime/config.json`, `check:upptime` CI, `/settings/status` |

---

## Zero-budget tool stack

| Need | Tool | Cost | Notes |
|------|------|------|-------|
| Edge runtime | Cloudflare Workers + DO + D1 + R2 + Vectorize | ~$5/mo | Primary platform |
| Embeddings | Workers AI `@cf/baai/bge-base-en-v1.5` or Vectorize | Free tier | `message-embeddings.js` |
| Semantic search | D1 FTS5 + Vectorize hybrid | $0 | `search-http.js`, `search-enhancements.js` |
| Web search | Tavily + SearXNG (public HTTPS + Basic Auth) | $0 / self-host | ✅ `web-search.js` |
| Agent observability | Langfuse OSS on VPS + OTel export | $0 | `otel-export.js`, `docs/observability-otel.md` |
| Voice VAD | Silero VAD WASM + energy VAD fallback | $0 | `voice-turn-detection.ts` |
| Voice pipeline (unified) | Workers AI multimodal / OpenAI Realtime-compatible endpoint | $0 tier | Refactor `#12` — not separate STT+LLM+TTS hops |
| Voice translation + clone | OmniVoice Studio / Whisper + RVC (self-host VPS) | $0 license, **GPU/CPU VPS** | `#27` — exception: needs compute, not Workers |
| Visual moderation | Workers AI / vision LLM on attachments + stream frames | $0 | ✅ `visual-moderation.js` |
| E2EE (simple) | Room shared key envelope | $0 | ✅ `room-e2e.ts` |
| E2EE (group) | OpenMLS / mls-rs (Rust WASM) | $0 | ✅ `mls-encryption.ts` + `room-mls.js` D1 registry |
| CRDT offline | Yjs + DO persistence | $0 | ✅ `yjs-message-list.js`, `message-crdt-yjs.ts` |
| Post-quantum TLS | Cloudflare ML-KEM | $0 | ✅ `/security` docs — edge terminates, no app code |
| A11y | `@axe-core/playwright` | $0 | ✅ `a11y.axe.spec.ts` + `a11y.admin.integrated.spec.ts` |
| Matrix bridge | Synapse + appservice on VPS | $0 | ✅ Worker webhook + Bearer auth; Synapse deploy is ops |
| RCS | Twilio/MessageBird RCS API | **Paid** | Optional 16th channel |
| x402 micropayments | Coinbase x402 + facilitator self-host | $0 dev | `#18` research |
| AP2 / UCP | Google Agent Payments / Commerce Protocol | $0 spec | `#25` research only |
| A2A | Linux Foundation reference SDK | $0 | `#24` — adapter, not rewrite |
| On-device AI | WebGPU + Transformers.js / Ollama via tunnel | $0 | Privacy tier for PII-heavy tenants |
| WebTransport | — | — | ⚠️ `#28` monitor only — not production-ready multi-browser |

---

## 🔴 Now — Chat core & reliability

### 1. Semantic search (hybrid FTS + vectors)

| | |
|---|---|
| **Status** | ✅ Shipped (Aug 2026) |
| **Code** | `message-embeddings.js`, `search-http.js`, `semantic-search-settings.js`, migration `0164_semantic_search_settings.sql` |
| **UI** | `/search` (mode toggle), `/settings/search` (tenant toggle + backfill), chat panel hybrid search in `fluxychat.tsx` |
| **SDK** | `searchMessages` (mode), `searchMessagesSemantic`, `getSemanticSearchSettings`, `backfillMessageEmbeddings` |
| **Ops** | `SEMANTIC_SEARCH_ENABLED=true` in Worker + embeddings provider |

### 2. Message branch / edit / retry policy

| | |
|---|---|
| **Status** | ✅ Shipped |
| **Code** | `message-branch.js`, `POST /rooms/:roomId/branch`, SDK `branchRoomFromMessageRest`, `canBranchFromMessage` in dashboard |
| **Effort** | Done |

### 3. Web search for agents

| | |
|---|---|
| **Status** | ✅ Shipped |
| **Code** | `web-search.js` — default `tavily,searxng`; `agent-runtime.js` via `buildWebSearchContext` |
| **Effort** | Done |

### 4. Translation & summarization as baseline

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) |
| **Code** | `message-translation.js`, `room-translation-settings.js`, post-message `message.auto_translated`, `/settings/translation` |
| **Features** | Per-room `autoTranslateTarget`, D1 cache, manual hover translate in chat |
| **Note** | Thread-level summarize is **`#22`** (separate UX) |
| **Effort** | Done |

### 5. Generative UI (AG-UI / A2UI)

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) |
| **Code** | `ag-ui-adapter.ts`, `AgentUiRenderer`, `toolThreadEventsToUiParts` in live chat + workspace panel |
| **Features** | Tool call/result UIParts rendered in message stream and agent workspace |
| **Effort** | Done |

### 6. E2EE room envelope

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) |
| **Code** | `room-e2e.ts`, `room-e2e.js`, `GET/PATCH /rooms/:id/e2e-key`, `/settings/e2e` |
| **Features** | Enable/disable, key rotation, audit events, member key fetch, `rewrapE2eKey` on member add |
| **Gap** | Client-side re-encrypt historical messages after rotation (future) |
| **Effort** | Done |

### 7. CRDT / offline-first messages

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) |
| **Code** | `message-delivery.ts`, `message-crdt-yjs.ts`, `yjs-message-list.js`, `yjs-sync.js` |
| **Features** | Pending replay + `deliveryConflict` UI; Yjs message-list; CRDT snapshot; multi-tab sync; **live Yjs WS broadcast** on send/edit/delete |
| **Gap** | None for message-list slice |
| **Effort** | Done (message-list slice) |

### 8. AI-prioritized notifications (anti-fatigue)

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) |
| **Code** | `notification-priority.js`, `push-notifications.js`, quiet-hours batch |
| **Features** | Score = mention + urgency keywords + role; batch low-priority pushes |
| **Effort** | Done |

### 22. Thread auto-summary

| | |
|---|---|
| **Status** | ✅ Shipped (Aug 2026) |
| **Code** | `thread-summary-http.js`, `thread-summary.tsx` in chat, SDK `summarizeThread()` |
| **UX** | “Summarize this thread” on thread root — 3–5 bullet summary posted as ephemeral or pinned system message |
| **Why separate from #4** | Message-level vs thread-level; high perceived value, ~zero new infra |
| **Effort** | 3–5 days |

### 23. Rich link unfurling with AI extract

| | |
|---|---|
| **Status** | ✅ Shipped (Aug 2026) |
| **Code** | `rich-previews.js` (`generateAiLinkSummary`, D1 `ai_summary`), `LinkPreviewCard`, `getLinkPreview` in Room DO |
| **Effort** | 1 week |

---

## 🔴 Now — AI, voice & agents

### 9. Agent observability & eval (Langfuse)

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) |
| **Code** | `agent-eval.js`, `otel-export.js`, `/agents/eval`, `/agents/observability`, `POST /otel/configs/langfuse` |
| **Features** | Langfuse OTLP one-click + queue flush; eval `expectedOutputContains` / `forbiddenOutputContains` on room messages |
| **Gap** | Langfuse OSS VPS deploy — see `docs/LANGFUSE_VPS_RUNBOOK.md` (ops) |
| **Effort** | OTel preset done; VPS is ops |

### 10. Voice turn detection (Silero VAD)

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) |
| **Code** | `silero-vad.ts` frame VAD + optional ONNX, PCM path in `voice-pipeline.ts`, `/voice-ai` toggle |
| **Gap** | Self-host ONNX: set `NEXT_PUBLIC_SILERO_VAD_WASM_URL` or SDK `onnxModelUrl` (documented in `/voice-ai`) |
| **Note** | Complements **`#12`** unified pipeline — VAD is endpointing, not the multimodal refactor |
| **Effort** | 1 week |

### 11. MCP marketplace audit

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) |
| **Code** | `.github/workflows/mcp-marketplace-audit.yml`, `marketplace-audit.js`, `0163_marketplace_audits.sql`, `/marketplace` MCP Apps tab |
| **Features** | CI mcp-audit scan → signed webhook → D1 → audit grade badge per app |
| **Gap** | None — Linear in CI + catalog |
| **Effort** | Done |

### 12. Unified voice pipeline (multimodal single call)

| | |
|---|---|
| **Status** | ✅ Shipped (Aug 2026) |
| **Code** | `voice-pipeline.ts` (`pipelineMode: unified \| legacy`), `voice-ai-pipeline.js`, `useVoice()` |
| **Default** | **Unified** — single `multimodal` stage (mic → multimodal → speaker) instead of asr → llm → tts |
| **Migration** | `pipelineMode: 'legacy'` preserves old stage breakdown for integrators |
| **UI** | `/voice-ai` — mode toggle + stage timeline in metrics |

### 26. Agent workspace live in chat (differentiation)

| | |
|---|---|
| **Status** | ✅ Shipped (Aug 2026) |
| **Code** | `packages/sdk/src/agent-workspace.ts`, `AgentWorkspacePanel` in `fluxychat.tsx` |
| **UX** | Live “Agent workspace” panel — timeline of tool steps, thinking/search states, visible to all room members via existing WS `tool_call`/`tool_result` events |
| **SDK** | `buildAgentWorkspaceSteps()`, `isAgentWorkspaceLive()`, `toolLabel()`, `toolCategory()` |
| **Next** | Wire custom AG-UI renderers per tool (`#5`) |

---

## 🟡 Next — Compliance, routing & protocols

### 14. Data residency & region pinning

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) |
| **Code** | `data-residency-settings.js`, `0170_project_data_residency.sql`, `/admin/data-residency`, `/settings/residency` |
| **Gap** | Multi-region D1/R2 replication (Cloudflare tier dependent) |
| **Pairs with** | `#19` ephemeral retention |
| **Effort** | 2–3 weeks |

### 19. Ephemeral messages & room retention policy

| | |
|---|---|
| **Status** | ✅ Shipped (Aug 2026) |
| **Code** | `message-retention-room.js`, `0166_room_message_retention.sql`, cron purge in `scheduled-runners.js`, `/settings/ephemeral` |
| **Use cases** | Health/legal “do not retain”; GDPR minimization; complements `#14` residency (store in EU *and* delete on schedule) |
| **Tool** | D1 + Worker cron only — $0 |
| **Effort** | 1–2 weeks |

### 20. Immutable audit log (WORM-style)

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) |
| **Code** | `audit-chain.js`, R2 export cron, `POST /admin/audit-chain/export-r2`, `/soc2/audit-chain` |
| **Gap** | R2 Object Lock bucket policy — ops; UI note on `/soc2/audit-chain` |
| **Use cases** | Enterprise/PA contracts, Matrix/gov federation story — prove history was not tampered |
| **Tool** | D1 append-only + R2 cold archive — $0 |
| **Effort** | 2 weeks |

### 21. Smart routing (presence + skill)

| | |
|---|---|
| **Status** | ✅ Shipped (Aug 2026) |
| **Code** | `support-routing.js`, `POST /rooms/:id/routing/suggest`, post-message `support_routing_suggestion` events |
| **Effort** | 1–2 weeks |

### 24. A2A protocol adapter (Agent2Agent)

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) |
| **Code** | `a2a-worker.js`, `0167_a2a_agent_tasks.sql`, `/a2a/*` routes, `/agents/a2a` dashboard |
| **Features** | HTTPS-only Agent Card fetch, SSRF blocks, remote task delegation (`delegateA2ATaskToRemote`), bearer auth |
| **Relation to AG-UI** | AG-UI = agent→user (`#5`); A2A = agent→agent — **complementary** |
| **Effort** | Done |

### 25. AP2 / UCP (evolution of x402)

| | |
|---|---|
| **Status** | ⚠️ **Research closed** — monitor spec; do not implement before x402 spike |
| **Context** | Universal Commerce Protocol + Agent Payments Protocol (Google) — cryptographic payment mandates for agentic commerce |
| **Relation to x402** | x402 = pay-per HTTP call (`#18`); AP2 = structured agent authorization for purchases |
| **User doc** | [Platform status — agent commerce](/docs/features/platform-status#agent-commerce--x402-18-and-ap2ucp-25) |
| **When** | If e-commerce / agent marketplace vertical accelerates — track alongside `#18`, not instead |
| **Effort** | Research only now |

### 18. x402 agent micropayments

| | |
|---|---|
| **Status** | ⚠️ **Research closed** — monitor Coinbase x402 / facilitator maturity |
| **Use case** | Pay-per-tool-call; agent wallet per tenant |
| **User doc** | [Platform status — agent commerce](/docs/features/platform-status#agent-commerce--x402-18-and-ap2ucp-25) |
| **Tool** | Coinbase x402 facilitator (self-host) |
| **Effort** | 4 weeks spike when spec stabilizes |

---

## 🟡 Next — Security, channels & voice

### 30. MLS group encryption

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) — coordination slice |
| **Code** | `mls-encryption.ts`, `room-mls-sync.ts`, `room-mls.js`, `/rooms/:id/mls-group`, `/settings/e2e` |
| **Features** | D1 registry + SDK `hydrateMlsManagerFromRegistry` / `importGroup`; client encrypt via SDK |
| **Gap** | Full OpenMLS WASM ratchet tree (crypto in Workers or browser WASM bundle) |
| **Effort** | Coordination done; full WASM 4–6 wk |

### 31. Post-quantum TLS

| | |
|---|---|
| **Status** | ✅ Edge (Cloudflare ML-KEM) + docs |
| **Action** | `/security` checklist + PQ panel; Cloudflare docs link |
| **Effort** | Done |

### 15. Accessibility (WCAG 2.2 AA)

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) |
| **Code** | `a11y.axe.spec.ts` (public), `a11y.admin.integrated.spec.ts` (admin with `E2E_ADMIN_JWT`) |
| **Effort** | Done |

### 16. Matrix federation bridge

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) |
| **Code** | `matrix-bridge.js`, `0180_matrix_appservice_token.sql`, outbound retry, health cron, `/bridges/matrix` |
| **Features** | Appservice webhook `POST /webhooks/matrix/:bridgeId` with Bearer token; rotate token in admin UI |
| **Gap** | Synapse deploy — see `docs/MATRIX_SYNAPSE_RUNBOOK.md` (ops) |
| **Pairs with** | `#20` immutable audit for gov/DMA narrative |
| **Effort** | Auth slice done; Synapse deploy is ops |

### 17. RCS (16th channel)

| | |
|---|---|
| **Status** | ⚠️ **Paid vendor** — scaffold + dry-run only until Twilio/MessageBird account |
| **Cost** | Twilio/MessageBird — paid aggregator |
| **User doc** | [Platform status — RCS](/docs/features/platform-status#rcs-17) · [Channel forms](/docs/features/channel-forms) |
| **Effort** | 2 weeks after vendor account |

### 27. Voice rooms — live translation with voice cloning

| | |
|---|---|
| **Status** | ⚠️ **Documented** — not on Workers; use standard [voice pipeline](/docs/guides/voice-ai-pipeline) today |
| **Problem** | Generic TTS translation sounds robotic; unified pipeline (`#12`) should output **cloned voice** in target language |
| **Zero-budget path** | OmniVoice Studio (Whisper + translate + zero-shot clone, self-host MIT) or Whisper + RVC (MIT) on VPS |
| **User doc** | [Platform status — voice clone](/docs/features/platform-status#vps--gpu--voice-clone-translation-27) |
| **Constraint** | **Not Workers-only** — needs GPU or strong CPU VPS; zero license cost |
| **Effort** | 3–5 weeks (after `#12`) when VPS path prioritized |

### 13. AI visual moderation in-stream

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) |
| **Code** | `visual-moderation.js`, post-message hook, `POST /api/live/events/:id/moderate-frame`, `/admin/visual-moderation/*` |
| **Design** | Vision LLM on image attachments + sampled stream frames; queues to `ai_moderation_queue`; `VISUAL_MODERATION_ENABLED=true` |
| **Vertical** | Stream / live shopping — complements MOQ/inventory/checkout |
| **Effort** | Done |

---

## 🟡 Next — Realtime hardening (from audit)

See [ROADMAP_REALTIME_FEATURES.md](../ROADMAP_REALTIME_FEATURES.md). Priority subset:

| Item | Status | Target |
|------|--------|--------|
| Session token refresh | ✅ Production | `scheduleSessionTokenRefresh`, `sessionTokenFingerprint` in `use-chat` / `room-session` |
| Idempotent send + retry UI | ✅ Production | `clientMessageId` preserved on retry; `pendingMessages` / `failedMessages` in `useChat` |
| Location privacy + TTL | ✅ Production | `location-privacy.ts`, publish + display redaction in `location-track` / `use-location` |
| Push subscribe race | ✅ Production | `use-web-push.ts` serializes subscribe/unsubscribe + rollback on register failure |
| Canonical stream parts | ✅ Production | `stream-parts-bridge.ts` — agent runtime ↔ AG-UI ↔ UIPart |
| A2A adapter | ✅ Production | `validateExternalHttpsUrl`, Agent Card fetch, `delegateA2ATaskToRemote` |

---

## 🟢 Later — Vertical platforms

Each vertical reuses Room DO + adapters + agent runtime. Optional packages, not core bloat.

### Stream / live shopping

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) — commerce + replay |
| **Code** | `live-stream-commerce.js`, `live-stream-stripe-checkout.js`, `live-stream-replay.js`, `cloudflare-stream.js`, stream demo + `/stream/[eventId]` |
| **Features** | MOQ/inventory, Stripe, VOD replay, multi-angle sync, **auto-provision CF live inputs** on reconcile-angles |
| **Gap** | None for replay slice |
| **+#13 Visual AI moderation in-stream** | ✅ Wired in stream demo → `POST /api/live/events/:id/moderate-frame` |
| **Effort** | Commerce slice done; replay 2–3 wk |

### Game / FluxyGame (NPC rooms)

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) — NPC + saves + tournaments |
| **Code** | `fluxy-game.js`, `game-npc.js`, `game-checkpoint.js`, `yjs-game-checkpoint.js`, `game-quest.js`, `game-tournament.js`, `/game` |
| **Features** | NPC rate limits, checkpoints + Yjs merge, **cross-room federate** (API + `/game` Quests tab), quests, tournaments |
| **Gap** | None for base game slice |
| **+#29 Bandwidth budgeting with AI-driven bots in CI** | ✅ `scripts/bandwidth-budget.mjs` + CI gate |
| **NPC rate limits** | ✅ `game-npc.js`, `POST /games/npcs/:id/interact`, D1 `game_npcs` |
| **Effort** | Base slice done |

### 29. Bandwidth budgeting — AI bot load in CI

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) |
| **Design** | `scripts/bandwidth-budget.mjs` simulates N bot payloads; measures UTF-8 bytes + fan-out; fails PR vs `bandwidth-budget.baseline.json` |
| **CI** | `pnpm run check:bandwidth-budget` in `.github/workflows/ci.yml` |
| **Effort** | Done |

### IoT / fleet predictive layer

| | |
|---|---|
| **Status** | 🟨 **Partial — documented** — location + FluxyTrack shipped; predictive layer not |
| **Code** | `use-location.ts`, geofencing SDK, [Platform IoT](/docs/platform/iot) |
| **User doc** | [Platform status — IoT](/docs/features/platform-status#partial--iot-fleet--spatial-29-adjacent) |
| **Effort** | 6–8 weeks for predictive tier |

### Spatial / digital twin

| | |
|---|---|
| **Status** | 🟨 Spatial audio docs |
| **Effort** | 8+ weeks |

### Edge / on-device AI

| | |
|---|---|
| **Use case** | PII never leaves device |
| **Tool** | Transformers.js WebGPU, Ollama tunnel |
| **Effort** | Q1 2027 research |

---

## ⚠️ Monitor — WebTransport (`#28`)

| | |
|---|---|
| **Status** | ⚠️ **Closed (monitor)** — do not implement for production in 2026 |
| **User doc** | [Platform status — WebTransport](/docs/features/platform-status#monitor-only--webtransport-28) |
| **Reality check** | Chrome/Edge support; Safari/Firefox lag; no production WebSocket-over-HTTP/3 (RFC 9220) servers widely deployed |
| **Recommendation** | WebSocket remains default transport; WebTransport as optional enhancement **2027+** when multi-browser + server maturity align |
| **Code note** | Docs may mention WebTransport aspiration — treat as monitor-only |
| **Action** | Quarterly browser/server capability review; no sprint allocation |

---

## Feature addition summary (research round 2)

| Feature | Market / rationale | Cost | Phase | Effort |
|---------|-------------------|------|-------|--------|
| Unified voice pipeline (`#12`) | Real latency for `useVoice` integrators | Free (Workers AI) | ✅ Production | Done |
| AI visual moderation in-stream (`#13`) | Stream safety, vision LLM on attachments + frames | Free | ✅ Production | Done |
| Bandwidth budgeting CI (`#29`) | FluxyGame scale guard | Free | ✅ Production | Done |
| Ephemeral messages + TTL (`#19`) | Health/legal compliance | Free | ✅ Production | Done |
| Immutable audit log (`#20`) | Enterprise/PA, Matrix/gov | Free | ✅ Production | Done |
| Smart routing presence+skill (`#21`) | Support rooms | Free | ✅ Production | Done |
| Thread auto-summary (`#22`) | UX quick win | Free | ✅ Production | Done |
| AI link unfurl (`#23`) | Modern chat feel | Free | ✅ Production | Done |
| A2A adapter (`#24`) | LF standard, agent federation | Free SDK | ✅ Production | Done |
| AP2/UCP (`#25`) | Agent commerce evolution | Free spec | 🟢 Research | — |
| Agent workspace live (`#26`) | **No competitor has it** | Free | ✅ Production | Done |
| Voice translation + clone (`#27`) | 2026 voice trend | VPS compute | 🟡 Next | 3–5 wk |
| WebTransport (`#28`) | Not production-ready | — | ⚠️ Monitor | — |

---

## Research round 3 — New features & enterprise parity (Aug 2026)

> Full technical specs (architecture, SQL, guardrails, phases, code touchpoints):
>
> | Document | Scope |
> |----------|-------|
> | [FLUXYCHAT-CROSS-ORG-AGENT-ROOMS-E-NUOVE-FEATURE.md](./FLUXYCHAT-CROSS-ORG-AGENT-ROOMS-E-NUOVE-FEATURE.md) | Moonshot #32 + ambient agents, stages, passkeys, catch-up, consent |
> | [FLUXYCHAT-COUNTERFACTUAL-DEBATE-EMPATHY.md](./FLUXYCHAT-COUNTERFACTUAL-DEBATE-EMPATHY.md) | #44 Counterfactual Replay, #45 Multi-Agent Debate, #46 Empathy Layer |
> | [FLUXYCHAT-ROOM-FIRMWARE-MERGE-SPECULATIVE.md](./FLUXYCHAT-ROOM-FIRMWARE-MERGE-SPECULATIVE.md) | #47 Room Firmware, #48 Merge-Conflict UI, #49 Speculative Warmup |
> | [FLUXYCHAT-TRUTHMARKET-REHEARSAL-QUORUM-CARTOGRAPHY.md](./FLUXYCHAT-TRUTHMARKET-REHEARSAL-QUORUM-CARTOGRAPHY.md) | #50–#53 Truth Market, Rehearsal, Quorum, Cartography |

### Executive — what this round adds

1. **Moonshot product:** Cross-Org Agent Rooms (#32) — agenti AI di org diverse in room neutra con escrow, audit bilaterale, gate umano.
2. **Differentiation UX:** Counterfactual Replay (#44), Multi-Agent Debate (#45), Chat Cartography (#53).
3. **Enterprise blockers:** SSO/SAML+SCIM (#54), moderation console (#57), guest anti-spam (#58).
4. **Quick wins:** Async Decision Quorum (#52), Smart catch-up (#33), Passkeys (#36), Scheduled send (#59).

**Recommended next sprint order:** #52 → #33 → #36 → #58 → #54 spike → #44 MVP → #32 MVP pilot.

---

### 🌙 Moonshot — Cross-Org Agent Rooms (`#32`)

| | |
|---|---|
| **Status** | ✅ MVP pilot (Aug 2026) — neutral host, agent cards, commitments, bilateral audit |
| **Pitch** | Room neutra/federata dove agenti AI di org diverse negoziano con identità verificabile (Agent Card A2A), escrow commitment, audit hash-chain bilaterale, E2EE opzionale, approvazione umana obbligatoria |
| **Why unique** | Realtime providers lack agent timeline; A2A providers lack persistent multi-tenant rooms + compliance UI — FluxyChat has both |
| **Architecture** | Org A/B `WorkflowAgent` ↔ Room DO (`cross_org`) ↔ Escrow DO (state machine) ↔ Audit hash-chain ↔ optional E2EE (`room-e2e.ts` / MLS) ↔ human approval via dashboard + push |
| **Agent Identity** | `packages/sdk/src/agent-identity.ts` (new) — ed25519 WebCrypto, `.well-known/fluxychat-agent-keys.json` |
| **Escrow states** | `proposed` → `countered` → `pending_human_a/b` → `committed` \| `expired` \| `rejected`; max negotiation rounds configurable |
| **Data model** | D1: `cross_org_rooms`, `commitments`, `cross_org_audit_log` (hash-linked entries) |
| **Threat model** | Spoofing → domain keys; loop DoS → rate limit + max rounds; repudiation → signed human timestamps + hash chain; leakage → E2EE; autonomous commit → server-side gate non-bypassable |
| **Phases** | MVP neutral host 3–4 wk → V1 E2EE+push 2–3 wk → V2 federation bridge+AP2 4–6 wk → V3 multi-org policy engine |
| **Touchpoint** | `a2a-worker.js`, `audit-chain.js`, `room-e2e.js`, Matrix bridge (#16), x402/AP2 (#18, #25) |
| **Effort** | 6–8 weeks MVP→V1; pilot with 1–2 design partners before commercial promise |
| **Priority** | 🟡 Next / moonshot 2027 differentiator |
| **Spec** | [FLUXYCHAT-CROSS-ORG-AGENT-ROOMS-E-NUOVE-FEATURE.md](./FLUXYCHAT-CROSS-ORG-AGENT-ROOMS-E-NUOVE-FEATURE.md) §1 |

---

### 🔴 Now — Chat core additions (research round 3)

#### 33. Smart catch-up digest

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) |
| **What** | "What did I miss since last visit" — relevance-ranked (mentions, threads, semantic topics), not pure chronological |
| **Architecture** | Last-read watermark per user+room → Vectorize/semantic filter (#1) → single Workers AI summarization on subset |
| **Tool** | Vectorize + Workers AI — $0 |
| **Touchpoint** | `smart-catch-up-digest.js`, `GET /rooms/:id/catch-up/digest`, `chat-catch-up-banner.tsx` |
| **Effort** | 3–5 days |
| **Priority** | 🔴 Now |

#### 34. Room sentiment dashboard (reactions + mood over time)

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) |
| **What** | Aggregate reaction sentiment + light message classifier → mood timeline for team leads / community managers |
| **Architecture** | On-demand: aggregate existing reactions → D1 time-series buckets → dashboard chart |
| **Tool** | Existing reactions — $0 |
| **UI** | `RoomSentimentPanel` on `/search` when room filter set |
| **Effort** | 3–5 days |
| **Priority** | 🔴 Now |

#### 35. Voice rooms multi-speaker ("Stages")

| | |
|---|---|
| **Status** | ✅ MVP (Aug 2026) — D1 `0186`, Room DO `stage_*` WS, VAD active speaker, `VoiceStagePanel` in chat |
| **What** | Discord Stages-style speaker/listener roles inside existing room + shared VAD for active speaker |
| **Architecture** | Room DO presence roles (`speaker` \| `listener`) + Silero VAD (#10) active-speaker events + client stage UI |
| **Touchpoint** | `room-do.js` presence, `silero-vad.ts`, `use-voice.ts` |
| **Effort** | 2–3 weeks |
| **Priority** | 🟡 Next |

#### 36. Passkeys / WebAuthn

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) |
| **What** | Passwordless login for dashboard and optionally chat embed |
| **Tool** | `@simplewebauthn/server` + `@simplewebauthn/browser` |
| **Architecture** | D1 `0182_webauthn_credentials.sql`, challenge store, register/login routes, JWT mint on `/webauthn/login/verify` |
| **UI** | `/settings/identity` — register/list/remove passkeys for admin JWT user |
| **Env** | `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN` |
| **Effort** | ~1 week |
| **Priority** | 🔴 Now |

#### 37. Local-first sync engine evaluation (ElectricSQL / PowerSync)

| | |
|---|---|
| **Status** | ✅ Research closed (Aug 2026) — **keep Yjs (#7)** |
| **What** | Evaluated ElectricSQL / PowerSync vs current Yjs + Room DO path |
| **Decision** | Stay on Yjs until Postgres-tier or merge-conflict rate forces re-eval |
| **Doc** | [LOCAL_FIRST_SYNC_EVAL.md](./LOCAL_FIRST_SYNC_EVAL.md) |
| **Priority** | ✅ Research |

#### 52. Async Decision Quorum

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) |
| **What** | Special `decision` message type — weighted role quorum (e.g. 2/3 approvers in 48h), binding acks, live progress bar |
| **Architecture** | Room DO tracks `decision_acks` server-side; states: `pending` → `decided` \| `expired_no_quorum`; expiry warning at 12h |
| **Data model** | D1 `message_decisions`, `message_decision_acks` — migration `0181` |
| **Guardrail** | Quorum verified **only server-side**; roles from existing room permissions; not bypassable client-side |
| **Touchpoint** | `message-decisions.js`, `decision.tsx`, `fluxychat.tsx` + menu |
| **Effort** | 1–2 weeks MVP |
| **Priority** | 🔴 Now |
| **Spec** | [FLUXYCHAT-TRUTHMARKET-REHEARSAL-QUORUM-CARTOGRAPHY.md](./FLUXYCHAT-TRUTHMARKET-REHEARSAL-QUORUM-CARTOGRAPHY.md) §3 |

#### 59. Scheduled message send

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) |
| **What** | Compose now, deliver at scheduled time (Slack/WhatsApp Business baseline) |
| **Architecture** | D1 `scheduled_messages` + `send_at` + Room DO expiry dispatch → normal send path |
| **UI** | Composer + menu → `ScheduleSend` panel; SDK `scheduleMessage` / `cancelScheduledMessage` |
| **Pairs with** | `#19` ephemeral / retention cron pattern |
| **Effort** | 3–5 days |
| **Priority** | 🟡 Next |

#### 60. Slash commands / bot command framework

| | |
|---|---|
| **Status** | ✅ Production MVP (Aug 2026) |
| **What** | Deterministic `/poll`, `/remind`, `/assign` — explicit developer primitive beyond NL agents |
| **Architecture** | Message prefix parser in Room DO + REST `/messages` → `room-command-dispatch.js` → registered handlers (built-in + tenant `room_commands`) → system/poll message |
| **Touchpoint** | `room-commands.js`, `commands-http.js`, `messages-http.js`, Room DO WS, `/settings/commands` |
| **Effort** | ~1 week |
| **Priority** | ✅ MVP |

---

### 🔴 Now — AI & agents additions (research round 3)

#### 38. Ambient agents (event-driven, proactive)

| | |
|---|---|
| **Status** | ✅ MVP (Aug 2026) — D1 `0187`, `ambient-agents.js`, keyword/webhook triggers, `/agents/ambient` |
| **What** | Agents react to external events (webhooks, D1 state, IoT) within policy bounds — not only `@mention` |
| **Architecture** | Webhook → Worker → Policy Engine (`agent_policies` D1: `{ trigger, max_autonomy }`) → WorkflowAgent → room post + audit |
| **Guardrail** | Scoped permissions, per-action audit, human escalation above risk threshold |
| **Effort** | 3–4 weeks |
| **Priority** | 🟡 Next |
| **Spec** | [FLUXYCHAT-CROSS-ORG-AGENT-ROOMS-E-NUOVE-FEATURE.md](./FLUXYCHAT-CROSS-ORG-AGENT-ROOMS-E-NUOVE-FEATURE.md) §2.1 |

#### 40. Eval prod→test loop (Braintrust pattern, self-hosted)

| | |
|---|---|
| **Status** | ✅ Production MVP (Aug 2026) |
| **What** | Failed prod agent run → auto-convert trace to eval test case in Langfuse/dataset |
| **Architecture** | Hook on `agent_run` failed status → extract room message snippet + tool trace → append to `agent_eval_datasets` |
| **Touchpoint** | `agent-eval.js` (`captureFailedAgentRunAsEvalCase`, `maybeAutoCaptureFailedAgentRun`), `POST /admin/agent-eval/from-run/:runId`, `/agents/eval` |
| **Env** | `AGENT_EVAL_AUTO_CAPTURE_FAILED=true` for automatic capture on invoke failure |
| **Tool** | Langfuse OSS — $0 |
| **Effort** | MVP shipped |
| **Priority** | 🟡 Next |

#### 44. Counterfactual Replay

| | |
|---|---|
| **Status** | ✅ Production MVP (Aug 2026) |
| **What** | Re-run agent tool_call with modified params; side-by-side original vs alternative |
| **Architecture** | "Try alternative" on tool call → `POST /rooms/:id/counterfactual` → re-execute via `tool_execute_url` |
| **Data model** | D1 `0183`: `agent_runs.branch_id`, `counterfactual_of`, `modified_params` |
| **Guardrail** | Max 1 nested level; side-effect tools forced dry-run |
| **UI** | `CounterfactualReplayPanel`, `CounterfactualCompare`, SDK `replayCounterfactual` |
| **Effort** | MVP shipped — V2 promote branch pending |
| **Priority** | 🟡 Next |
| **Spec** | [FLUXYCHAT-COUNTERFACTUAL-DEBATE-EMPATHY.md](./FLUXYCHAT-COUNTERFACTUAL-DEBATE-EMPATHY.md) §1 |

#### 45. Multi-Agent Debate UX

| | |
|---|---|
| **Status** | ✅ MVP (Aug 2026) — D1 `0185`, `agent-debate.js`, `agent_step` events, `/agents/debate`, `DebateThreadPanel` |
| **What** | Live visible debate between 2–3 perspective agents before moderator synthesizes final answer |
| **Architecture** | Orchestrator WorkflowAgent → `agent_step` events with `participant_role: "debate"` → grouped thread UI |
| **Data model** | D1 `debate_roles` (tenant trigger patterns + system prompts + max_rounds) |
| **Guardrail** | Max rounds (default 2); timeout → partial consensus; token cost telemetry |
| **Effort** | ~4 weeks MVP→V2 |
| **Priority** | 🟡 Next |
| **Spec** | [FLUXYCHAT-COUNTERFACTUAL-DEBATE-EMPATHY.md](./FLUXYCHAT-COUNTERFACTUAL-DEBATE-EMPATHY.md) §2 |

#### 46. Empathy Layer (voice prosody)

| | |
|---|---|
| **Status** | ✅ Production MVP (Aug 2026) |
| **What** | Detect frustration/stress from prosody (pitch, rate, pauses) — silently adapt agent tone/escalation |
| **Architecture** | Client `empathy-prosody.ts` → `POST /rooms/:id/empathy/signal` (KV TTL) → `agent-runtime.js` prompt suffix |
| **Guardrail** | Opt-in per room; no raw prosody persistence; low confidence → no action; never tell user they seem stressed |
| **Touchpoint** | `room-empathy.js`, `0197`, `/voice-ai` empathy panel, `use-empathy-prosody.ts` |
| **Effort** | MVP shipped (rule classifier + 4 states) |
| **Priority** | ✅ MVP |
| **Spec** | [FLUXYCHAT-COUNTERFACTUAL-DEBATE-EMPATHY.md](./FLUXYCHAT-COUNTERFACTUAL-DEBATE-EMPATHY.md) §3 |

#### 47. Room Firmware (programmable room behavior)

| | |
|---|---|
| **Status** | ✅ Production MVP (Aug 2026) |
| **What** | Per-room synchronous hooks intercept/veto/modify `message.create` before fan-out |
| **Architecture** | Builtin modules (`pii_veto`, `rate_limit`, `denylist`) in `room-firmware.js`; WASM type reserved (fail-open + audit) |
| **Use cases** | PII veto, custom rate limits, negotiation term caps |
| **Touchpoint** | `room_firmware` + `room_firmware_audit` (`0198`), `runRoomFirmwareHook` in messages + Room DO, `/settings/firmware` |
| **Effort** | MVP shipped (builtin veto-only; WASM runtime deferred) |
| **Priority** | ✅ MVP |
| **Spec** | [FLUXYCHAT-ROOM-FIRMWARE-MERGE-SPECULATIVE.md](./FLUXYCHAT-ROOM-FIRMWARE-MERGE-SPECULATIVE.md) §1 |

#### 48. Merge-Conflict UI (CRDT / federation)

| | |
|---|---|
| **Status** | ✅ Production MVP (Aug 2026) |
| **What** | When Yjs/federation produces true ambiguous conflict (same logical slot, different content), show git-style merge UI — not silent LWW |
| **Architecture** | `ConflictCandidate` detection in `message-crdt-yjs.ts` → two-column resolve (keep A / keep B / merge both) |
| **Touchpoint** | `message-merge-conflicts.js`, `0190`, `MergeConflictPanel`, `/rooms/:id/merge-conflicts` |
| **Effort** | MVP shipped — V2 configurable tenant thresholds |
| **Priority** | 🟡 Next |
| **Spec** | [FLUXYCHAT-ROOM-FIRMWARE-MERGE-SPECULATIVE.md](./FLUXYCHAT-ROOM-FIRMWARE-MERGE-SPECULATIVE.md) §2 |

#### 49. Typing-triggered speculative agent warmup

| | |
|---|---|
| **Status** | ✅ Production MVP (Aug 2026) |
| **What** | Room DO pre-fetches Vectorize context (and optionally predicts tool) while user types — lower latency on send |
| **Architecture** | Throttled typing WS → speculative retrieval only (never side-effects) → hit/miss telemetry |
| **Guardrail** | Min word threshold; no real tool execution; monitor hit rate to disable if ROI low |
| **Touchpoint** | `speculative-warmup.js`, `0191`, Room DO typing handler, `agent-runtime.js` consume |
| **Env** | `SPECULATIVE_WARMUP_ENABLED=true` (requires `SEMANTIC_SEARCH_ENABLED`) |
| **Effort** | MVP shipped |
| **Priority** | 🟡 Next |
| **Spec** | [FLUXYCHAT-ROOM-FIRMWARE-MERGE-SPECULATIVE.md](./FLUXYCHAT-ROOM-FIRMWARE-MERGE-SPECULATIVE.md) §3 |

#### 50. Truth Market (stake on AI claims)

| | |
|---|---|
| **Status** | ✅ Production MVP (Aug 2026) |
| **What** | Agent stakes correctness of verifiable claim; successful dispute transfers stake; per-claim not per-agent trust |
| **Architecture** | `truth_claims` + `truth_disputes` + `truth_credits`; MVP uses internal credits not real money |
| **Guardrail** | Min/max stake; verifiable claims only; human arbitration default; anti-spam disputes |
| **Touchpoint** | `truth-market.js`, `0196`, `/truth-market`, `POST /rooms/:id/truth-claims`, cron expiry |
| **Env** | `TRUTH_MARKET_MIN_STAKE`, `TRUTH_MARKET_MAX_STAKE`, `TRUTH_MARKET_INITIAL_CREDITS` |
| **Effort** | MVP shipped |
| **Priority** | ✅ MVP |
| **Spec** | [FLUXYCHAT-TRUTHMARKET-REHEARSAL-QUORUM-CARTOGRAPHY.md](./FLUXYCHAT-TRUTHMARKET-REHEARSAL-QUORUM-CARTOGRAPHY.md) §1 |

#### 51. Rehearsal Rooms

| | |
|---|---|
| **Status** | ✅ Production MVP (Aug 2026) |
| **What** | Ephemeral private room cloning real room context; agent simulates counterparty before high-stakes conversation |
| **Architecture** | Read-only snapshot → new Room DO `rehearsal-<id>` → TTL delete default |
| **Guardrail** | Only data user already authorized; explicit simulation disclaimer; no default persistence |
| **Touchpoint** | `rehearsal-rooms.js`, `0192`, `/agents/rehearsal`, agent-runtime counterparty prompt |
| **Effort** | MVP shipped |
| **Priority** | 🟡 Next |
| **Spec** | [FLUXYCHAT-TRUTHMARKET-REHEARSAL-QUORUM-CARTOGRAPHY.md](./FLUXYCHAT-TRUTHMARKET-REHEARSAL-QUORUM-CARTOGRAPHY.md) §2 |

#### 53. Chat Cartography

| | |
|---|---|
| **Status** | ✅ Production MVP (Aug 2026) |
| **What** | Zoomable map of room history — thematic clusters (embeddings) → drill-down to messages |
| **Honesty** | Concept precedents: MIT Conversation Map (1999), Cisco patent — **not** live embedding zoom in modern chat SDK |
| **Architecture** | Batch k-means on D1 embeddings → 2D coords cache → canvas blob map |
| **Touchpoint** | `chat-cartography.js`, `0193`, `/cartography`, `GET/POST /rooms/:id/cartography` |
| **Effort** | MVP shipped (zoom-out blobs) |
| **Priority** | 🟡 Next |
| **Spec** | [FLUXYCHAT-TRUTHMARKET-REHEARSAL-QUORUM-CARTOGRAPHY.md](./FLUXYCHAT-TRUTHMARKET-REHEARSAL-QUORUM-CARTOGRAPHY.md) §4 |

#### 42. Consent / DPA automation (EU tenants)

| | |
|---|---|
| **Status** | ✅ Production MVP (Aug 2026) |
| **What** | Auto consent banner + audit log for rooms with EU users; pairs with `#14` data residency |
| **Architecture** | Room member geo/tenant policy → show banner → log consent events in D1 |
| **Touchpoint** | `consent-dpa.js`, `0188`, `/settings/consent`, `EuConsentBanner` in chat |
| **Effort** | MVP shipped |
| **Priority** | 🟡 Next |

#### 43. WhatsApp / RCS structured forms (Flows-style)

| | |
|---|---|
| **Status** | ✅ Production MVP (Aug 2026) |
| **What** | Native structured forms on channels that support them (WhatsApp Business Flows, RCS) |
| **Architecture** | Form schema → WhatsApp interactive / RCS suggested replies → multi-step collect → normalized room message |
| **Touchpoint** | `channel-structured-forms.js`, `0189`, `/bridges/forms`, webhooks `/webhooks/channel-forms/*` |
| **Env** | `WHATSAPP_*`, `RCS_OUTBOUND_URL` or omnichannel `channel_configs.settings` |
| **Effort** | MVP shipped — Meta Flows ID optional for native Flow JSON |
| **Priority** | 🟡 Next |

---

### 🔴 Enterprise parity gaps (market standard — blocks sales)

> Features that mature platforms (Stream, Sendbird, PubNub, Twilio) already ship.
> Excludes items already in round 3 moonshot docs above.

#### 54. SSO / SAML / OIDC + SCIM for operator console

| | |
|---|---|
| **Status** | ✅ Production MVP (Aug 2026) |
| **What** | SAML IdP config, SCIM 2.0 tokens, passkeys — operator console identity |
| **Architecture** | `sso-saml.js`, `scim.js`, `identity-access-http.js`, D1 `0182` WebAuthn |
| **Touchpoint** | `/settings/identity` — SAML metadata, SCIM endpoints, passkey register |
| **Effort** | MVP shipped |
| **Priority** | ✅ MVP |

#### 55. Mobile SDK (React Native wrapper first)

| | |
|---|---|
| **Status** | ✅ Production MVP (Aug 2026) |
| **What** | `@fluxy-chat/react-native-sdk` — RN hooks over shared protocol + REST/WS client |
| **Package** | `packages/react-native-sdk` — `useFluxyChat`, `RealtimeProvider`, reconnect tests |
| **Effort** | MVP shipped |
| **Priority** | ✅ MVP |
| **Note** | Native Swift/Kotlin deferred; see PG-ZB-12 KMP in [ROADMAP.md](../ROADMAP.md) |

#### 56. Robust media pipeline (AV scan + thumbnails + transcode)

| | |
|---|---|
| **Status** | ✅ Production MVP (Aug 2026) |
| **What** | ClamAV async scan; image thumbnail jobs; configurable tenant size limits |
| **Architecture** | POST /upload → tenant limits → R2 → async scan/thumbnail job → block infected on message send |
| **Touchpoint** | `media-pipeline.js`, `0194`, `/settings/media`, `CLAMAV_HTTP_URL` optional |
| **Tool** | EICAR local block + optional ClamAV HTTP; R2 thumbnail passthrough MVP |
| **Effort** | MVP shipped |
| **Priority** | 🟡 Next |

#### 57. Full moderation console (queue workflow)

| | |
|---|---|
| **Status** | ✅ Production MVP (Aug 2026) |
| **What** | Pending reports queue, mute/ban/delete actions, moderator action history |
| **Architecture** | `moderation-queue.js` + `/moderation` dashboard (HITL bulk review, stats, history) |
| **Touchpoint** | `/moderation-queue/*`, `/moderation`, `ai_moderation_queue`, `moderation_events` |
| **Effort** | MVP shipped |
| **Priority** | 🟡 Next |

#### 58. Guest / embed anti-spam

| | |
|---|---|
| **Status** | ✅ Production MVP (Aug 2026) |
| **What** | IP rate limits, optional Cloudflare Turnstile on guest JWT mint, origin allowlist |
| **Architecture** | `public-guest-guard.js` → `POST /public/rooms/:id/guest-session`; `GET /public/guest-hardening` exposes site key + limits |
| **Env** | `PUBLIC_GUEST_TURNSTILE_REQUIRED`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY`, `RATE_LIMIT_PUBLIC_GUEST_PER_MINUTE` |
| **UI** | `/embed` live hardening badges; SDK `turnstileToken` on `joinPublicRoomAsGuest` |
| **Effort** | MVP shipped |
| **Priority** | ✅ MVP |

#### 61. Tenant usage / cost dashboard

| | |
|---|---|
| **Status** | ✅ Production MVP (Aug 2026) |
| **What** | Message volume, MAU, storage, estimated cost — standard SaaS transparency |
| **Architecture** | Aggregate D1 `project_usage_monthly`, messages, attachments, operational_metrics → `GET /admin/tenant-usage` → `/settings/usage` |
| **Touchpoint** | `tenant-usage.js`, `tenant-usage-http.js`, `/settings/usage` |
| **Env** | Optional `USAGE_COST_PER_1K_MESSAGES_USD`, `USAGE_COST_PER_AGENT_INVOKE_USD`, `USAGE_COST_PER_GB_STORAGE_USD` |
| **Effort** | 1–2 weeks |
| **Priority** | ✅ MVP |

#### 62. Public status page

| | |
|---|---|
| **Status** | ✅ Production (Aug 2026) — config validated in CI; deploy Upptime repo + DNS |
| **What** | Public uptime/SLA history — enterprise expectation pre-contract |
| **Tool** | Upptime (MIT, GitHub Actions + Pages) or Gatus (MIT self-host) |
| **Files** | `.upptime/config.json`, `pnpm check:upptime`, `/settings/status`, `docs/STATUS_PAGE_UPPTIME.md` |
| **Effort** | MVP shipped (external repo deploy is ops step) |
| **Priority** | ✅ MVP |
| **Note** | ROADMAP mentions Uptime Kuma — align with Upptime for zero-cost public page |

---

### Research round 3 — Master priority table

| ID | Feature | Priority | Effort | Status |
|----|---------|----------|--------|--------|
| 32 | Cross-Org Agent Rooms | 🟡 Moonshot | 6–8 wk | ✅ MVP pilot |
| 33 | Smart catch-up digest | 🔴 Now | 3–5 d | ✅ |
| 34 | Room sentiment dashboard | 🔴 Now | 3–5 d | ✅ |
| 35 | Voice stages | 🟡 Next | 2–3 wk | ✅ MVP |
| 36 | Passkeys / WebAuthn | 🔴 Now | 1 wk | ✅ |
| 37 | Local-first engine eval | 🟢 Research | — | ✅ |
| 38 | Ambient agents | 🟡 Next | 3–4 wk | ✅ MVP |
| 40 | Eval prod→test loop | ✅ MVP | 2 wk | ✅ |
| 42 | EU consent/DPA | ✅ MVP | 3–5 d | ✅ |
| 43 | WhatsApp/RCS forms | ✅ MVP | 2 wk | ✅ |
| 44 | Counterfactual Replay | 🟡 Next | 4 wk | ✅ MVP |
| 45 | Multi-Agent Debate UX | 🟡 Next | 4 wk | ✅ MVP |
| 46 | Empathy Layer (voice) | ✅ MVP | 4+ wk | ✅ |
| 47 | Room Firmware | 🟢 Later | 3–4 wk MVP | ✅ |
| 48 | Merge-Conflict UI | ✅ MVP | 2–3 wk | ✅ |
| 49 | Speculative agent warmup | ✅ MVP | 2–3 wk | ✅ |
| 50 | Truth Market | ✅ MVP | 2–3 wk | ✅ |
| 51 | Rehearsal Rooms | ✅ MVP | 2–3 wk | ✅ |
| 52 | Async Decision Quorum | 🔴 Now | 1–2 wk | ✅ |
| 53 | Chat Cartography | ✅ MVP | 2–3 wk | ✅ |
| 54 | SSO/SAML + SCIM console | 🔴 Now | 3–4 wk | ✅ |
| 55 | Mobile SDK (RN wrapper) | 🟢 Later | 1–2 wk | ✅ |
| 56 | Media pipeline AV/thumb | ✅ MVP | 2 wk | ✅ |
| 57 | Moderation console | ✅ MVP | 2–3 wk | ✅ |
| 58 | Guest anti-spam | 🔴 Now | 3–5 d | ✅ |
| 59 | Scheduled send | 🟡 Next | 3–5 d | ✅ |
| 60 | Slash commands | ✅ MVP | 1 wk | ✅ |
| 61 | Usage/cost dashboard | ✅ MVP | 1–2 wk | ✅ |
| 62 | Public status page | 🔴 Now | 2–3 d | ✅ |

---

## Omnichannel adapter inventory

**15 adapters today** (`apps/worker/src/lib/cross-platform.js`):

`slack`, `teams`, `discord`, `telegram`, `whatsapp`, `google-chat`, `github`, `linear`, `matrix`, `resend`, `irc`, `twitch`, `line`, `api` (+ `web` native).

| # | Channel | Status | Next step |
|---|---------|--------|-----------|
| 1–14 | Above | 🟨 Stubs → production webhooks | OAuth + signature verify per vendor — see [Platform status](/docs/features/platform-status#partial--omnichannel-adapters-slack-teams-discord-) |
| 15 | `web` | ✅ | — |
| 16 | **RCS** | ⚠️ Paid vendor | [Channel forms](/docs/features/channel-forms) + `RCS_OUTBOUND_URL` |

Adapter contract: `adapter.js` (`BaseAdapter`).

---

## Code ↔ feature quick reference

| Feature | Primary paths |
|---------|----------------|
| Semantic search | `message-embeddings.js`, `search-http.js` |
| Branch/retry | `message-branch.js`, `messages-http.js` |
| Web search | `web-search.js`, `agent-runtime.js` |
| Translation / summary | `message-translation.js`, post-automations |
| Thread summary | D1 threads + same AI path as `#4` |
| Link preview + AI | `link-preview.ts`, `rich-previews-http.js` |
| Generative UI / AG-UI | `generative-ui.ts` |
| Agent workspace | Room DO events + generative UI renderers |
| Unified voice | `use-voice.ts`, `voice-ai-pipeline.js` |
| Voice VAD | `voice-turn-detection.ts` |
| Voice clone translate | VPS pipeline (post-`#12`) |
| Visual moderation | Workers AI + stream frame hook |
| E2E | `room-e2e.ts`, `room-e2e.js` |
| MLS | `mls-encryption.ts` |
| CRDT/Yjs | `crdt.ts`, `yjs-sync.js` |
| AI text moderation | `ai-moderation.js`, `ai-moderation-http.js` |
| Ephemeral / retention | Room settings + D1 cron (new) |
| Audit WORM | Extend `audit-log-export.js`, hash chain table |
| Smart routing | Room DO presence + skill tags |
| A2A | New agent adapter (LF SDK) |
| OTel/Langfuse | `otel-export.js`, `telemetry.ts` |
| Data residency | `data-residency.ts` |
| Federation | `federation-bridge.ts`, Matrix adapter |
| MCP audit | `mcp-marketplace-audit.yml` |
| A11y | `a11y.axe.spec.ts` + `a11y.admin.integrated.spec.ts` |
| Bandwidth CI | `scripts/bandwidth-budget.mjs`, CI gate |
| WebTransport | Monitor only — existing WS transport |
| Cross-Org Agent Rooms (#32) | `agent-identity.ts` (new), Escrow DO, `cross_org_audit_log`, `a2a-worker.js` |
| Smart catch-up (#33) | `message-embeddings.js`, `search-enhancements.js`, post-automations |
| Room sentiment (#34) | Reactions aggregate + Workers AI sentiment cron |
| Voice stages (#35) | `room-do.js` presence roles, `silero-vad.ts`, `use-voice.ts` |
| Passkeys (#36) | `@simplewebauthn/server`, D1 `webauthn_credentials` |
| Ambient agents (#38) | `agent_policies` D1, webhook routes, `WorkflowAgent` |
| Eval prod→test (#40) | `agent-eval.js`, `otel-export.js`, `/agents/eval` |
| Counterfactual (#44) | `message-branch.js`, `agent_runs` extensions, `fluxychat.tsx` |
| Multi-Agent Debate (#45) | `debate_roles` D1, `agent_step` events, `generative-ui.ts` |
| Empathy Layer (#46) | Client prosody DSP, `voice-turn-detection.ts`, `WorkflowAgent` prompts |
| Room Firmware (#47) | `room-firmware.js`, `0198`, `/settings/firmware`, builtin hooks + audit |
| Merge-Conflict UI (#48) | `message-merge-conflicts.js`, `0190`, `MergeConflictPanel` |
| Speculative warmup (#49) | `speculative-warmup.js`, `0191`, Room DO typing handler |
| Truth Market (#50) | `truth-market.js`, `0196`, `/truth-market` |
| Rehearsal Rooms (#51) | `rehearsal-rooms.js`, `0192`, `/agents/rehearsal` |
| Decision Quorum (#52) | `message-decisions.js`, `0181`, `DecisionView` in chat |
| Chat Cartography (#53) | `chat-cartography.js`, `0193`, `/cartography` |
| SSO/SAML (#54) | `sso-saml.js`, `scim.js`, `/settings/identity` |
| Mobile SDK (#55) | `packages/react-native-sdk` |
| Media pipeline (#56) | `media-pipeline.js`, `0194`, `/settings/media` |
| Moderation console (#57) | `moderation-queue.js`, `/moderation` |
| Guest anti-spam (#58) | `public-guest-guard.js`, `GET /public/guest-hardening`, `/embed` |
| Scheduled send (#59) | `scheduled_messages` D1, `ScheduleSend` in composer |
| Slash commands (#60) | `room-command-dispatch.js`, `0195`, `/settings/commands` |
| Usage dashboard (#61) | `tenant-usage.js`, `/settings/usage` |
| Status page (#62) | `.upptime/config.json`, `pnpm check:upptime`, `/settings/status` |

---

## Sprint checklist template

For each 🔴 item before marking done:

- [ ] Feature flag or tenant setting in D1
- [ ] Worker route + tests
- [ ] SDK method + types exported from `packages/sdk/src/index.ts`
- [ ] Dashboard or chat widget UI (testable without curl)
- [ ] Docs MDX under `apps/docs/content/docs/`
- [ ] No secrets in repo; `.dev.vars.example` updated
- [ ] axe/Playwright smoke if UI touched

---

## Related documents

| Document | Scope |
|----------|-------|
| [ROADMAP.md](../ROADMAP.md) | Business phases, Portal gap, marketing |
| [ROADMAP_REALTIME_FEATURES.md](../ROADMAP_REALTIME_FEATURES.md) | AI SDK parity, realtime audit |
| [docs/PORTAL-ZERO-BUDGET-ROADMAP.md](./PORTAL-ZERO-BUDGET-ROADMAP.md) | Portal parity packaging |
| [docs/observability-otel.md](./observability-otel.md) | Langfuse/Jaeger wiring |
| [docs/FLUXYCHAT-CROSS-ORG-AGENT-ROOMS-E-NUOVE-FEATURE.md](./FLUXYCHAT-CROSS-ORG-AGENT-ROOMS-E-NUOVE-FEATURE.md) | Moonshot #32 + round-3 chat/AI specs |
| [docs/FLUXYCHAT-COUNTERFACTUAL-DEBATE-EMPATHY.md](./FLUXYCHAT-COUNTERFACTUAL-DEBATE-EMPATHY.md) | #44–#46 differentiation UX |
| [docs/FLUXYCHAT-ROOM-FIRMWARE-MERGE-SPECULATIVE.md](./FLUXYCHAT-ROOM-FIRMWARE-MERGE-SPECULATIVE.md) | #47–#49 speculative infra |
| [docs/FLUXYCHAT-TRUTHMARKET-REHEARSAL-QUORUM-CARTOGRAPHY.md](./FLUXYCHAT-TRUTHMARKET-REHEARSAL-QUORUM-CARTOGRAPHY.md) | #50–#53 + #52 quorum detail |
| [apps/docs/content/docs/BEAT-PORTAL-ROADMAP.mdx](../apps/docs/content/docs/BEAT-PORTAL-ROADMAP.mdx) | MD-* milestone tracker |
| [User feature docs](../apps/docs/content/docs/features/features-overview.mdx) | Round 3 capabilities in Fumadocs |
| [Optional external integrations](../apps/docs/content/docs/guides/ecosystem/optional-integrations.mdx) | Langfuse, Turnstile, Upptime, Matrix, WhatsApp |

---

*Last updated: 2026-08-03 (research round 3 — Cross-Org Agent Rooms moonshot, counterfactual/debate/empathy, firmware/merge/speculative warmup, truth market/rehearsal/quorum/cartography, enterprise parity gaps #54–#62).*
