# FluxyChat Realtime + AI Roadmap

> Audit del 15 luglio 2026 contro `vercel/ai` main e AI SDK 6. Obiettivo: adottare nel core FluxyChat le capability utili a chat, agenti e realtime senza dipendere da `ai` o `@ai-sdk/*` e senza copiare codice upstream.

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
| File upload | partial | Next | signed upload, checksum, scan, retention, model conversion |
| Voice session protocol | partial | Next | provider-agnostic session/config/event contract |
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
| MCP HTTP/SSE transport | partial | Next | reconnect, timeout, cleanup |
| MCP stdio transport | n/a | — | non adatto al runtime Worker; supportabile solo tool Node separato |
| Tool discovery/schema refresh | partial | Next | cache TTL, change notification, namespace collision policy |
| Resource discovery/read | partial | Next | URI allowlist, MIME/size limits |
| Prompt discovery/get | partial | Later | argument validation e provenance |
| OAuth | partial | Later | PKCE/state, token storage/refresh, tenant isolation |
| Elicitation | missing | Later | UI approval/response schema e timeout |
| Sampling | missing | Later | policy esplicita, recursion/budget guard |
| Lifecycle cleanup | partial | Now | close transport on abort/unmount; no leaked sessions |
| Skill upload/versioning | partial | Later | manifest/schema, checksum, immutable version, rollback |

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

## 3. Ordine di implementazione

### Tranche A — Now: hardening e fondamenta

1. Chiudere audit delle quattro demo e aggiungere regression test.
2. Introdurre tipi canonici `AIUsage`, `AIFinishReason`, `AIWarning`, `AIProviderMetadata`, `AIStreamPart` e gerarchia errori.
3. Rendere abort, timeout, retry e backpressure uniformi.
4. Aggiungere deterministic test model e contract suite.
5. Adapter non-breaking tra eventi/message legacy e parts canoniche.
6. Budget, allowlist, telemetry/redaction e lifecycle tool uniformi.

### Tranche B — Next: provider, agent e UI parity

1. Registry e contratti per language/embedding/rerank/image/speech/transcription/realtime.
2. Generate/stream e structured output strategy sopra i contratti condivisi.
3. Agent loop riusabile con stop conditions, prepare step, context e delegation.
4. UI message parts, transport, optimistic retry, stop/regenerate/resume.
5. Retrieval/rerank/RAG con citations.
6. Voice interruption e transcript sync; media upload/generation.
7. MCP discovery/resources/OAuth hardening e middleware componibile.

### Tranche C — Later: estensioni avanzate

1. Video generation e async media jobs.
2. Durable multi-agent workflow, skills versionate e marketplace sicuro.
3. Voice reconnect/live tools avanzati.
4. MCP elicitation/sampling.
5. DevTools visuale, simulate streaming e Flutter parity completa.

## 4. Regole architetturali

- Nessuna dipendenza da Vercel AI SDK; API e implementazione FluxyChat originali.
- `packages/protocol`: solo wire contracts serializzabili e versionati.
- `packages/sdk`: transport/client/store/browser-safe; nessun segreto server.
- `packages/agent`: contratti model/provider, generation, tools e agent runtime.
- `apps/worker`: adapter provider, persistence, Durable Objects e policy tenant.
- Dati provider raw, reasoning e prompt completi non vengono registrati o inviati al client per default.
- Ogni query o cache è scoped per tenant/project/user dove applicabile.
- Nuovi envelope negoziano una versione; adapter legacy restano fino a deprecazione documentata.

## 5. Quality gates

Per marcare una voce `complete` servono:

1. tipi pubblici ed export stabili;
2. unit test e almeno un contract/integration test;
3. abort, timeout, errore e cleanup testati;
4. sicurezza e scoping verificati;
5. esempio/API docs aggiornati;
6. build/typecheck nei package dipendenti;
7. per UI/realtime, smoke browser del percorso primario e stato unsupported/denied/reconnect;
8. nessun uso diretto o transitivo di `ai` / `@ai-sdk/*`.

## 6. Delivery log

### 2026-07-15 — Tranche A avviata

- Corretto lo stato roadmap di Real-Time Location: è implementata end-to-end, non assente.
- Sessione showcase: fetch cancellabile, `no-store`, reset stato e refresh token anticipato.
- Live Streaming: reaction ID, dedup echo, compatibilità `reaction`/`client-reaction`, queue limitata e cleanup timer.
- Location: cleanup corretto del listener `PermissionStatus.change`.
- Push: registrazione service worker riusata, race subscribe bloccata, rotazione VAPID gestita, rollback locale se il Worker rifiuta e stato locale preservato quando si rimuove soltanto una riga server.
- Prossimo gate: test di regressione mirati, poi core result/stream/error canonico.
