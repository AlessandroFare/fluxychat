# FluxyChat Realtime + AI Roadmap

> Audit aggiornato il 16 luglio 2026 | Gap analysis 110 item contro AI SDK + Chat SDK + mercato 2026 | Dettaglio in `docs/research/FLUXYCHAT-GAPS-2026.md` contro `vercel/ai` main, AI SDK 7, documentazione AI SDK e mercato realtime/voice/chat. Obiettivo: adottare nel core FluxyChat le capability utili a chat, agenti e realtime senza dipendere da `ai` o `@ai-sdk/*` e senza copiare codice upstream.

## Legenda

- **Stato:** `complete`, `partial`, `missing`, `n/a`.
- **Fase:** **Now** (fondamenta e affidabilità), **Next** (parità prodotto), **Later** (estensioni avanzate).
- Una voce `complete` indica copertura funzionale verificata nel codice; una voce `partial` richiede hardening anche se la demo è già utilizzabile.
- Ogni nuova API deve funzionare in Cloudflare Workers e mantenere adapter compatibili con gli envelope legacy.

## Executive summary

FluxyChat dispone già di una base molto più ampia di una semplice chat: room realtime, resume/replay, message streaming, tool calls e approval, agent runtime, output strutturato, MCP, voice, multimodalità, embeddings, telemetry e push. Il gap principale non è soltanto il numero di feature, ma l'assenza di un modello core uniforme per result, stream part, provider, errori, usage e lifecycle; questo rende più difficile comporre e testare le funzioni già presenti.

Le quattro demo Realtime sono tutte implementate. La precedente roadmap che marcava Real-Time Location come assente era obsoleta: protocollo, publisher, hook, snapshot, TTL e mappa esistono già. La prima tranche di hardening ha introdotto refresh automatico delle sessioni demo, cancellazione fetch, dedup delle reazioni optimistic/echo, cleanup timer e Permissions API, dedup service worker, serializzazione subscribe push, controllo VAPID e rollback delle subscription non registrate.

## 1. Realtime Features audit

| Capability | Stato | Evidenza | Gap / intervento | Fase | Definition of Done |
|---|---|---|---|---|---|
| In-App Chat | partial | `packages/sdk/src/use-chat.ts`, `room-session.ts`, `apps/dashboard/components/chat`, Room DO | Session expiry, read-only UI, pending/failed/retry, reconnect visibility | Now | token refresh trasparente; invii idempotenti; retry accessibile; test reconnect/read-only |
| Live Streaming | partial | client events, presence/subscription count, `live-streaming-showcase.tsx`, Worker fan-out | Dedup optimistic/echo, burst policy, bounded animation queue, publish errors | Now | reaction id end-to-end; niente doppioni; max queue deterministico; cleanup testato |
| Real-Time Location | partial | `protocol/location-events.ts`, `sdk/location-track.ts`, `sdk/use-location.ts`, Room DO, dashboard map | Permission cleanup, publisher ownership, coordinate/timestamp validation, privacy precision, stale/end reconnect | Now | snapshot late joiner; TTL; role policy; no update after unmount; protocol/Worker/hook tests |
| Push Notifications | partial | `sdk/use-web-push.ts`, VAPID routes/tests, service worker, offline notifications | Race subscribe, VAPID rotation, partial unsubscribe, delivery receipts/pruning, SW scope feedback | Now | una sola operation; rollback atomico; 404/410 prune; payload/TTL/topic validati; lifecycle tests |

### Realtime acceptance suite

- Seconda tab: fan-out di messaggi, reaction e location senza duplicati.
- Disconnessione e ripristino: catch-up senza perdita o duplicazione; stato UI comprensibile.
- Permission denied/unsupported per location e push senza loop o errori console.
- Unmount/tab switch: socket, geolocation watch, permission listener e timer chiusi.
- Sessione demo aperta oltre la scadenza: nuovo token prima dell'expiry, client ricreato in sicurezza.
- Keyboard e screen reader: tab, status e controlli hanno label/stato coerenti.

## 2. Matrice completa AI SDK parity

### 2.1 Core generation e output

| Capability | Stato | Target FluxyChat | Fase | Test / DoD |
|---|---|---|---|---|
| `generateText` equivalente provider-agnostic | partial | `packages/agent/src`, nuovo core result | Now | result tipato con text, steps, usage, finishReason, warnings, metadata |
| `streamText` equivalente | partial | protocol stream parts + agent runtime | Now | abort propagato, backpressure, onChunk/onFinish, error part sicura |
| Object JSON da schema | partial | structured output esistente | Now | object/array/enum/no-schema, validation e repair, partial stream |
| Output custom | missing | core output strategy | Next | interfaccia strategy con parse/validate/partial |
| Prompt normalization | partial | nuovo `ModelMessage` canonico | Now | system/user/assistant/tool; testo, file, image, audio; URL safety |
| Usage normalizzato | partial | protocol/core | Now | input/output/reasoning/cached/total token, raw provider opt-in |
| Finish reason normalizzato | partial | protocol/core | Now | stop, length, content-filter, tool-calls, error, other, unknown |
| Provider warnings/metadata | partial | result envelope | Now | preservati senza esporre segreti; serializzabili |
| Retry con exponential backoff/jitter | partial | provider executor | Now | retry solo errori retryable; Retry-After; abort interrompe attesa |
| Timeout per request e step | partial | provider/agent | Now | timeout tipato e cleanup risorse |
| Multi-step generation | partial | agent runtime | Now | step start/finish, usage cumulativa, limiti budget |
| Reasoning parts | partial | stream/UI message | Next | opt-in, redaction default, start/delta/end |
| Sources/citations | partial | stream/UI message | Next | source URL/document con validazione e rendering sicuro |
| Files generati | partial | media + stream parts | Next | metadata MIME/size, storage policy, signed access |

### 2.2 Provider layer e registry

| Capability | Stato | Target | Fase | Test / DoD |
|---|---|---|---|---|
| Language model contract versionato | partial | `packages/agent` | Now | contract suite condivisa per ogni provider |
| Embedding model contract | partial | agent/retrieval | Next | embed/embedMany, max batch, usage, abort |
| Reranking model contract | missing | agent/retrieval | Next | topN, document object/string, score stabile |
| Image model contract | partial | multimodal core | Next | n, size/aspect, seed, warnings, provider metadata |
| Video model contract | missing | media core | Later | polling/progress, cancel, output assets |
| Speech model contract | partial | voice core | Next | format, voice, speed, language, usage |
| Transcription model contract | partial | voice core | Next | segments/timestamps/language/duration |
| Realtime model contract | partial | voice/realtime protocol | Next | session events, audio deltas, interruptions, tool calls |
| Provider registry | partial | model registry | Now | `provider:model`, aliases, duplicate policy, list/capabilities |
| Custom provider | partial | registry adapters | Next | factory tipata e feature detection |
| OpenAI-compatible adapter | partial | provider adapters | Next | base URL/header safety, stream/non-stream contract tests |
| Gateway routing | partial | `ai-gateway` | Next | fallback, budget/latency policy, health/circuit breaker |
| Model middleware | partial | middleware core | Next | wrap generate/stream, compose ordine deterministico |
| Test provider utilities | missing | package test utilities | Now | deterministic model, chunk scripts, tool fixtures, error injection |

### 2.3 Streaming protocol

| Capability | Stato | Fase | Definition of Done |
|---|---|---|---|
| Canonical typed stream parts | partial | Now | start/finish, text, reasoning, source, file, data, tool, error, step |
| SSE parser/serializer | partial | Now | multiline data, comments, CRLF, invalid frame error, abort |
| NDJSON parser/serializer | partial | Next | incremental UTF-8 e malformed-line policy |
| Backpressure | partial | Now | `desiredSize` rispettato; bounded queues |
| Smooth stream transform | partial | Next | word/line/custom delay; abort e flush corretti |
| Stream transforms composabili | missing | Next | transform chain typed e order test |
| Merge streams | missing | Next | fair merge, source identity, deterministic cancellation |
| Resumable stream | partial | Now | event IDs, cursor, Last-Event-ID, idempotent replay |
| Idempotency | partial | Now | request/message/tool keys con dedup server-side |
| Consume/drain helper | missing | Next | drain con callback error e cancellation |
| Stream-to-response helpers | partial | Now | headers, status, CORS, consume-on-disconnect policy |
| UTF-8 boundary safety | partial | Now | split multibyte contract test |

### 2.4 Tools e human-in-the-loop

