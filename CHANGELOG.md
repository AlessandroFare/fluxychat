# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### P22 — Vercel Chat SDK Patterns Adoption (2026-07-01)

#### Added

- **Adapter pattern (P22-A):** `Adapter<TRawMessage>` interface with `handleWebhook`, `parseMessage`, `postMessage`, `editMessage`, `deleteMessage`, `stream`, `encodeThreadId`, `decodeThreadId`, `formatConverter`. 14 platform adapters: Web, Slack, Teams, Discord, Telegram, WhatsApp, Google Chat, GitHub, Linear, Matrix, Resend, IRC, Twitch, Line, API.
- **WebAdapter (P22-A2):** Wraps existing WebSocket + REST + SSE flow into the adapter interface. Registered at worker startup.
- **FormatConverter (P22-A3):** Canonical mdast ↔ platform format conversion (Slack mrkdwn, Teams Adaptive Cards, plain text, web markdown).
- **Adapter catalog (P22-A4):** Static registry with metadata (slug, name, packageName, envVars, peerDeps) for discovery and onboarding.
- **StreamingMarkdownRenderer (P22-B):** Buffers chunks, tracks code fences, holds back unconfirmed table headers, heals incomplete inline markers via `remend`. Table buffering, code fence tracking, inline marker balancing, monotonic output.
- **Card element builder (P22-C):** `Card`, `Section`, `Text`, `Button`, `LinkButton`, `Actions`, `Image`, `Divider`, `Field`, `Fields`, `Table`, `CardLink` — JSX and function-call APIs. Card JSX runtime (no React dependency). Fallback text generation. React element interop.
- **AI tool presets (P22-D):** `reader`, `messenger`, `moderator` predefined tool groups. Per-tool approval gates (`needsApproval`). Concurrency strategies (`drop`, `queue`, `debounce`, `burst`, `concurrent`). Tool override system.
- **Message format (P22-E):** mdast AST as canonical message format. `StreamChunk` union type (`markdown_text | task_update | plan_update`). Thread/message serialization with `_type` discriminator. `SentMessage` factory with `.edit()`, `.delete()`, `.addReaction()`, `.removeReaction()`.
- **Cross-cutting (P22-F):** Transcripts API, custom emoji system, callback URL system, modal context serialization, lock scope abstraction, identity resolver, streaming plan, logger with child loggers, thread state with TTL, mock adapter for testing.

### P23 — Vercel AI SDK Core Features (2026-07-01)

#### Added

- **Stream resumption (P23-1):** Reconnect to active AI streams after page refresh or disconnect. Stream state persisted to D1 with TTL.
- **Human-in-the-loop approval (P23-2):** Gate sensitive tool calls behind human approval. Approval cards posted to room with Approve/Reject buttons.
- **MCP client support (P23-3):** Consume MCP tool/resource servers via HTTP, SSE, and stdio transports. Auto-conversion of MCP tools to FluxyChat tool definitions. MCP resources as LLM context.
- **Language model middleware (P23-4):** `wrapLanguageModel`, `transformParams`, `wrapGenerate`/`wrapStream` for guardrails, caching, RAG injection, logging, parameter transformation.
- **DevTools web UI (P23-5):** Visual debugging for LLM calls, tool calls, token usage, raw requests/responses. OpenTelemetry integration with GenAI semantic conventions. Per-step performance stats.
- **WorkflowAgent (P23-6):** Durable agent execution that survives deploys and restarts. State persisted to D1/KV. Typed runtime context with schema validation.
- **Sandbox support (P23-7):** Isolated environments for untrusted code execution. Portable command execution.
- **Cross-platform bot deployment (P23-8):** Slack, Teams, Discord, Telegram, WhatsApp adapters with native format rendering.
- **Bidirectional realtime voice (P23-9):** Voice-to-voice AI conversations via WebSocket. Realtime tool calling during voice sessions. Provider-agnostic realtime via AI Gateway.
- **Scoped tool context (P23-10):** Per-tool secret/config isolation. Each tool gets only the context it needs.

### P24 — Vercel AI SDK Medium Features (2026-07-01)

#### Added

