# FluxyChat Gap Analysis 2026

> Data: 2026-07-16 | Fonti: Vercel AI SDK v7 docs, Vercel Chat SDK, Ably, PubNub, Sendbird, Stream, Liveblocks, Matrix, LiveKit, Daily.co

## Categorie gap

| # | Categoria | Gap totali | Critici | Alta prioritÃ  | Media prioritÃ  | Bassa prioritÃ  |
|---|---|---|---|---|---|---|
| A | AI/Agent Core | 18 | 4 | 6 | 6 | 2 |
| B | Chat Product Surface | 22 | 2 | 8 | 9 | 3 |
| C | Realtime Infrastructure | 12 | 2 | 5 | 3 | 2 |
| D | Voice/Video/Media | 10 | 2 | 3 | 3 | 2 |
| E | Enterprise/Security | 14 | 1 | 5 | 6 | 2 |
| F | Developer Experience | 10 | 1 | 3 | 4 | 2 |
| G | Integration/Ecosystem | 14 | 2 | 6 | 4 | 2 |
| H | Emerging/Market Trends | 10 | 1 | 4 | 3 | 2 |

**Totale: 110 gap identificati**

---

## A. AI/Agent Core (18 gap)

### Critical
1. **A-1: Unified reasoning parameter** — Vercel ha `reasoning` param portabile cross-provider (effort, budget tokens, summary). Noi abbiamo solo temp/max_tokens. [ai-sdk.dev/docs/ai-sdk-core/reasoning](https://ai-sdk.dev/docs/ai-sdk-core/reasoning)
2. **A-2: Memory system for agents** — Vercel ha provider memory tools (Anthropic memory, Letta, Mem0, Supermemory, Hindsight, MongoDB). Noi non abbiamo nessun memory system. [ai-sdk.dev/docs/agents/memory](https://ai-sdk.dev/docs/agents/memory)
3. **A-3: Tool approval flow with HMAC** — Vercel ha `toolApproval` con HMAC-signed, per-tool map, per-input function, integrate con `useChat` + `addToolApprovalResponse`. [ai-sdk.dev/docs/agents/tool-approvals](https://ai-sdk.dev/docs/agents/tool-approvals)
4. **A-4: Lifecycle callbacks sistematici** — `onStart`, `onStepStart`, `onLanguageModelCallStart/End`, `onToolExecutionStart/End`, `onStepEnd`, `onEnd` su generateText/streamText/ToolLoopAgent. [ai-sdk.dev/docs/ai-sdk-core/lifecycle-callbacks](https://ai-sdk.dev/docs/ai-sdk-core/lifecycle-callbacks)

### High
5. **A-5: prepareStep callback** — Modifica dinamica di model/tools/prompt/sandbox per step. [ai-sdk.dev/docs/agents/loop-control](https://ai-sdk.dev/docs/agents/loop-control)
6. **A-6: pruneMessages context compaction** — Compatta history messaggi oltre soglia. [ai-sdk.dev/docs/agents/loop-control](https://ai-sdk.dev/docs/agents/loop-control)
7. **A-7: Subagent delegation pattern** — Parent delega a subagenti via tool con context isolation, `toModelOutput`, `readUIMessageStream`. [ai-sdk.dev/docs/agents/subagents](https://ai-sdk.dev/docs/agents/subagents)
8. **A-8: Language model middleware** — `wrapLanguageModel`/`wrapImageModel`, middleware built-in (extractReasoning, simulateStreaming, defaultSettings, addToolInputExamples, extractJson). [ai-sdk.dev/docs/ai-sdk-core/middleware](https://ai-sdk.dev/docs/ai-sdk-core/middleware)
9. **A-9: Stream transformations** — `experimental_transform`, `smoothStream` (word/custom delay), custom transform, merge streams. [ai-sdk.dev/docs/ai-sdk-core/generating-text](https://ai-sdk.dev/docs/ai-sdk-core/generating-text)
10. **A-10: Runtime/Tool context separation** — `runtimeContext` (shared agent state) vs `toolsContext` (per-tool validated context). [ai-sdk.dev/docs/ai-sdk-core/runtime-and-tool-context](https://ai-sdk.dev/docs/ai-sdk-core/runtime-and-tool-context)

### Medium
11. **A-11: Provider options passthrough** — Namespaced provider-specific config (`providerOptions`) per OpenAI reasoning/Anthropic thinking/speed. [ai-sdk.dev/docs/foundations/provider-options](https://ai-sdk.dev/docs/foundations/provider-options)
12. **A-12: Provider registry tipizzato** — `createProviderRegistry`, `customProvider`, string model ID resolution. [ai-sdk.dev/docs/ai-sdk-core/provider-management](https://ai-sdk.dev/docs/ai-sdk-core/provider-management)
13. **A-13: Provider-defined tools** — Model-trained schemas with execute fallback (web search, code exec). [ai-sdk.dev/docs/foundations/tools](https://ai-sdk.dev/docs/foundations/tools)
14. **A-14: Provider-executed tools** — Run on provider servers (vs local exec). [ai-sdk.dev/docs/foundations/tools](https://ai-sdk.dev/docs/foundations/tools)
15. **A-15: Tool input refinement** — Trasformazione tipata post-parse/pre-execute con audit. [ai-sdk.dev/docs/foundations/tools](https://ai-sdk.dev/docs/foundations/tools)
16. **A-16: Simulate streaming middleware** — Trasforma response non-stream in chunk deterministici per test. [ai-sdk.dev/docs/ai-sdk-core/testing](https://ai-sdk.dev/docs/ai-sdk-core/testing)

### Low
17. **A-17: Skill uploads** — `uploadSkill` per pre-trained capabilities (computer use, code exec). [ai-sdk.dev/docs/ai-sdk-core/skill-uploads](https://ai-sdk.dev/docs/ai-sdk-core/skill-uploads)
18. **A-18: HarnessAgent** — Wrapper per agent esterni (Claude Code, Codex, Pi, OpenCode). [ai-sdk.dev/docs/ai-sdk-harnesses/overview](https://ai-sdk.dev/docs/ai-sdk-harnesses/overview)

---

## B. Chat Product Surface (22 gap)

### Critical
1. **B-1: Rich interactive cards + actions** — `Card`, `Button`, `Actions`, `Select`, `Table`, `Chart`, `Image` nativi per piattaforma. Senza questo i bot sono solo testo. [chat-sdk.dev/docs/cards](https://chat-sdk.dev/docs/cards)
2. **B-2: Message-to-LLM converter** — `toAiMessages()` converte messaggi chat in `{role, content}[]` con attachment handling per AI SDK. [chat-sdk.dev/docs/ai/to-ai-messages](https://chat-sdk.dev/docs/ai/to-ai-messages)

### High
3. **B-3: AI SDK tools per chat** — `createChatTools` espone operazioni chat (post, DM, react, edit, subscribe) come AI SDK tools con preset reader/messenger/moderator. [chat-sdk.dev/docs/ai/ai-sdk-tools](https://chat-sdk.dev/docs/ai/ai-sdk-tools)
4. **B-4: Concurrency strategies** — drop/queue/debounce/burst/concurrent per messaggi sovrapposti. Critico per bot AI. [chat-sdk.dev/docs/concurrency](https://chat-sdk.dev/docs/concurrency)
5. **B-5: Per-thread typed state** — `thread.state`/`setState()` con TTL per contesto multi-turn agent. [chat-sdk.dev/docs/threads-messages-channels](https://chat-sdk.dev/docs/threads-messages-channels)
6. **B-6: SentMessage chainable** — `sent.edit()`, `sent.delete()`, `sent.addReaction()`, `sent.removeReaction()`. [chat-sdk.dev/docs/threads-messages-channels](https://chat-sdk.dev/docs/threads-messages-channels)
7. **B-7: Conversation history/transcripts** — `bot.transcripts.append()/list()/delete()` con retention configurabile. [chat-sdk.dev/docs/conversation-history](https://chat-sdk.dev/docs/conversation-history)
8. **B-8: AST markdown system** — mdast builder (`root`, `paragraph`, `text`, `strong`, `link`) con `parseMarkdown()`/`stringifyMarkdown()`. [chat-sdk.dev/docs/api/markdown](https://chat-sdk.dev/docs/api/markdown)
9. **B-9: Scheduled messages** — `thread.schedule()`/`channel.schedule()` con `cancel()`. GiÃ  abbiamo API REST ma manca pattern client. [chat-sdk.dev/docs/threads-messages-channels](https://chat-sdk.dev/docs/threads-messages-channels)
10. **B-10: Ephemeral messages** — `thread.postEphemeral()` visibile solo a un utente, con DM fallback. [chat-sdk.dev/docs/ephemeral-messages](https://chat-sdk.dev/docs/ephemeral-messages)

### Medium
11. **B-11: Generative UI** — Tool-name-prefixed parts per React components. [ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces)
12. **B-12: Message serialization** — `message.toJSON()`/`Message.fromJSON()` per workflow/persistence. [chat-sdk.dev/docs/api/message](https://chat-sdk.dev/docs/api/message)
13. **B-13: User lookup API** — `bot.getUser(userId)` con email, avatar, fullName. [chat-sdk.dev/docs/api/chat](https://chat-sdk.dev/docs/api/chat)
14. **B-14: Regex message matching** — `bot.onNewMessage(/pattern/, handler)` per trigger keyword senza @-mention. [chat-sdk.dev/docs/handling-events](https://chat-sdk.dev/docs/handling-events)
15. **B-15: Slash commands** — `bot.onSlashCommand("/cmd", handler)` con registr Try. [chat-sdk.dev/docs/slash-commands](https://chat-sdk.dev/docs/slash-commands)
16. **B-16: Modals/forms system** — `Modal` con `TextInput`, `Select`, `ExternalSelect`, validazione. [chat-sdk.dev/docs/modals](https://chat-sdk.dev/docs/modals)
17. **B-17: Typed file attachments** — `Attachment[]` outgoing con type discrimination, `fetchData()` incoming. [chat-sdk.dev/docs/files](https://chat-sdk.dev/docs/files)
18. **B-18: Streaming enhancements** — `StreamChunk` types, `Plan`, `StreamingPlan`, markdown healing, table buffering. [chat-sdk.dev/docs/streaming](https://chat-sdk.dev/docs/streaming)

### Low
19. **B-19: Emoji system** — Type-safe cross-platform emoji con `emoji.*`, `createEmoji()`. [chat-sdk.dev/docs/emoji](https://chat-sdk.dev/docs/emoji)
20. **B-20: Link preview** — `message.links` con `LinkPreview.fetchMessage()`. [chat-sdk.dev/docs/api/message](https://chat-sdk.dev/docs/api/message)
21. **B-21: Message subject** — Parent resource (GitHub issue, Linear issue) context. [chat-sdk.dev/docs/subject](https://chat-sdk.dev/docs/subject)
22. **B-22: Gamification** — XP, badges, leaderboards per engagement.

---

## C. Realtime Infrastructure (12 gap)

### Critical
1. **C-1: Durable AI Transport** — Ably AI Transport: resilient AI sessions che sopravvivono a disconnect/device switch con offset continuity. [ably.com](https://ably.com)
2. **C-2: Collaborative editing (CRDT)** — Liveblocks-style: JSON Patch/CRDT per documenti condivisi, awareness, snapshots. [liveblocks.io](https://liveblocks.io)

### High
3. **C-3: Broadcast/campaign messaging** — Send scheduled broadcasts a utenti/segmenti con delivery tracking.
4. **C-4: Adaptive transport health-based** — WebSocket/SSE/long-poll fallback automatico senza duplicazione eventi.
5. **C-5: WebTransport adapter** — HTTP/3 bidirectional streams/datagrams con capability negotiation e fallback WebSocket/SSE.
6. **C-6: Regional failover** — Reconnect cross-region, cursor continuity, no split-brain. [ably.com](https://ably.com)

### Medium
7. **C-7: Per-room sequencing server-authoritative** — Gap detection, cursor catch-up, ordering test multi-connection.
8. **C-8: Delivery semantics granulari** — At-least-once, idempotency key, dedup persistente, receipt accepted/persisted/delivered/read.
9. **C-9: Chat platform adapters aggiuntivi** — WhatsApp Business, Telegram, Line, Viber, iMessage, Messenger (alcuni solo stub).

### Low
10. **C-10: Spatial copresence** — Digital-twin rooms con shared state opzionale.
11. **C-11: MCP protocol negotiation** — Versione negoziata, fallback Streamable HTTP â†' SSE.
12. **C-12: Decentralized relay** — P2P relay per ridurre latenza in reti edge.

---

## D. Voice/Video/Media (10 gap)

### Critical
1. **D-1: Voice AI pipeline end-to-end** — Streaming speech-to-speech (micâ†'ASRâ†'LLMâ†'TTSâ†'speaker) con sub-300ms latenza. OpenAI Advanced Voice, Gemini 2.5 Live, LiveKit. [livekit.io/cloud](https://livekit.io/cloud)
2. **D-2: Time-to-first-audio SLO tracking** — Span metrics per ogni fase (mic, ASR, LLM, TTS, speaker) con p95 target.

### High
3. **D-3: Noise/echo handling** — AEC, noise suppression, gain control, device diagnostics. [daily.co](https://daily.co)
4. **D-4: Voice quality dashboard** — TTFA, ASR WER proxy, EOT delay, interruption precision, jitter/loss, device breakdown.
5. **D-5: Turn detection layer VAD + semantic** — Energy gate + semantic turn model, dynamic endpointing, false-cut/latency metrics.

### Medium
6. **D-6: Prosody/emotion controls** — Normalized style/rate/pitch, provider fallback, safety boundaries.
7. **D-7: Speaker diarization** — Speaker IDs stabili, overlap speech, correction UI, consent policy.
8. **D-8: Call QA intelligence** — Topic/outcome/sentiment/compliance score con evidence spans e human review.

### Low
9. **D-9: Huddles/audio-video rooms** — WebRTC room con screen share, captions, recording consent.
10. **D-10: Video generation progress** — Polling/progress, cancel, output assets (Vercel ha `experimental_generateVideo`).

---

## E. Enterprise/Security (14 gap)

### Critical
1. **E-1: E2EE groups (MLS)** — End-to-end encryption per gruppi con MLS protocol, multi-device key rotation, recovery.

### High
2. **E-2: AI governance** — Model/prompt/tool registry, risk tier, evaluations, approvals, evidence export.
3. **E-3: eDiscovery/legal hold** — Immutable hold, scoped export, chain of custody, audit verificabile.
4. **E-4: DLP PHI/PCI detection** — PHI e PCI su text/file/audio, policy versioning, block/redact/quarantine.
5. **E-5: Customer-managed keys (CMK)** — Envelope encryption, rotation, revocation, tenant-isolated KMS audit.
6. **E-6: Data residency/sovereignty** — Region pinning per tenant, subprocessors, backup, inference routing coerenti.

### Medium
7. **E-7: Policy-based approvals (OPA)** — Open Policy Agent rules (.rego) con WASM/HTTP, shadow mode, transitive enforcement.
8. **E-8: MCP server identity/instructions** — `serverInfo`, instructions, server name con provenance nelle tool parts.
9. **E-9: Bot protection/anti-abuse** — Device/user/tenant rate limits, raid mode, trust score, false-positive review.
10. **E-10: Session replay privacy-safe** — Event timeline redatta, consent/retention, deterministic protocol replay.
11. **E-11: Federation interoperability** — Matrix/ActivityPub/DM bridges con compliance EU DMA.

### Low
12. **E-12: Feature flags management** — Tenant rollout, kill switch, holdout, metric guardrails.
13. **E-13: Sandboxed tool execution** — Isolated session per run, filesystem/network policy, quotas, timeout.
14. **E-14: Generative UI sandbox** — Componenti/tool UI non fidati in iframe isolato, CSP, capability grants.

---

## F. Developer Experience (10 gap)

### Critical
1. **F-1: Testing utilities** — Mock adapters, mock chat, mock state, Vitest custom matchers (`toHavePosted`, `toHaveEdited`, ecc.). [chat-sdk.dev/docs/testing](https://chat-sdk.dev/docs/testing)

### High
2. **F-2: Error hierarchy tipizzata** — `ChatError` con `code`, `RateLimitError` con `retryAfterMs`, `NotImplementedError`, `LockError`. [chat-sdk.dev/docs/error-handling](https://chat-sdk.dev/docs/error-handling)
3. **F-3: Telemetry/OpenTelemetry** — `registerTelemetry` per Arize, Axiom, Braintrust, Confident AI, Helicone, Laminar, Langfuse, LangSmith, LangWatch. [ai-sdk.dev/docs/ai-sdk-core/telemetry](https://ai-sdk.dev/docs/ai-sdk-core/telemetry)
4. **F-4: DevTools local inspector** — Web UI locale per ispezionare LLM calls, tool calls, token usage, multi-step. [ai-sdk.dev/docs/ai-sdk-core/devtools](https://ai-sdk.dev/docs/ai-sdk-core/devtools)

### Medium
5. **F-5: AI SDK skill per coding agents** — Skill per Claude Code/Codex/O = testo completo docs per contesto agent.
6. **F-6: Call options schema** — `callOptionsSchema` + `prepareCall` pattern per configurazione tipo-safe runtime. [ai-sdk.dev/docs/agents/configuring-call-options](https://ai-sdk.dev/docs/agents/configuring-call-options)
7. **F-7: Dynamic tools runtime** — `dynamicTool()` con name/description/schema in runtime con type narrowing. [ai-sdk.dev/docs/foundations/tools](https://ai-sdk.dev/docs/foundations/tools)
8. **F-8: Deterministic test models** — Scripted output/chunks/tools/errors/usage per test. (Parziale: `DeterministicLanguageModel` esiste ma non come standalone).

### Low
9. **F-9: Stream fixtures** — Malformed, split UTF-8, abort, provider error, reconnect fixture set.
10. **F-10: API report/test** -- Stabile exports map, no accidental internals, API report test.

---

## G. Integration/Ecosystem (14 gap)

### Critical
1. **G-1: Bot/apps marketplace** — Signed manifests, scoped grants, review, quotas, revocation, provenance.
2. **G-2: CRM/Helpdesk integration** -- Salesforce, Zendesk, HubSpot, Intercom integrations.

### High
3. **G-3: Custom chatbot builder** -- Visual drag-drop workflow builder per agent rules + LLM.
4. **G-4: Knowledge base integration** -- Connectors per Confluence, Notion, SharePoint, Google Drive con RAG.
5. **G-5: Custom workflows/automations** -- IF-THEN trigger-action engine per chat events.
6. **G-6: Agent marketplace** -- Pre-built agent skills/templates da community.
7. **G-7: AI provider marketplace** -- Multiple LLM providers con BYO key.
8. **G-8: Webhook event catalog esteso** -- Tutti gli eventi come webhook con retry/signing/batch.

### Medium
9. **G-9: Cross-channel continuity** -- Stessa sessione tra web/mobile/voice/bot, identity binding.
10. **G-10: Customer journey mapping** -- Visualizzazione percorso utente cross-channel.
11. **G-11: Expert/VIP routing** -- Skill-based/priority routing con SLA.
12. **G-12: A/B testing per bot** -- Test A/B su risposte bot, model selection, behavior.

### Low
13. **G-13: MCP Apps** -- MCP servers che rendono UI via stream protocol in iframe sandbox. [ai-sdk.dev/docs/ai-sdk-core/mcp-apps](https://ai-sdk.dev/docs/ai-sdk-core/mcp-apps)
14. **G-14: MCP resource links** -- Content type `resource_link`, URI policy, lazy fetch sicuro.

---

## H. Emerging/Market Trends (10 gap)

### Critical
1. **H-1: AI Transport (durable AI sessions)** -- Ably-style: token/event streams sopravvivono a disconnect/device switch con offset come contratto, non stato UI effimero.

### High
2. **H-2: Agent-to-agent (A2A) protocol v1.0** -- Google-standard con 150+ org (AWS, Microsoft). Mapping envelope/task/artifact con extension preservation. Dobbiamo implementare adapter conforme.
3. **H-3: Voice-first chat interface** -- UI ottimizzata per interazione vocale (push-to-talk, always-listening, visual feedback).
4. **H-4: Composable UI kits** -- Stream-style React/Vue/Svelte component library completa (channel list, thread view, message list, composer, reactions, emoji picker).

### Medium
5. **H-5: Spatial/digital-twin rooms** -- Shared scene state with agent vision/action grants.
6. **H-6: Real-time translation nativa** -- Per-user language preference, live translate, original access, glossary.
7. **H-7: Virtual waiting room** -- Queue management per agent handoff con posizione stimata.
8. **H-8: AI-powered conversation analytics** -- Sentiment, intent, topic clustering, knowledge gaps.

### Low
9. **H-9: Decentralized/Web3 chat** -- Wallet-based auth, token-gated rooms, on-chain message commitments.
10. **H-10: AR/VR chat overlay** -- Spatial audio, 3D presence, shared AR canvas.