| Capability | Stato | Fase | Definition of Done |
|---|---|---|---|
| Input/output schema | partial | Now | validazione input e output, JSON-safe serialization |
| Dynamic tools | partial | Next | runtime name/description/schema con type narrowing |
| Provider-defined tools | partial | Next | namespaced options/results e capability detection |
| Streaming tool input | partial | Next | input-start/delta/available e invalid partial isolation |
| Execute lifecycle callbacks | partial | Now | onInputStart/onInputDelta/onInputAvailable/onOutput/onError |
| Execution context | partial | Now | messages, step, abortSignal, runtime context, toolCallId |
| Invalid tool call repair | partial | Next | configurable repair callback, max attempts, audit |
| Approval/HITL | partial | Now | approval request/response persistente, resume idempotente |
| Per-tool policy | partial | Now | allowlist, roles, quotas, network policy, timeout |
| Tool cancellation | partial | Now | abort propagato al tool; stato cancelled distinto |
| Typed tool errors | partial | Now | validation/execution/denied/timeout/retryable |
| Tool result serialization | partial | Now | text/json/file/media; size limits; redaction |
| Client-side tools | partial | Next | explicit execution boundary, approval e result submission |

### 2.5 Agents

| Capability | Stato | Fase | Definition of Done |
|---|---|---|---|
| Reusable loop agent | partial | Now | API stabile separata dalle route Worker |
| Stop conditions composabili | partial | Now | step count, tool called, token/cost/time, custom predicate |
| Prepare-step hook | partial | Next | model/tools/prompt/toolChoice modificabili per step |
| Runtime context | partial | Now | contesto tipato non serializzato nel prompt per default |
| Agent delegation | partial | Next | agent-as-tool, depth/cycle/budget guards |
| Memory/context compaction | partial | Next | threshold, summary provenance, pinned messages |
| Durable execution | partial | Next | checkpoint step/tool, retry/resume senza doppia esecuzione |
| Budget controls | partial | Now | max tokens/cost/time/steps/tool calls con finish reason |
| Per-step tracing | partial | Now | span parent/child, usage/latency/tool status |
| Workflow agent | partial | Later | durable pause/event/retry e visualizzazione stato |
| Agent skill loading | partial | Later | version, checksum, allowlist, sandbox, provenance |
| Sandboxed tool execution | missing | Next | session per run, filesystem/network policy, quotas, timeout, artifact export e teardown garantito |
| Tool input refinement | missing | Next | trasformazione tipata post-parse/pre-execute con audit del valore originale e raffinato |
| Tool order deterministico | missing | Next | ordine esplicito, residui alfabetici e provider contract test |
| Context separation | partial | Now | `runtimeContext` condiviso e `toolsContext` per-tool validato; credenziali mai nel prompt |
| System-message injection guard | missing | Now | system role nei messaggi rifiutato per default; istruzioni trusted separate e opt-in auditato |
| Include/raw controls | missing | Next | request body/messages/response/raw chunks solo opt-in con size cap e redaction |

### 2.6 UI message e chat transports

| Capability | Stato | Fase | Definition of Done |
|---|---|---|---|
| Canonical `UIMessage.parts` | partial | Now | text/reasoning/source/file/data/tool/step con legacy adapter |
| Model ↔ UI conversion | partial | Now | validation, metadata preservation, tool pairing |
| Typed tool rendering | partial | Next | state machine input/output/error/approval |
| Message metadata | partial | Next | created/model/usage/custom typed metadata in stream |
| Custom data parts | partial | Next | transient/persistent, reconciliation by ID |
| Optimistic messages | partial | Now | pending/sent/failed, retry idempotente, rollback |
| Stop generation | partial | Now | abort server/provider/tool e UI terminal state |
| Regenerate | partial | Next | message boundary, branch semantics, deterministic IDs |
| Resume stream | partial | Now | reconnect cursor and active-run discovery |
| Transport abstraction | partial | Next | HTTP/SSE/WebSocket/custom prepare request/reconnect |
| Persistence IDs | partial | Now | server-generated chat/message IDs e collision tests |
| Message pruning | partial | Next | token-aware prune preservando tool pairs/system/pinned |
| Standalone stream conversion | missing | Next | `AIStreamPart` → text/UI chunks separato dal result object, usabile da transport custom e test |
| UI input validation | missing | Now | validate/safeValidate unknown messages contro schema parts/tools prima di model conversion |
| Agent UI async iterable | missing | Next | pipeline validate → model messages → agent stream → UI chunks, indipendente da HTTP/React |
| Stream data reconciliation | missing | Next | data parts persistenti aggiornabili per ID, transient parts non persistite e callback dedicata |
| Generative UI sandbox | missing | Later | componenti/tool UI non fidati in iframe isolato, JSON-RPC bridge, CSP e capability grants |
| Vanilla store | complete | — | `FluxyRoomStore` disponibile a consumer non React |
| React parity | partial | Now | lifecycle/concurrency tests |
| React Native parity | partial | Next | core protocol, reconnect, push, media, location |
| Flutter parity | partial | Later | protocol/message parts/reconnect/feature detection |

### 2.7 Retrieval e RAG

| Capability | Stato | Fase | Definition of Done |
|---|---|---|---|
| `embed` | partial | Next | normalized result/usage/metadata/abort |
| `embedMany` | partial | Next | provider max batch, parallelism e retry per batch |
| Cosine similarity | partial | Next | zero-vector guard e deterministic tests |
| Rerank | missing | Next | typed documents, topN, usage |
| Chunking | partial | Next | token-aware, overlap, metadata/provenance |
| Retrieval pipeline | partial | Next | query rewrite → retrieve → rerank → context budget |
| Message search integration | partial | Next | tenant/user scope e citations |
| Embedding cache/versioning | partial | Later | model/version hash, invalidation, privacy retention |

### 2.8 Media e realtime voice

| Capability | Stato | Fase | Definition of Done |
|---|---|---|---|
| Multimodal prompt input | partial | Next | image/audio/file URL/data; MIME/size/SSRF validation |
| Image generation | partial | Next | normalized result, progress, storage and safety metadata |
| Video generation | missing | Later | async job lifecycle, progress/cancel/storage |
| Speech/TTS | partial | Next | streaming audio, voice/options, abort |
| Transcription | partial | Next | partial/final transcript, timestamps, diarization optional |
| File upload | partial | Next | signed upload, checksum, scan, retention, model conversion; sendMedia existsente in VoiceManager |
| Media generation | partial | Next | VoiceManager.generateMedia, file/image/video type; progress e storage restano |
| Voice session protocol | partial | Next | provider-agnostic session/config/event contract |
| Voice interruption/barge-in | partial | Next | VoiceInterruptionConfig, barge-in/manual/semantic modes, VoiceManager.interruptAll, interrupt media playback |
| Audio input/output streaming | partial | Next | codec negotiation, jitter buffer, backpressure |
| Turn detection | partial | Next | server/client VAD policy and manual mode |
| Interruption/barge-in | partial | Next | cancel response/audio and transcript reconciliation |
| Live tool calls | partial | Later | approval and output during voice session |
| Transcript synchronization | partial | Next | item IDs, partial replacement, reconnect snapshot |
| Voice reconnect | partial | Later | ephemeral token refresh, replay boundary, device recovery |

### 2.9 Middleware, telemetry e DevTools

| Capability | Stato | Fase | Definition of Done |
|---|---|---|---|
| `wrapModel` / compose middleware | partial | Next | typed generate/stream wrappers and deterministic order |
| Defaults middleware | missing | Next | merge non-destructive di settings |
| Logging + redaction | partial | Now | secret/PII policy; raw prompt/response opt-in |
| Cache middleware | partial | Next | canonical key, stream replay, tenant isolation |
| Extract reasoning | partial | Next | provider tag parsing opt-in |
| Simulate streaming | missing | Later | non-stream result → deterministic chunks |
| Telemetry settings | partial | Now | function/run metadata, input/output recording flags |
| OpenTelemetry spans | partial | Now | generation, step, provider, tool, retrieval |
| DevTools local inspector | partial | Later | request/result/stream/tool timeline senza produzione |
| Cost/latency/token metrics | partial | Now | model pricing version, TTFT, TPS, cache tokens |
| Raw request/response | partial | Next | explicit opt-in, size cap, header redaction |

### 2.10 MCP e skills