- **Tool call streaming (P24-1):** Stream partial tool inputs in real-time with `onInputStart`/`onInputDelta`/`onInputAvailable` callbacks.
- **Multi-step loop control (P24-2):** `maxSteps`, `stopWhen`, `isStepCount`, `hasToolCall`, `isLoopFinished` for fine-grained agent loop control.
- **Provider-defined tools (P24-3):** Provider supplies schema/description, developer provides execute. Provider-executed tools for server-side operations.
- **Pluggable transport (P24-4):** Abstract transport layer — SSE, WebSocket, custom transports swappable at config time.
- **Typed UIMessage (P24-5):** Fully typed message objects with generic parameter for end-to-end type safety.
- **Data parts streaming (P24-6):** Stream arbitrary typed data alongside text (bookings, activities, structured results).
- **extractReasoningMiddleware (P24-7):** Surface chain-of-thought reasoning from models with thinking tokens.
- **RAG middleware (P24-8):** Pluggable retrieval-augmented generation — inject context from knowledge base into LLM calls.
- **Provider-level middleware (P24-9):** Apply middleware to all models from a provider via `wrapProvider`.
- **Image generation (P24-10):** AI-powered image generation and editing via provider APIs.
- **Speech generation (P24-11):** Text-to-speech API for converting AI responses to audio.
- **useObject hook (P24-12):** React hook for streaming structured JSON objects from LLM.
- **Structured output (P24-13):** `generateObject`/`streamObject` with Zod schema validation.
- **MCP Apps (P24-14):** Sandboxed iframe rendering of tool UIs. Model-visible vs app-only tool split.
- **Slash commands (P24-15):** Cross-platform `/command` handling for quick actions.

### P25 — Vercel AI SDK Low Features (2026-07-01)

#### Added

- **experimental_throttle (P25-1):** Configurable UI render throttle for streaming to reduce re-renders.
- **smoothStream (P25-4):** Smooth text streaming for better UX (no character-by-character flicker).
- **Ephemeral messages (P25-6):** User-only visible messages with DM fallback.
- **Cosine similarity utility (P25-7):** Built-in `cosineSimilarity(a, b)` function for embeddings.
- **Strict tool calling (P25-9):** Provider enforces valid input against schema (`strict: true`).
- **sendAutomaticallyWhen (P25-10):** Auto-submit when all tool results are available.
- **Sensitive context controls (P25-12):** Prevent secrets from appearing in telemetry.

### Other Added

- OpenAPI (`apps/worker/openapi.yaml`): documented `/health`, `POST /auth/token` (API key `X-Fluxy-Api-Key`), billing routes, GDPR export/delete, and `402`/`429` responses on `POST /messages`; cross-link to bundled smoke script in spec intro.
- OpenAPI extended further: agents (`/agents`, `/agents/{id}`, invoke, runs), upload + attachments, benchmark, compliance report, stats (`/stats/*`), webhooks (register, `{id}`, verify, Stripe), admin deliveries/replay/reports/audit/plan upsert, `PATCH`/`DELETE` `/rooms/{id}`, SSE `GET /rooms/{id}/stream`; `GET /api/messages` documented as JWT-protected.
- Dashboard: public marketing route **`/landing`** (product story, CTAs to onboarding vs console) and Header link **Product**; `vitest.config.ts` aliases for `@`/`~`; production CSS imports use package-relative paths; assorted build/type fixes (`globals.css`, lucide icon, `Input` size prop, projects button variant).
- M5-A hardening complete: auth edge-case tests, webhook retry edge tests, deploy/rollback runbook, backup/restore drill script, external alert dispatch with dedupe, admin/mod audit trail endpoint.
- M5-B docs v1 complete: use-case docs, auth/JWT cookbook, troubleshooting guide, Next.js end-to-end snippets, contract/changelog policy.
- M5-C GTM readiness complete: runtime quota enforcement, pricing guardrails in `/stats/costs`, onboarding wizard page, launch KPI endpoint (`/stats/launch-kpis`), and release materials.
- Release demo script added at `docs/release/demo-script.md`.
- Suggested release notes added at `docs/release/release-notes-v0.2.0.md`.

### Fixed

- Worker integration tests: `FakeDB` mirrors quota SQL (`INSERT OR IGNORE`, guarded increment `UPDATE`) and Stripe `UPDATE project_plans` (full bind list); `createEnv` sets `RATE_LIMIT_FALLBACK_ALLOW` for KV-less runs; Stripe webhook e2e seed uses `manually_overridden` when asserting preserved custom limits.

## 0.1.0

### Added

- Worker (Cloudflare) with WebSocket rooms via Durable Objects.
- D1 persistence for rooms/messages/memberships.
- Webhook delivery queue with retry/backoff + admin replay.
- AI agents (`/agents*`) and usage stats (`/stats/ai`).
- Operational metrics (`/stats/ops`), alert rules/events, SLO snapshot (`/stats/slo`), cost breakdown (`/stats/costs`).