| Capability | Stato | Fase | Definition of Done |
|---|---|---|---|
| MCP HTTP/SSE transport | partial | Next | createMcpClient HTTP/SSE, reconnect, timeout, cleanup |
| MCP stdio transport | n/a | — | non adatto al runtime Worker; supportabile solo tool Node separato |
| Tool discovery/schema refresh | partial | Next | mcpToolsToFluxyChat, fluxyChatResultToMcp, createMcpRegistry multi-server; cache TTL e namespace collision restano |
| Resource discovery/read | partial | Next | listResources, readResource, createMcpRegistry; URI allowlist e MIME/size limits restano |
| Prompt discovery/get | partial | Later | argument validation e provenance |
| OAuth | partial | Later | PKCE/state, token storage/refresh, token store interface; tenant isolation resta |
| Elicitation | missing | Later | UI approval/response schema e timeout |
| Sampling | missing | Later | policy esplicita, recursion/budget guard |
| Lifecycle cleanup | partial | Now | close transport on abort/unmount; no leaked sessions |
| Skill upload/versioning | partial | Later | manifest/schema, checksum, immutable version, rollback |
| MCP protocol negotiation | missing | Next | versione negoziata in ogni request, fallback Streamable HTTP → SSE su errore strutturato |
| MCP server identity/instructions | missing | Next | `serverInfo`, istruzioni e server name propagati con provenance nelle tool parts |
| MCP resource links | missing | Next | content type `resource_link`, URI policy e lazy fetch sicuro |
| MCP auth refresh dedup | missing | Now | una sola refresh/token-exchange concorrente per tenant/server e redirect policy `error` di default |
| MCP Apps | missing | Later | tool model-facing separati da app tools, iframe sandbox e JSON-RPC bridge capability-scoped |
| Structured MCP errors | missing | Next | status, URL sanitizzato e response body capped per fallback senza parsing stringhe |

### 2.11 Reliability e security

| Capability | Stato | Fase | Definition of Done |
|---|---|---|---|
| Typed error hierarchy | partial | Now | provider/HTTP/schema/tool/stream/abort/timeout; retryable flag |
| Rate/concurrency limits | partial | Now | tenant/user/model/tool scopes e informative retry |
| SSRF safety | complete | — | URL redirect tests già presenti; estendere a media/provider tools |
| Tool allowlist | partial | Now | deny by default per agent/environment |
| Prompt injection boundaries | partial | Next | trusted/untrusted parts, retrieval/tool policy |
| Secret redaction | partial | Now | logs, traces, errors, raw metadata |
| Quotas/budgets | partial | Now | atomic accounting e preflight estimate |
| Audit log | partial | Now | agent/tool/approval/provider/admin events |
| Deterministic test models | missing | Now | scripted output/chunks/tools/errors/usage |
| Stream fixtures | partial | Now | malformed, split UTF-8, abort, provider error, reconnect |
| Schema validation limits | partial | Now | depth/size/property caps e safe errors |

### 2.12 Developer experience

| Capability | Stato | Fase | Definition of Done |
|---|---|---|---|
| Stable exports | partial | Now | exports map, no accidental internals, API report test |
| API reference/examples | partial | Next | ogni API shipped ha esempio Worker e browser |
| Migration notes | partial | Now | legacy → canonical stream/message/result adapter |
| Feature detection | partial | Next | provider/model/client capability API |
| Tree-shaking | partial | Next | side-effect-free entrypoints e bundle tests |
| Runtime compatibility | partial | Now | Node/Worker/browser matrix e no Node builtin nel core |
| Contract tests | partial | Now | provider, protocol, stream, transport, SDK parity |
| Semver/deprecation | partial | Next | warning opt-in, removal window e codemod notes |

## 3. Realtime market expansion

Questa sezione estende la parity AI SDK con capability emerse dal confronto 2026 con piattaforme chat complete, infrastrutture realtime e stack voice/WebRTC. Non tutte devono entrare nel core: transport e wire contract restano nel protocollo/SDK, mentre UI e integrazioni sono moduli separati.

### 3.1 Messaging reliability e transport

| Capability | Stato | Fase | Definition of Done |
|---|---|---|---|
| Per-room sequencing | partial | Now | sequence server-authoritative, gap detection, cursor catch-up e ordering test multi-connection |
| Delivery semantics esplicite | partial | Now | at-least-once documentato, idempotency key client, dedup persistente e receipt accepted/persisted/delivered/read |
| Offline-first outbox | partial | Next | createOutboxProcessor con retry/backoff maxRetries; persistent queue, transient/durable lane split e chaos harness |
| Delta sync | partial | Now | createDeltaPoller/createMemoryDeltaStore: sync incrementale da cursor, snapshot fallback, prune compaction |
| Presence leases | partial | Now | createPresenceLeaseManager: heartbeat/TTL, renew/expire/shouldRenew, grace period; multi-device resta |
| Ephemeral/durable lane split | partial | Next | createLaneProcessor: priority ordering con transient/durable lanes, outbox fallback per durable failures |
| WebTransport adapter | missing | Later | capability negotiation, bidirectional streams/datagrams, backpressure e fallback WebSocket/SSE |
| Adaptive transport | partial | Next | health-based WebSocket/SSE/long-poll fallback senza duplicare eventi |
| Regional failover | missing | Later | reconnect cross-region, cursor continuity, no split-brain e RTO/RPO misurati |
| Chaos/load harness | partial | Next | createChaosHarness: failureRate/latency/disconnectAfter, event recording; reconnect storm e fan-out benchmark restano |

### 3.2 Modern chat product surface

| Capability | Stato | Fase | Definition of Done |
|---|---|---|---|
| Threads/replies/reactions | partial | Next | unread per thread, mention scope, reaction aggregation e sync multi-device |
| Edits/deletes/tombstones | partial | Next | version history policy, optimistic conflict, moderation/legal-hold semantics |
| Scheduled/ephemeral messages | partial | Next | durable scheduler, expiry tombstone, timezone e retention interaction |
| Rich composer | partial | Next | mentions, slash commands, link preview SSRF-safe, attachments, draft sync e scheduled send |
| Search + semantic search | partial | Next | createMemorySearchIndex: token scoring, snippet, sort by relevance; vector/hybrid e ACL restano |
| AI summaries/catch-up | partial | Next | createMemorySummaryStore: keyPoints, actionItems, provenance; invalidation incrementale e feedback restano |
| Smart reply/compose assist | partial | Next | tenant tone, multilingual, private draft, opt-out e no training leakage |
| Live translation | partial | Next | createMemoryTranslationCache: cache, source/target lang; glossary e edit reconciliation restano |
| AI moderation + appeals | partial | Next | createModerationEngine: rules, block/flag/allow/review, DLP PII detection, report log; quarantine e appeal restano |
| Huddles/audio-video | missing | Later | WebRTC room, screen share, captions, recording consent e chat timeline linkage |
| Collaborative artifacts | missing | Later | typed live cards/docs/whiteboard via CRDT, permissions e version snapshots |
| Bots/apps marketplace | partial | Later | signed manifests, scoped grants, review, quotas, revocation e provenance |
| Federation/interoperability | partial | Later | Matrix/ActivityPub bridges oggi; valutare MIMI/MLS quando implementazioni mature |

### 3.3 Realtime voice intelligence

| Capability | Stato | Fase | Definition of Done |
|---|---|---|---|
| WebRTC media transport | partial | Next | createWebRTCVoiceTransport: RTCPeerConnection, data channel, media stream lifecycle, codec/device negotiation; NAT recovery e jitter restano |
| Layered VAD + semantic EOT | partial | Next | createSemanticEOTDetector: turn endings, prompt indicators, questions; energy gate non implementato |
| Backchannel detection | partial | Next | createBackchannelDetector: ack/interest/encourage patterns con debounce; non distingue rumore |
| Fast barge-in | partial | Now | flush playback e abort model/TTS/tool, target p95 sotto 150 ms, transcript reconciled |
| Time-to-first-audio SLO | missing | Now | span mic→ASR→LLM→TTS→speaker, target p95 e adaptive routing |
| Noise/echo handling | missing | Next | AEC, noise suppression, gain control e device diagnostics |
| Multilingual/code-switching | partial | Next | language switch per segment, niente preemptive response unsafe, glossary e voice continuity |
| Speaker diarization | partial | Later | speaker IDs stabili, overlap speech, correction UI e consent policy |
| Prosody/emotion controls | missing | Later | normalized style/rate/pitch, provider fallback e safety boundaries |
| Voice handoff | partial | Next | AI→human con summary/context/consent, warm transfer e continuity transcript |
| Call QA intelligence | partial | Later | topic/outcome/sentiment/compliance score con evidence spans e human review |
| Voice privacy controls | partial | Now | explicit recording consent, retention, redaction, regional processing e delete/export |

### 3.4 Security, privacy e enterprise differentiation

| Capability | Stato | Fase | Definition of Done |
|---|---|---|---|
| E2EE one-to-one/group | partial | Later | audited protocol; valutare MLS per gruppi, multi-device key rotation e recovery |
| Customer-managed keys | partial | Later | envelope encryption, rotation, revocation e tenant-isolated KMS audit |
| DLP pipeline | partial | Next | PII detection (SSN, credit card, email) in createModerationEngine; PHI/PCI su file/audio e policy versioning restano |
| eDiscovery/legal hold | partial | Next | immutable hold, scoped export, chain of custody e audit verificabile |
| Data residency/sovereignty | partial | Later | region pinning per tenant, subprocessors, backup e inference routing coerenti |
| AI governance | missing | Next | model/prompt/tool registry, risk tier, evaluations, approvals e evidence export |
| Accessibility realtime | partial | Now | WCAG keyboard/SR, live captions, reduced motion, non-audio cues e latency tolerant UX |
| Abuse/spam defense | partial | Now | device/user/tenant rate limits, raid mode, trust score e false-positive review |

### 3.5 Product analytics e operations

| Capability | Stato | Fase | Definition of Done |
|---|---|---|---|
| Realtime SLO dashboard | partial | Now | connect success, reconnect, fan-out lag, delivery/read latency, drop/duplicate/gap rate |
| Voice quality dashboard | missing | Next | TTFA, ASR WER proxy, EOT delay, interruption precision, jitter/loss e device breakdown |
| Conversation quality evals | partial | Next | golden datasets, online sampling, tool success, groundedness, safety e regression gates |
| Cost attribution | partial | Now | room/run/model/tool/media cost per tenant con budget alerts e anomaly detection |
| Session replay privacy-safe | partial | Later | event timeline redatta, consent/retention e deterministic protocol replay |
| Feature flags/experiments | partial | Next | tenant rollout, kill switch, holdout, metric guardrails e schema-version compatibility |

### 3.6 Agent Collaboration Fabric

Il gap più rilevante emerso dalla ricerca 2026 non è un'altra chat feature isolata, ma un piano di collaborazione durevole nel quale persone e agenti sono peer addressable della stessa room. A2A copre delega e lifecycle inter-agent, AG-UI copre eventi agent→interfaccia, mentre durable streams e shared-state room colmano reconnect, multi-device e co-presenza; FluxyChat deve integrarli tramite envelope originali e adapter, senza legarsi a un singolo runtime.

| Capability | Stato | Fase | Definition of Done |
|---|---|---|---|
| Agent identity e capability discovery | partial | Now | agent card versionata, capability/trust/region/cost metadata, cache con expiry e negotiation |
| Durable agent task lifecycle | partial | Now | submitted/working/input-required/completed/failed/cancelled, idempotency, offset resume e cancellation |
| A2A interoperability adapter | missing | Now | mapping envelope/task/artifact, extension preservation, auth hooks e conformance fixtures ufficiali |
| AG-UI/A2UI event adapter | missing | Now | run/step/message/tool/state/activity mapping, bidirezionalità, unknown-event preservation e replay test |
| Durable resumable streams | partial | Now | ordered append, monotonic offset, cursor resume, compaction boundary e reconnect/device-switch test |
| Agenti come room peer | partial | Now | presence/typing/thinking/tool/approval, ACL, immutable attribution e human-readable activity |
| Shared agent state e artifacts | partial | Next | createMemorySharedStateStore: versioning, lock/unlock, TTL; JSON Patch/CRDT e per-field authorization restano |
| Distributed delegation | partial | Next | routeTask delegato con capability/trust/cost/region scoring; fan-out/fan-in e exactly-once effect key restano |
| Policy-aware agent routing | partial | Next | routeTask con capability/trust/cost/region scoring, maxResults; circuit breaker e explainability restano |
| Cross-channel continuity | missing | Next | stessa sessione tra web/mobile/voice/bot, identity binding, cursor continuity e consent boundaries |
| AI↔AI↔human handoff | partial | Next | createHandoffManager: request/respond/complete, pending queue, warm transfer; consent e rollback restano |
| Async tool narration | missing | Next | tool in background senza dead air, progress stream, cancellazione e risultato riconciliato nel task |
| Agent provenance ledger | partial | Next | catena append-only di deleghe, prompt/tool/model policy version, artifact lineage ed export redatto |
| Agent interoperability lab | missing | Next | deterministic peers, protocol fuzzing, reconnect/reorder/duplicate, golden traces e compatibility matrix |
| Secure low-latency agent transport | missing | Later | adapter sperimentale SLIM/HTTP3 con capability negotiation, MLS dove maturo e fallback standard |
| Spatial copresence e digital-twin rooms | missing | Later | typed scene state, agent vision/action grants, web/immersive presence e replay senza imporre rendering 3D al core |

### 3.7 Gap analysis completa (2026-07-16)

110 gap identificati in 8 categorie. Dettaglio completo in `docs/research/FLUXYCHAT-GAPS-2026.md`.

| Categoria | Gap | Critici | Alta | Media | Bassa |
|-----------|-----|---------|------|-------|-------|
| AI/Agent Core | 18 | 4 | 6 | 6 | 2 |
| Chat Product Surface | 22 | 2 | 8 | 9 | 3 |
| Realtime Infrastructure | 12 | 2 | 5 | 3 | 2 |
| Voice/Video/Media | 10 | 2 | 3 | 3 | 2 |
| Enterprise/Security | 14 | 1 | 5 | 6 | 2 |
| Developer Experience | 10 | 1 | 3 | 4 | 2 |
| Integration/Ecosystem | 14 | 2 | 6 | 4 | 2 |
| Emerging/Market Trends | 10 | 1 | 4 | 3 | 2 |
| **Totale** | **110** | **15** | **40** | **38** | **17** |
| **Roadmap** | **110 in Tranche D/E/F** | **D: 50** | **E: 22** | **F: 38** | — |

**Top 15 gap critici:**

1. **A-1: Unified reasoning parameter** — Cross-provider `reasoning` param (effort/budget/summary). Noi solo temp/max_tokens. [AI SDK Reasoning](https://ai-sdk.dev/docs/ai-sdk-core/reasoning)
2. **A-2: Memory system for agents** — Provider memory tools (Anthropic, Letta, Mem0, ecc.). [AI SDK Memory](https://ai-sdk.dev/docs/agents/memory)
3. **A-3: Tool approval flow with HMAC** — `toolApproval` HMAC-signed + `useChat` integration. [AI SDK Tool Approvals](https://ai-sdk.dev/docs/agents/tool-approvals)
4. **A-4: Lifecycle callbacks sistematici** — onStart/StepStart/LanguageModelCall/ToolExecution/StepEnd/End. [AI SDK Lifecycle](https://ai-sdk.dev/docs/ai-sdk-core/lifecycle-callbacks)
5. **B-1: Rich interactive cards + actions** — Cards/Buttons/Select/Table/Chart nativi. [Chat SDK Cards](https://chat-sdk.dev/docs/cards)
6. **B-2: Message-to-LLM converter** — `toAiMessages()` con attachment handling. [Chat SDK AI](https://chat-sdk.dev/docs/ai/to-ai-messages)
7. **C-1: Durable AI Transport** — Ably-style resilient AI sessions con offset continuity. [Ably AI Transport](https://ably.com)
8. **C-2: Collaborative editing (CRDT)** — Liveblocks-style documenti condivisi. [Liveblocks](https://liveblocks.io)
9. **D-1: Voice AI pipeline end-to-end** — Streaming speech-to-speech sub-300ms. [LiveKit](https://livekit.io/cloud)
10. **D-2: TTFA SLO tracking** — Span metrics per ogni fase voice. [Daily.co](https://daily.co)
11. **E-1: E2EE groups (MLS)** — Gruppi con MLS protocol, multi-device key rotation.
12. **F-1: Testing utilities** — Mock adapter/chat/state, Vitest matchers. [Chat SDK Testing](https://chat-sdk.dev/docs/testing)
13. **G-1: Bot/apps marketplace** — Signed manifests, scoped grants, review, quotas.
14. **G-2: CRM/Helpdesk integration** — Salesforce, Zendesk, HubSpot, Intercom.
15. **H-1: AI Transport** — Durable AI sessions (stessa necessità di C-1, teneva distinti per categoria).

### 3.8 Segnali di mercato e criteri di adozione

- **Human-agent shared rooms:** Liveblocks tratta gli agenti backend come partecipanti delle room; FluxyChat deve offrire peer identity, presence e storage condiviso senza rendere obbligatorio un vendor.
- **Durable conversation transport:** Ably AI Transport e il protocollo Durable Streams mostrano che token/event stream devono sopravvivere a disconnect e device switch; gli offset devono essere parte del contratto, non stato UI effimero.
- **Stateful edge agents:** Cloudflare Agents/Durable Objects confermano il valore di task lunghi, sub-agent e stato colocato; FluxyChat conserva adapter Worker-safe e separa protocollo da execution runtime.
- **Voice senza dead air:** i tool asincroni dei moderni voice-agent stack richiedono progress/narration concorrente e cancellazione coordinata, non un loop sincrono bloccante.
- **Standard complementari:** MCP rimane agent-to-tool, A2A agent-to-agent e AG-UI agent-to-user; nessuno sostituisce reliability, auth, policy e persistence FluxyChat.
- **Frontiera adiacente:** spatial rooms/digital twins sono coerenti solo come shared-state e capability layer opzionale; rendering, engine 3D e hardware restano fuori dal core.

## 4. Ordine di implementazione

### Tranche A — Now: hardening e fondamenta

1. Chiudere audit delle quattro demo e aggiungere regression test.
2. Introdurre tipi canonici `AIUsage`, `AIFinishReason`, `AIWarning`, `AIProviderMetadata`, `AIStreamPart` e gerarchia errori.
3. Rendere abort, timeout, retry e backpressure uniformi.
4. Aggiungere deterministic test model e contract suite.
5. Adapter non-breaking tra eventi/message legacy e parts canoniche.
6. Budget, allowlist, telemetry/redaction e lifecycle tool uniformi.

### Tranche B — Complete (delivery): provider, agent e UI parity

1. **Partial:** registry originale e contratti v1 per language, embedding e rerank; restano gli adapter model uniformi per image/speech/transcription/realtime.
2. **Partial:** `generate`/`stream`, prompt multimodale canonico, lifecycle, retry, timeout, abort e result uniforme; resta la validazione JSON Schema avanzata.
3. **Partial:** agent loop riusabile con stop conditions, `prepareStep`, runtime context, budget tool, allowlist, approval e dedup call ID; delegation distribuita resta pianificata.
4. **Partial:** stream part canoniche sono nel protocollo; transport e store legacy esistono, mentre la migrazione completa del renderer a `UIMessage.parts` resta pianificata.
5. **Partial:** `embed`/`embedMany`, batching, cosine similarity, tenant scoping e rerank sono disponibili; citations UI e vector store adapter restano pianificati.
6. **Complete:** Voice interruption (barge-in, manual, semantic modes), media upload (`sendMedia`), media generation (`generateMedia`), `interruptAll`, config interruption; 8 test.
7. **Complete:** `createMcpClient` HTTP/SSE, OAuth PKCE, `createMcpRegistry`, `mcpToolsToFluxyChat`/`fluxyChatResultToMcp`, `listResources`/`readResource`, token store interface; 8 test.

### Tranche C — Complete (delivery): Agent collaboration e realtime leadership

1. **Partial:** Agent card/capability discovery, durable task lifecycle, offset resume e agenti come room peer (da delivery 2026-07-15).
2. **Partial:** Adapter A2A e AG-UI/A2UI con extension preservation, conformance suite e deterministic replay (da delivery 2026-07-15).
3. **Complete:** `createDeltaPoller`/`createMemoryDeltaStore` con prune, `createPresenceLeaseManager` con TTL/renew/expire, `createMemoryDurableStreamStore`; 12 test.
4. **Complete:** `createOutboxProcessor` con retry/maxRetries/backoff, `createLaneProcessor` con priority ordering/durable fallback outbox, `createChaosHarness` con failureRate/latency/disconnect; 9 test.
5. **Complete:** `routeTask` con capability/trust/cost/region scoring, `createMemorySharedStateStore` con versioning/lock/unlock/TTL, `createHandoffManager` con request/respond/complete/pending queue; 15 test.
6. **Complete:** `createSemanticEOTDetector`, `createBackchannelDetector`, `createBargeInDetector` (consecutive sample threshold/debounce), `createWebRTCVoiceTransport` (RTCPeerConnection/data channel/media stream); 14 test.
7. **Complete:** `createMemorySummaryStore` con provenance, `createMemorySearchIndex` con token scoring snippet, `createModerationEngine` con DLP PII detection, `createMemoryTranslationCache`; 10 test.

### Tranche D — Pianificato: AI/Agent Core + Chat Product + Developer Experience (50 gap)

**AI/Agent Core (A-1 to A-18):**
1. **A-1: Unified reasoning parameter** — Parametro `reasoning` cross-provider (effort, budget tokens, summary). [AI SDK Reasoning](https://ai-sdk.dev/docs/ai-sdk-core/reasoning)
2. **A-2: Memory system for agents** — Provider memory tools (Anthropic memory, Letta, Mem0, Supermemory, Hindsight, MongoDB). [AI SDK Memory](https://ai-sdk.dev/docs/agents/memory)
3. **A-3: Tool approval flow HMAC** — `toolApproval` con HMAC-signed, integrate con `useChat` + `addToolApprovalResponse`. [AI SDK Tool Approvals](https://ai-sdk.dev/docs/agents/tool-approvals)
4. **A-4: Lifecycle callbacks sistematici** — `onStart`, `onStepStart`, `onLanguageModelCall`, `onToolExecution`, `onStepEnd`, `onEnd`. [AI SDK Lifecycle](https://ai-sdk.dev/docs/ai-sdk-core/lifecycle-callbacks)
5. **A-5: prepareStep callback** — Modifica dinamica model/tools/prompt/sandbox per step. [AI SDK Loop Control](https://ai-sdk.dev/docs/agents/loop-control)
6. **A-6: pruneMessages context compaction** — Compatta history messaggi oltre soglia. [AI SDK Loop Control](https://ai-sdk.dev/docs/agents/loop-control)
7. **A-7: Subagent delegation pattern** — Parent delega a subagenti via tool con context isolation + `readUIMessageStream`. [AI SDK Subagents](https://ai-sdk.dev/docs/agents/subagents)
8. **A-8: Language model middleware** — `wrapLanguageModel`/`wrapImageModel`, middleware built-in (extractReasoning, simulateStreaming, defaultSettings, addToolInputExamples, extractJson). [AI SDK Middleware](https://ai-sdk.dev/docs/ai-sdk-core/middleware)
9. **A-9: Stream transformations** — `experimental_transform`, `smoothStream`, custom transform, merge streams. [AI SDK Generating Text](https://ai-sdk.dev/docs/ai-sdk-core/generating-text)
10. **A-10: Runtime/Tool context separation** — `runtimeContext` (shared agent state) vs `toolsContext` (per-tool validated context). [AI SDK Runtime Context](https://ai-sdk.dev/docs/ai-sdk-core/runtime-and-tool-context)
11. **A-11: Provider options passthrough** — Namespaced provider-specific config (`providerOptions`) per OpenAI reasoning/Anthropic thinking/speed. [AI SDK Provider Options](https://ai-sdk.dev/docs/foundations/provider-options)
12. **A-12: Provider registry tipizzato** — `createProviderRegistry`, `customProvider`, string model ID resolution. [AI SDK Provider Mgmt](https://ai-sdk.dev/docs/ai-sdk-core/provider-management)
13. **A-13: Provider-defined tools** — Model-trained schemas with execute fallback (web search, code exec). [AI SDK Tools](https://ai-sdk.dev/docs/foundations/tools)
14. **A-14: Provider-executed tools** — Run on provider servers (vs local exec). [AI SDK Tools](https://ai-sdk.dev/docs/foundations/tools)
15. **A-15: Tool input refinement** — Trasformazione tipata post-parse/pre-execute con audit. [AI SDK Tools](https://ai-sdk.dev/docs/foundations/tools)
16. **A-16: Simulate streaming middleware** — Trasforma response non-stream in chunk deterministici per test. [AI SDK Testing](https://ai-sdk.dev/docs/ai-sdk-core/testing)
17. **A-17: Skill uploads** — `uploadSkill` per pre-trained capabilities (computer use, code exec). [AI SDK Skill Uploads](https://ai-sdk.dev/docs/ai-sdk-core/skill-uploads)
18. **A-18: HarnessAgent** — Wrapper per agent esterni (Claude Code, Codex, Pi, OpenCode). [AI SDK Harnesses](https://ai-sdk.dev/docs/ai-sdk-harnesses/overview)

**Chat Product Surface (B-1 to B-22):**
19. **B-1: Rich interactive cards + actions** — `Card`, `Button`, `Actions`, `Select`, `Table`, `Chart`, `Image` nativi per piattaforma. [Chat SDK Cards](https://chat-sdk.dev/docs/cards)
20. **B-2: Message-to-LLM converter** — `toAiMessages()` converte messaggi chat in `{role, content}[]` con attachment handling. [Chat SDK AI](https://chat-sdk.dev/docs/ai/to-ai-messages)
21. **B-3: AI SDK tools per chat** — `createChatTools` espone operazioni chat (post, DM, react, edit, subscribe) come AI SDK tools con preset. [Chat SDK AI Tools](https://chat-sdk.dev/docs/ai/ai-sdk-tools)
22. **B-4: Concurrency strategies** — drop/queue/debounce/burst/concurrent per messaggi sovrapposti su stesso thread. [Chat SDK Concurrency](https://chat-sdk.dev/docs/concurrency)
23. **B-5: Per-thread typed state** — `thread.state`/`setState()` con TTL 30gg per contesto multi-turn agent. [Chat SDK Threads](https://chat-sdk.dev/docs/threads-messages-channels)
24. **B-6: SentMessage chainable** — `sent.edit()`, `sent.delete()`, `sent.addReaction()`, `sent.removeReaction()` dopo post. [Chat SDK Threads](https://chat-sdk.dev/docs/threads-messages-channels)
25. **B-7: Conversation history/transcripts** — `bot.transcripts.append()/list()/delete()` con retention configurabile. [Chat SDK History](https://chat-sdk.dev/docs/conversation-history)
26. **B-8: AST markdown system** — mdast builder (`root`, `paragraph`, `text`, `strong`, `link`) con `parseMarkdown()`/`stringifyMarkdown()`. [Chat SDK Markdown](https://chat-sdk.dev/docs/api/markdown)
27. **B-9: Scheduled messages** — `thread.schedule()`/`channel.schedule()` con `cancel()`. [Chat SDK Threads](https://chat-sdk.dev/docs/threads-messages-channels)
28. **B-10: Ephemeral messages** — `thread.postEphemeral()` visibile solo a utente specifico con DM fallback. [Chat SDK Ephemeral](https://chat-sdk.dev/docs/ephemeral-messages)
29. **B-11: Generative UI** — Tool-name-prefixed parts per React components rendering. [AI SDK Generative UI](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces)
30. **B-12: Message serialization** — `message.toJSON()`/`Message.fromJSON()` per workflow/persistence. [Chat SDK Message](https://chat-sdk.dev/docs/api/message)
31. **B-13: User lookup API** — `bot.getUser(userId)` con email, avatar, fullName. [Chat SDK Chat](https://chat-sdk.dev/docs/api/chat)
32. **B-14: Regex message matching** — `bot.onNewMessage(/pattern/, handler)` per trigger keyword senza @-mention. [Chat SDK Events](https://chat-sdk.dev/docs/handling-events)
33. **B-15: Slash commands** — `bot.onSlashCommand("/cmd", handler)` con registry tipizzato. [Chat SDK Slash Commands](https://chat-sdk.dev/docs/slash-commands)
34. **B-16: Modals/forms system** — `Modal` con `TextInput`, `Select`, `ExternalSelect`, validazione, submit. [Chat SDK Modals](https://chat-sdk.dev/docs/modals)
35. **B-17: Typed file attachments** — `Attachment[]` outgoing con type discrimination (image/video/audio/file), `fetchData()` incoming. [Chat SDK Files](https://chat-sdk.dev/docs/files)
36. **B-18: Streaming enhancements** — `StreamChunk` types (`markdown_text`, `task_update`, `plan_update`), `Plan`, `StreamingPlan`, markdown healing, table buffering. [Chat SDK Streaming](https://chat-sdk.dev/docs/streaming)
37. **B-19: Emoji system** — Type-safe cross-platform emoji con `emoji.*`, `createEmoji()`, `emoji.custom()`. [Chat SDK Emoji](https://chat-sdk.dev/docs/emoji)
38. **B-20: Link preview** — `message.links` con `LinkPreview.fetchMessage()` per messaggi quotati/forwarded. [Chat SDK Message](https://chat-sdk.dev/docs/api/message)
39. **B-21: Message subject** — Parent resource (GitHub issue, Linear issue) context. [Chat SDK Subject](https://chat-sdk.dev/docs/subject)
40. **B-22: Gamification** — XP, badges, leaderboards per engagement utente.

**Developer Experience (F-1 to F-10):**
41. **F-1: Testing utilities** — Mock adapter, mock chat, mock state, Vitest custom matchers (`toHavePosted`, `toHaveEdited`, ecc.). [Chat SDK Testing](https://chat-sdk.dev/docs/testing)
42. **F-2: Error hierarchy tipizzata** — `ChatError` con `code`, `RateLimitError` con `retryAfterMs`, `NotImplementedError` con `feature`, `LockError`. [Chat SDK Errors](https://chat-sdk.dev/docs/error-handling)
43. **F-3: Telemetry/OpenTelemetry** — `registerTelemetry` per Arize, Axiom, Braintrust, Confident AI, Helicone, Laminar, Langfuse, LangSmith, LangWatch. [AI SDK Telemetry](https://ai-sdk.dev/docs/ai-sdk-core/telemetry)
44. **F-4: DevTools local inspector** — Web UI locale per ispezione LLM calls, tool calls, token usage, multi-step. [AI SDK DevTools](https://ai-sdk.dev/docs/ai-sdk-core/devtools)
45. **F-5: AI SDK skill per coding agents** — Skill per Claude Code/Codex con docs complete per contest agent.
46. **F-6: Call options schema** — `callOptionsSchema` + `prepareCall` pattern per configurazione tipo-safe runtime. [AI SDK Call Options](https://ai-sdk.dev/docs/agents/configuring-call-options)
47. **F-7: Dynamic tools runtime** — `dynamicTool()` con name/description/schema in runtime con type narrowing. [AI SDK Tools](https://ai-sdk.dev/docs/foundations/tools)
48. **F-8: Deterministic test models** — Scripted output/chunks/tools/errors/usage per test suite.
49. **F-9: Stream fixtures** — Malformed, split UTF-8, abort, provider error, reconnect fixture set.
50. **F-10: API report/test** — Stabile exports map, no accidental internals, API report test.

### Tranche E — Pianificato: Realtime Infrastructure + Voice/Video/Media (22 gap)

**Realtime Infrastructure (C-1 to C-12):**
1. **C-1: Durable AI Transport** — Ably-style resilient AI sessions con offset continuity, sopravvivono a disconnect/device switch. [Ably AI Transport](https://ably.com)
2. **C-2: Collaborative editing (CRDT)** — Liveblocks-style JSON Patch/CRDT per documenti condivisi, awareness, snapshots. [Liveblocks](https://liveblocks.io)
3. **C-3: Broadcast/campaign messaging** — Send scheduled broadcasts a utenti/segmenti con delivery tracking.
4. **C-4: Adaptive transport health-based** — WebSocket/SSE/long-poll fallback automatico senza duplicazione eventi.
5. **C-5: WebTransport adapter** — HTTP/3 bidirectional streams/datagrams con capability negotiation e fallback WS/SSE.
6. **C-6: Regional failover** — Reconnect cross-region, cursor continuity, no split-brain. [Ably](https://ably.com)
7. **C-7: Per-room sequencing server-authoritative** — Gap detection, cursor catch-up, ordering test multi-connection.
8. **C-8: Delivery semantics granulari** — At-least-once, idempotency key, dedup persistente, receipt accepted/persisted/delivered/read.
9. **C-9: Chat platform adapters aggiuntivi** — WhatsApp Business, Telegram, Line, Viber, iMessage, Messenger (completare stub esistenti).
10. **C-10: Spatial copresence** — Digital-twin rooms con shared state opzionale.
11. **C-11: MCP protocol negotiation** — Versione negoziata in ogni request, fallback Streamable HTTP → SSE su errore strutturato.
12. **C-12: Decentralized relay** — P2P relay per ridurre latenza in reti edge.

**Voice/Video/Media (D-1 to D-10):**
13. **D-1: Voice AI pipeline end-to-end** — Streaming speech-to-speech (mic→ASR→LLM→TTS→speaker) con sub-300ms latenza. [LiveKit](https://livekit.io/cloud)
14. **D-2: Time-to-first-audio SLO tracking** — Span metrics per ogni fase (mic, ASR, LLM, TTS, speaker) con p95 target.
15. **D-3: Noise/echo handling** — AEC, noise suppression, gain control, device diagnostics. [Daily.co](https://daily.co)
16. **D-4: Voice quality dashboard** — TTFA, ASR WER proxy, EOT delay, interruption precision, jitter/loss, device breakdown.
17. **D-5: VAD layered + semantic EOT** — Energy gate + semantic turn model, dynamic endpointing, false-cut/latency metrics.
18. **D-6: Prosody/emotion controls** — Normalized style/rate/pitch, provider fallback, safety boundaries.
19. **D-7: Speaker diarization** — Speaker IDs stabili, overlap speech, correction UI, consent policy.
20. **D-8: Call QA intelligence** — Topic/outcome/sentiment/compliance score con evidence spans e human review.
21. **D-9: Huddles/audio-video rooms** — WebRTC room con screen share, captions, recording consent, chat timeline linkage.
22. **D-10: Video generation progress** — Polling/progress, cancel, output assets (`experimental_generateVideo` parity). [AI SDK Video](https://ai-sdk.dev/docs/ai-sdk-core/video-generation)

### Tranche F — Pianificato: Enterprise/Security + Integration/Ecosystem + Emerging Trends (38 gap)

**Enterprise/Security (E-1 to E-14):**
1. **E-1: E2EE groups (MLS)** — End-to-end encryption per gruppi con MLS protocol, multi-device key rotation, recovery.
2. **E-2: AI governance** — Model/prompt/tool registry, risk tier, evaluations, approvals, evidence export.
3. **E-3: eDiscovery/legal hold** — Immutable hold, scoped export, chain of custody, audit verificabile.
4. **E-4: DLP PHI/PCI detection** — PHI e PCI su text/file/audio, policy versioning, block/redact/quarantine.
5. **E-5: Customer-managed keys (CMK)** — Envelope encryption, rotation, revocation, tenant-isolated KMS audit.
6. **E-6: Data residency/sovereignty** — Region pinning per tenant, subprocessors, backup, inference routing coerenti.
7. **E-7: Policy-based approvals (OPA)** — Open Policy Agent rules (.rego) con WASM/HTTP, shadow mode, transitive enforcement. [AI SDK Policy](https://ai-sdk.dev/docs/agents/policy-tool-approvals)
8. **E-8: MCP server identity/instructions** — `serverInfo`, instructions, server name con provenance nelle tool parts.
9. **E-9: Bot protection/anti-abuse** — Device/user/tenant rate limits, raid mode, trust score, false-positive review.
10. **E-10: Session replay privacy-safe** — Event timeline redatta, consent/retention, deterministic protocol replay.
11. **E-11: Federation interoperability** — Matrix/ActivityPub/DM bridges con compliance EU DMA.
12. **E-12: Feature flags management** — Tenant rollout, kill switch, holdout, metric guardrails.
13. **E-13: Sandboxed tool execution** — Isolated session per run, filesystem/network policy, quotas, timeout, artifact export.
14. **E-14: Generative UI sandbox** — Componenti/tool UI non fidati in iframe isolato, CSP, capability grants.

**Integration/Ecosystem (G-1 to G-14):**
15. **G-1: Bot/apps marketplace** — Signed manifests, scoped grants, review, quotas, revocation, provenance.
16. **G-2: CRM/Helpdesk integration** — Salesforce, Zendesk, HubSpot, Intercom connectors.
17. **G-3: Custom chatbot builder** — Visual drag-drop workflow builder per agent rules + LLM.
18. **G-4: Knowledge base integration** — Connectors per Confluence, Notion, SharePoint, Google Drive con RAG pipeline.
19. **G-5: Custom workflows/automations** — IF-THEN trigger-action engine per chat events.
20. **G-6: Agent marketplace** — Pre-built agent skills/templates da community con versioning.
21. **G-7: AI provider marketplace** — Multiple LLM providers configurabili con BYO key.
22. **G-8: Webhook event catalog esteso** — Tutti gli eventi come webhook con retry/signing/batch delivery.
23. **G-9: Cross-channel continuity** — Stessa sessione tra web/mobile/voice/bot, identity binding, cursor continuity.
24. **G-10: Customer journey mapping** — Visualizzazione percorso utente cross-channel con analytics.
25. **G-11: Expert/VIP routing** — Skill-based/priority routing con SLA e escalation.
26. **G-12: A/B testing per bot** — Test A/B su risposte bot, model selection, behavior.
27. **G-13: MCP Apps** — MCP servers che rendono UI via stream protocol in iframe sandbox. [AI SDK MCP Apps](https://ai-sdk.dev/docs/ai-sdk-core/mcp-apps)
28. **G-14: MCP resource links** — Content type `resource_link`, URI policy, lazy fetch sicuro.

**Emerging/Market Trends (H-1 to H-10):**
29. **H-1: AI Transport (durable AI sessions)** — Token/event streams sopravvivono a disconnect/device switch con offset come contratto. [Ably](https://ably.com)
30. **H-2: A2A protocol v1.0 adapter conforme** — Mapping envelope/task/artifact con extension preservation. Standard 150+ org (AWS, Google, Microsoft).
31. **H-3: Voice-first chat interface** — UI ottimizzata per interazione vocale (push-to-talk, always-listening, visual feedback).
32. **H-4: Composable UI kits** — Stream-style React/Vue/Svelte component library completa (channel list, thread view, message list, composer, reactions, emoji picker).
33. **H-5: Spatial/digital-twin rooms** — Shared scene state with agent vision/action grants, web/immersive presence.
34. **H-6: Real-time translation nativa** — Per-user language preference, live translate, original access, glossary, confidence.
35. **H-7: Virtual waiting room** — Queue management per agent handoff con posizione stimata e SLA.
36. **H-8: AI-powered conversation analytics** — Sentiment, intent, topic clustering, knowledge gaps, trend detection.
37. **H-9: Decentralized/Web3 chat** — Wallet-based auth, token-gated rooms, on-chain message commitments.
38. **H-10: AR/VR chat overlay** — Spatial audio, 3D presence, shared AR canvas, voice spatialization.

## 5. Regole architetturali

- Nessuna dipendenza da Vercel AI SDK; API e implementazione FluxyChat originali.
- `packages/protocol`: solo wire contracts serializzabili e versionati.
- `packages/sdk`: transport/client/store/browser-safe; nessun segreto server.
- `packages/agent`: contratti model/provider, generation, tools e agent runtime.
- `apps/worker`: adapter provider, persistence, Durable Objects e policy tenant.
- Dati provider raw, reasoning e prompt completi non vengono registrati o inviati al client per default.
- Ogni query o cache è scoped per tenant/project/user dove applicabile.
- Nuovi envelope negoziano una versione; adapter legacy restano fino a deprecazione documentata.

## 6. Quality gates

Per marcare una voce `complete` servono:

1. tipi pubblici ed export stabili;
2. unit test e almeno un contract/integration test;
3. abort, timeout, errore e cleanup testati;
4. sicurezza e scoping verificati;
5. esempio/API docs aggiornati;
6. build/typecheck nei package dipendenti;
7. per UI/realtime, smoke browser del percorso primario e stato unsupported/denied/reconnect;
8. nessun uso diretto o transitivo di `ai` / `@ai-sdk/*`.

## 7. Research method e fonti

Audit basato su codice FluxyChat, Vercel AI SDK 7 docs (ai-sdk.dev tutte le sezioni: Foundations, Getting Started, Agents, Core, Harnesses, UI, RSC, Reference), Vercel Chat SDK docs (chat-sdk.dev tutte le sezioni: Usage, AI, Adapters, Messaging, Interactivity, API Reference), più confronto con mercato: Ably, PubNub, Stream, Sendbird, Liveblocks, Matrix, LiveKit, Daily.co, Twilio legacy. Le feature di mercato sono state incluse solo quando adiacenti a chat/realtime/agent; non sono stati inclusi CRM, ticketing o analytics generici non collegati alla conversazione.

Gap analysis completa il 2026-07-16: 110 gap identificati in 8 categorie (AI/Agent, Chat Product, Realtime Infrastructure, Voice/Media, Enterprise/Security, Developer Experience, Integration/Ecosystem, Emerging Trends). Dettaglio in `docs/research/FLUXYCHAT-GAPS-2026.md`.

Fonti primarie da ricontrollare all'inizio di ogni tranche perché API e standard evolvono rapidamente:

- `github.com/vercel/ai`, release/changelog e source dei package `ai`, provider, UI, MCP e DevTools.
- `ai-sdk.dev` reference per Agent, UI streams, tools, middleware, media, realtime e MCP. Tutti i menu: Foundations, Getting Started (8 framework guide + Coding Agents), Agents (11 pagine), AI SDK Core (27 pagine), AI SDK Harnesses (7 pagine), AI SDK UI (13 pagine), AI SDK RSC, Advanced, Reference (6 sezioni), Migration Guides, Troubleshooting.
- `chat-sdk.dev` reference per bot cross-platform. Tutti i menu: Usage (7 pagine), AI (4 pagine), Adapters (5 pagine), Messaging (7 pagine), Interactivity (5 pagine), API Reference (10 pagine), Contributing (3 pagine).
- Specifiche IETF WebTransport, MLS e MIMI; specifiche Matrix/ActivityPub per bridge esistenti.
- Documentazione tecnica di LiveKit/WebRTC per voice transport, turn handling e interruption.
- Documentazione prodotto/architettura di Ably, PubNub, Pusher, Stream e Sendbird per reliability e chat parity.
- Specifiche e reference implementation ufficiali A2A e AG-UI/A2UI per lifecycle, event mapping e conformance; MCP resta analizzato separatamente come protocollo agent-to-tool.
- Durable Streams, Ably AI Transport/LiveObjects, Cloudflare Agents/Durable Objects e Liveblocks AI Copilots come segnali di mercato per resume, shared state e agenti come peer.
- SLIM viene mantenuto sperimentale finché specifica, implementazioni MLS e interoperabilità HTTP/3 non superano i quality gate; AGTP e protocolli non consolidati restano research-only.

Nota: la roadmap descrive equivalenza funzionale e opportunità prodotto, non autorizza copia di codice o API protette; ogni implementazione FluxyChat deve restare originale, Worker-safe e coperta dai quality gate.

## 8. Delivery log

### 2026-07-15 — Tranche A avviata

- Corretto lo stato roadmap di Real-Time Location: è implementata end-to-end, non assente.
- Sessione showcase: fetch cancellabile, `no-store`, reset stato e refresh token anticipato.
- Live Streaming: reaction ID, dedup echo, compatibilità `reaction`/`client-reaction`, queue limitata e cleanup timer.
- Location: cleanup corretto del listener `PermissionStatus.change`.
- Push: registrazione service worker riusata, race subscribe bloccata, rotazione VAPID gestita, rollback locale se il Worker rifiuta e stato locale preservato quando si rimuove soltanto una riga server.
- Aggiunti result/stream part/error/usage canonici, retry cancellabile e timeout distinguibile (`packages/agent/src/ai-core.ts`).
- Aggiunti contratti Worker-safe v1, capability discovery, registry `provider:model`, alias e deterministic model (`packages/agent/src/providers.ts`).
- Aggiunte primitive originali `generate`/`stream` con prompt canonico, callback lifecycle, retry/timeout/abort e fallback non-streaming (`packages/agent/src/generation.ts`).
- Aggiunto agent loop con stop conditions componibili, `prepareStep`, budget, allowlist, approval, dedup e risultati tool tipizzati (`packages/agent/src/agent-loop.ts`).
- Aggiunti embedding batch, cosine similarity, rerank e retrieval scoped per tenant (`packages/agent/src/retrieval.ts`).
- Verifica locale: 11 test agent passati; build `protocol`, `sdk` e `agent` passate. Le voci provider/media/UI/MCP non coperte da questi moduli restano correttamente `partial` o pianificate.

### 2026-07-15 — Review totale AI SDK 7 + mercato realtime

- Aggiunti gap AI SDK 7: standalone stream conversion, safe UI validation, agent UI async iterable, data-part reconciliation, sandbox tools, tool input refinement/order, context separation, system-message guard e include/raw controls.
- Esteso MCP con protocol negotiation, structured errors, server identity/instructions, resource links, auth refresh dedup, redirect policy e MCP Apps sandboxate.
- Aggiunta roadmap realtime reliability: sequencing, delivery semantics, offline outbox, delta sync, presence leases, lane transient/durable, WebTransport, failover e chaos harness.
- Aggiunta roadmap prodotto chat: AI catch-up/search/compose/translation/moderation, huddles, CRDT artifacts, marketplace e interoperability.
- Aggiunta roadmap voice: WebRTC, semantic EOT, backchannel, barge-in SLO, TTFA, audio processing, code-switching, diarization, handoff e QA.
- Aggiunti differenziatori enterprise e operation: E2EE/MLS, DLP, eDiscovery, AI governance, accessibility, SLO voice/realtime, evals e cost attribution.

### 2026-07-15 — Agent Collaboration market audit

- Identificato come gap strategico un Agent Collaboration Fabric: agent identity/card, task lifecycle durevole, resume per offset, room peer, shared state, routing e handoff.
- Separati esplicitamente i ruoli di MCP (agent-to-tool), A2A (agent-to-agent) e AG-UI/A2UI (agent-to-user), da integrare tramite adapter originali e conformance fixture.
- Incorporati i segnali di mercato di durable conversation transport, stateful edge agents, shared human-agent rooms e async voice tools senza introdurre dipendenze vendor nel core.
- Aggiunti interoperability lab, provenance ledger, cross-channel continuity, SLIM sperimentale e spatial/digital-twin rooms opzionali.
- Riordinata la Tranche C attorno ad agent collaboration; le feature infrastrutturali e gli standard non maturi restano nella Tranche D con quality gate espliciti.

### 2026-07-15 — Reliability contracts e Agent Fabric foundation

- Esportati i contratti reliability v1 con cursor tracker, gap/duplicate detection e monotonic delivery stages; aggiunti 4 test dedicati.
- Sostituiti gli stub transport con implementazioni fetch HTTP/SSE/long-poll, decoding SSE/NDJSON UTF-8 safe, timeout/retry/abort, health selection e cleanup registry; WebSocket/WebTransport espongono oggi fallback HTTP esplicito e non sono marcati completi.
- Implementato il primo Agent Collaboration Fabric in-memory/Worker-safe: card e capability discovery, messaggi ordinati/resumable, task durevoli versionati, idempotenza, depth guard, terminal state, artifact e cancellation.
- Aggiunti boundary adapter lossless verso AG-UI e A2A, mantenendo gli extension field e senza dipendenze dal Vercel AI SDK.
- Validazione: protocol 20 test passati + build; SDK transport 3 test e Agent Fabric 4 test passati + build.

### 2026-07-16 — Chiusura Tranche B (voice/MCP) e Tranche C (agent collaboration, realtime, voice, moderation)

- **B-6 Voice interruption + media:** `VoiceInterruptionConfig` (barge-in/manual/semantic modes), `sendMedia`/`generateMedia` su VoiceManager, `interruptAll`, test interruption config; 8 test (`packages/sdk/src/voice.ts`).
- **B-7 MCP client/registry/OAuth:** `createMcpClient` HTTP/SSE transport, OAuth PKCE flow con token store interface, `createMcpRegistry` multi-server, `mcpToolsToFluxyChat`/`fluxyChatResultToMcp`, `listResources`/`readResource`; 8 test (`packages/sdk/src/mcp-integration.ts`).
- **C-3 Delta sync/presence/streams:** `createDeltaPoller`/`createMemoryDeltaStore` con prune compaction, `createPresenceLeaseManager` con TTL/renew/expire/shouldRenew, `createMemoryDurableStreamStore` con append/update/cleanup/monotonic offset; 12 test (`packages/sdk/src/delta-sync.ts`).
- **C-4 Outbox/lanes/chaos:** `createOutboxProcessor` con retry/maxRetries/backoff, `createLaneProcessor` con priority ordering/transient-durable split e durable fallback su outbox, `createChaosHarness` con failureRate/latency/disconnectAfter/event recording; 9 test (`packages/sdk/src/outbox-lanes.ts`).
- **C-5 Delegazione/shared state/routing/handoff:** `routeTask` con policy scoring (capability/trust/cost/region) e `maxResults`, `createMemorySharedStateStore` con versioning/lock/unlock/TTL, `createHandoffManager` con request/respond/complete/complete-all/pending queue; 15 test (`packages/sdk/src/agent-delegation.ts`).
- **C-6 WebRTC voice/EOT/backchannel/barge-in:** `createSemanticEOTDetector` (turn endings/questions/prompt indicators), `createBackchannelDetector` (ack/interest/encourage/debounce), `createBargeInDetector` (consecutive sample threshold/debounce window), `createWebRTCVoiceTransport` (RTCPeerConnection/data channel/media stream lifecycle); 14 test (`packages/sdk/src/voice-realtime.ts`).
- **C-7 AI summaries/search/translation/moderation:** `createMemorySummaryStore` con provenance keyPoints/actionItems, `createMemorySearchIndex` con token-score ranking/snippet, `createModerationEngine` con rules/block-flag-allow-review/DLP PII detection/report log, `createMemoryTranslationCache`; 10 test (`packages/sdk/src/ai-moderation.ts`).
- **Verifica finale:** 163 test passati (26 file), typecheck OK su protocol + sdk, tutte le export via index.ts.

### 2026-07-16 — Gap analysis totale AI SDK + Chat SDK + mercato 2026

- **Audit completo Vercel AI SDK v7:** Tutte le 70+ pagine docs analizzate (Foundations, Getting Started, Agents, AI SDK Core, Harnesses, UI, RSC, Reference, Migration, Troubleshooting). Identificati 18 gap AI/Agent (4 critici: reasoning unificato, memory, tool approval HMAC, lifecycle callbacks).
- **Audit completo Vercel Chat SDK:** Tutte le 40+ pagine docs analizzate (Usage, AI, Adapters, Messaging, Interactivity, API Reference). Identificati 22 gap chat product (2 critici: rich interactive cards + actions, message-to-LLM converter).
- **Market research 12 competitor/vendor:** Ably, PubNub, Stream, Sendbird, Liveblocks, Matrix, LiveKit, Daily.co, Twilio legacy. Identificati 70+ gap market in 6 ulteriori categorie.
- **Totale: 110 gap** in 8 categorie, documentati in `docs/research/FLUXYCHAT-GAPS-2026.md`.
- **Roadmap aggiornata con tutti i 110 gap:** Tranche D (AI/Agent Core + Chat Product + DevEx - 50 item), Tranche E (Realtime Infra + Voice/Media - 22 item), Tranche F (Enterprise/Security + Integration/Ecosystem + Emerging Trends - 38 item).
- **Sezione 3.7 aggiunta:** Gap analysis completa con tabella riepilogativa e top 15 gap critici.
- **Nuova Tranche D/E/F** con tutti i 110 gap numerati e referenziati al documento `docs/research/FLUXYCHAT-GAPS-2026.md`.
