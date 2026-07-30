# Vercel Chat SDK Feature Gap Analysis

**Date:** 2026-07-01  
**Analyst:** Fluxychat (subagent)  
**Scope:** Systematic comparison of Vercel Chat SDK (`docs/research/chat-main-vercel/`) vs FluxyChat  
**Method:** Read all core source files in Vercel project, compared against FluxyChat's `packages/sdk/src/` and `apps/worker/src/lib/`

---

## Summary

P22-P25 already adopted most Vercel patterns. The remaining gaps are **convenience APIs**, **adapter lifecycle methods**, and **developer experience tooling** — not major architectural shifts. The most impactful are the unified `chat.thread()`/`chat.openDM()` API, the `PostableObject` formal interface, and the `create-chat-sdk` CLI scaffolding tool.

---

## Findings

### 1. Unified Chat-level API (`chat.thread()`, `chat.channel()`, `chat.openDM()`, `chat.getUser()`)

- **Vercel file:** `packages/chat/src/chat.ts` (lines ~600-700)
- **What it does:** Top-level methods on the Chat instance that auto-infer the adapter from ID format (Slack `U...`, Teams `29:...`, Discord snowflake, etc.) and return Thread/Channel objects. `openDM()` opens a direct message by user ID. `getUser()` looks up user info (email, avatar) across platforms.
- **Why it matters for FluxyChat:** Currently there's no unified way to get a Thread or Channel by ID without knowing which adapter handles it. This makes cross-platform operations (e.g., "send a DM to user X on whatever platform they're on") impossible without manual adapter lookup. The `inferAdapterFromUserId()` logic is clever — it pattern-matches user IDs to adapters.
- **Effort estimate:** S
- **Suggested priority:** HIGH

### 2. `getParticipants()` on Thread

- **Vercel file:** `packages/chat/src/types.ts` (Thread interface), `packages/chat/src/thread.ts`
- **What it does:** Scans all messages in a thread and returns deduplicated non-bot authors. Used for subscribe/unsubscribe logic: subscribe when 1:1, unsubscribe when others join.
- **Why it matters for FluxyChat:** Agent runtime could use this to decide whether to auto-respond (1:1) or stay silent (group chat). Currently we'd have to fetch messages and filter manually.
- **Effort estimate:** S
- **Suggested priority:** HIGH

### 3. `mentionUser(userId)` on Thread/Postable

- **Vercel file:** `packages/chat/src/types.ts` (Postable interface)
- **What it does:** Returns a platform-specific mention string (e.g., `<@U123>` for Slack, `<@!123>` for Discord). Available on both Thread and Channel.
- **Why it matters for FluxyChat:** AI agents frequently need to mention users in responses. Currently there's no platform-agnostic way to format mentions. Each adapter handles mentions differently.
- **Effort estimate:** S
- **Suggested priority:** HIGH

### 4. `PostableObject` Formal Interface

- **Vercel file:** `packages/chat/src/postable-object.ts`, `packages/chat/src/plan.ts`, `packages/chat/src/streaming-plan.ts`
- **What it does:** A formal interface with `$$typeof` symbol, `kind`, `isSupported(adapter)`, `getPostData()`, `getFallbackText()`, `onPosted(context)`. Objects implementing this (Plan, StreamingPlan) can be passed to `thread.post()` and the adapter handles them specially. The `$$typeof` symbol prevents spoofing.
- **Why it matters for FluxyChat:** We have `plan.js` and `streaming-plan.js` but no formal `PostableObject` interface. This pattern enables third-party extensions to create postable objects (polls, forms, interactive cards) without modifying core code. The `isSupported()` method lets objects gracefully degrade on adapters that don't support them.
- **Effort estimate:** S
- **Suggested priority:** HIGH

### 5. Standardized Adapter Error Hierarchy

- **Vercel file:** `packages/adapter-shared/src/errors.ts`
- **What it does:** `AdapterError` base class with `adapter` name and `code` field. Subclasses: `AdapterRateLimitError` (with `retryAfter`), `AuthenticationError`, `ResourceNotFoundError` (with `resourceType`, `resourceId`), `PermissionError` (with `action`, `requiredScope`), `ValidationError`, `NetworkError` (with `originalError`).
- **Why it matters for FluxyChat:** We have `structured-errors.js` and `errors.ts` but they're generic. Adapter-specific errors with structured fields enable programmatic error handling: catch `AdapterRateLimitError` and respect `retryAfter`, catch `PermissionError` and show the required scope to the user. Currently adapter errors are just strings.
- **Effort estimate:** S
- **Suggested priority:** HIGH

### 6. Token Encryption (AES-256-GCM) for OAuth Tokens

- **Vercel file:** `packages/adapter-shared/src/crypto.ts`
- **What it does:** `encryptToken()`/`decryptToken()` using AES-256-GCM with random 12-byte IV per encryption. `decodeKey()` accepts hex or base64. Used by Slack and Linear adapters to encrypt stored OAuth tokens.
- **Why it matters for FluxyChat:** We have `secrets-crypto.js` but it's not used for OAuth token encryption in adapters. Multi-workspace Slack and Linear adapters need to store tokens securely. This is a proven, audited pattern.
- **Effort estimate:** S
- **Suggested priority:** HIGH

### 7. `reviver()` for JSON.parse with `_type` Discriminator

- **Vercel file:** `packages/chat/src/reviver.ts`, `packages/chat/src/chat.ts` (`chat.reviver()`)
- **What it does:** A JSON.parse reviver function that automatically deserializes `chat:Thread` and `chat:Message` objects from plain JSON. Thread uses lazy adapter resolution via Chat singleton.
- **Why it matters for FluxyChat:** When passing thread/message data to workflow engines, external systems, or D1 storage, objects lose their class methods. A reviver restores them automatically. Currently in FluxyChat, deserialization is manual and error-prone.
- **Effort estimate:** S
- **Suggested priority:** HIGH

### 8. `waitUntil` Pattern for Webhook Background Processing

- **Vercel file:** `packages/chat/src/types.ts` (WebhookOptions), `packages/chat/src/chat.ts`
- **What it does:** `waitUntil: (task: Promise<unknown>) => void` option on webhook handlers. Registers background promises so serverless platforms (Vercel, Next.js `after()`) don't kill them when the HTTP response is sent. The Chat class tracks these and swallows errors.
- **Why it matters for FluxyChat:** Our webhook handlers fire-and-forget background work. On Cloudflare Workers, `ctx.waitUntil()` serves the same purpose but isn't abstracted. A `waitUntil` option would make adapters portable across serverless platforms.
- **Effort estimate:** S
- **Suggested priority:** MEDIUM

### 9. `fetchChannelMessages()` and `listThreads()` on Adapter

- **Vercel file:** `packages/chat/src/types.ts` (Adapter interface)
- **What it does:** `fetchChannelMessages()` fetches top-level (non-threaded) messages in a channel. `listThreads()` lists threads in a channel with `ThreadSummary` (id, rootMessage, replyCount, lastReplyAt).
- **Why it matters for FluxyChat:** Currently we can only fetch messages within a thread. Channel-level operations enable: "show all threads in #general", "find the last message in #support", "list active threads". This is essential for moderation and analytics.
- **Effort estimate:** M
- **Suggested priority:** MEDIUM

### 10. `postChannelMessage()` on Adapter

- **Vercel file:** `packages/chat/src/types.ts` (Adapter interface)
- **What it does:** Posts a top-level message to a channel (not as a thread reply). Distinct from `postMessage()` which posts in a thread.
- **Why it matters for FluxyChat:** AI agents may need to post announcements or alerts to a channel top-level, not as a reply in an existing thread. Currently all posting is thread-scoped.
- **Effort estimate:** S
- **Suggested priority:** MEDIUM

### 11. `postEphemeral()` with `fallbackToDM` Pattern

- **Vercel file:** `packages/chat/src/types.ts` (Postable interface, PostEphemeralOptions)
- **What it does:** Posts a message visible only to a specific user. `fallbackToDM: true` falls back to DM when native ephemeral isn't supported (Discord, Teams). Returns `EphemeralMessage` with `usedFallback: boolean`.
- **Why it matters for FluxyChat:** We have `ephemeral-messages.js` but no graceful fallback. On platforms without native ephemeral, the message silently fails. The `fallbackToDM` pattern ensures the user always sees the message.
- **Effort estimate:** S
- **Suggested priority:** MEDIUM

### 12. `rehydrateAttachment()` on Adapter

- **Vercel file:** `packages/chat/src/types.ts` (Adapter interface)
- **What it does:** Reconstructs `fetchData` closure on an attachment after deserialization. When messages are JSON-roundtripped through the state adapter (for queue/debounce), `fetchData` (a closure) is lost. Adapters store metadata (`fetchMetadata`) to rebuild the closure.
- **Why it matters for FluxyChat:** Our concurrency strategies (queue, debounce) serialize messages through D1/KV. Attachments with binary data lose their fetch closures. Without rehydration, queued messages with images/files can't access attachment data.
- **Effort estimate:** S
- **Suggested priority:** MEDIUM

### 13. `disconnect()` Lifecycle on Adapter

- **Vercel file:** `packages/chat/src/types.ts` (Adapter interface), `packages/chat/src/chat.ts` (`shutdown()`)
- **What it does:** Optional cleanup hook called when Chat instance shuts down. Adapters can close WebSocket connections, release resources, flush buffers.
- **Why it matters for FluxyChat:** Our adapters don't have a cleanup lifecycle. WebSocket connections, Slack Socket Mode connections, and other long-lived resources may leak on shutdown/restart.
- **Effort estimate:** S
- **Suggested priority:** MEDIUM

### 14. `onThreadSubscribe()` Hook on Adapter

- **Vercel file:** `packages/chat/src/types.ts` (Adapter interface)
- **What it does:** Optional hook called when a thread is subscribed to. Adapters can set up platform-specific subscriptions (e.g., Google Chat Workspace Events, Slack thread subscriptions).
- **Why it matters for FluxyChat:** When an agent subscribes to a thread, the adapter may need to register with the platform's API to receive future messages. Currently subscription is only tracked in state, not with the platform.
- **Effort estimate:** S
- **Suggested priority:** LOW

### 15. Channel Abstraction with `threads()` Iterator

- **Vercel file:** `packages/chat/src/types.ts` (Channel interface), `packages/chat/src/channel.ts`
- **What it does:** `Channel.threads()` returns `AsyncIterable<ThreadSummary>` — lazily paginated, most recently active first. `Channel.messages` iterates channel-level messages newest first. `Channel.fetchMetadata()` returns `ChannelInfo` (name, memberCount, visibility, isDM).
- **Why it matters for FluxyChat:** We don't have a Channel abstraction separate from Thread. Channels are useful for: listing threads in a channel, posting channel-level messages, fetching channel metadata. Currently everything is room-scoped.
- **Effort estimate:** M
- **Suggested priority:** LOW

### 16. `create-chat-sdk` CLI Scaffolding Tool

- **Vercel file:** `packages/create-chat-sdk/src/` (full CLI with commander, interactive prompts, template generation)
- **What it does:** `npx create-chat-sdk my-bot --adapter slack teams redis` scaffolds a new bot project: generates `package.json`, Next.js routes, webhook handlers, `.env.example`, README, TypeScript config. Supports npm/yarn/pnpm/bun. Detects coding agent environments (Claude Code) and auto-skips prompts. Includes SKILL.md files for AI agents.
- **Why it matters for FluxyChat:** No equivalent scaffolding tool. New FluxyChat projects require manual setup. A CLI would dramatically reduce onboarding friction — `npx create-fluxy-chat my-app --adapter slack` should generate a working bot in 30 seconds.
- **Effort estimate:** M
- **Suggested priority:** MEDIUM

### 17. Multi-framework Web Adapter (React/Vue/Svelte)

- **Vercel file:** `packages/adapter-web/src/react/`, `vue/`, `svelte/`
- **What it does:** Framework-specific integrations for the Web adapter. React, Vue, and Svelte components that connect to the same backend.
- **Why it matters for FluxyChat:** We only have React (`use-fluxy-chat.ts`). Vue and Svelte support would expand our market. The adapter pattern means the backend is framework-agnostic.
- **Effort estimate:** M
- **Suggested priority:** LOW

### 18. `chat-singleton` Pattern for Thread Deserialization

- **Vercel file:** `packages/chat/src/chat-singleton.ts`
- **What it does:** Global singleton registration so `ThreadImpl.fromJSON()` can resolve adapters without explicit Chat instance. `chat.registerSingleton()` sets it up.
- **Why it matters for FluxyChat:** When deserializing threads from D1/KV storage, we need adapter access. Currently this requires passing the Chat/worker context everywhere. A singleton simplifies this.
- **Effort estimate:** S
- **Suggested priority:** LOW

### 19. Integration Test Emulator Framework

- **Vercel file:** `packages/integration-tests/src/emulator/` (Slack, GitHub emulators)
- **What it does:** Platform emulators that simulate webhook events, API responses, and WebSocket interactions. Tests run against the emulator, not real APIs. Includes OAuth flow simulation, block actions, reactions, file uploads, scheduled messages, multi-workspace scenarios.
- **Why it matters for FluxyChat:** Our tests use `mock-adapter.js` but don't emulate platform-specific behavior. An emulator framework would catch adapter bugs before production. The replay-based test pattern (`replay-*.test.ts`) is also valuable — record real webhook payloads, replay them in tests.
- **Effort estimate:** L
- **Suggested priority:** LOW

### 20. `AsyncLocalStorage` for Per-Request Context (Web Adapter)

- **Vercel file:** `packages/adapter-web/src/als.ts`
- **What it does:** Uses Node.js `AsyncLocalStorage` to provide per-request context (SSE writer, abort signal, user ID) without explicit parameter threading. `postMessage()`, `stream()`, etc. access the current request's writer via `requireWebRequestContext()`.
- **Why it matters for FluxyChat:** Our web adapter passes context explicitly. ALS eliminates parameter threading and prevents context leaks in concurrent requests. This is especially useful when handlers call `thread.post()` deep in the call stack — they don't need to know about the SSE writer.
- **Effort estimate:** S
- **Suggested priority:** LOW

### 21. `ScheduledMessage` with `cancel()` on Adapter

- **Vercel file:** `packages/chat/src/types.ts` (ScheduledMessage interface)
- **What it does:** `thread.schedule(message, { postAt: Date })` returns a `ScheduledMessage` with `cancel()`. Currently only Slack supports this natively via `chat.scheduleMessage`.
- **Why it matters for FluxyChat:** We have `scheduled-messages.js` and `scheduled-runners.js` but no adapter-level scheduling abstraction. An adapter interface for scheduling would let agents schedule messages on any platform (with fallback to setTimeout for platforms without native support).
- **Effort estimate:** S
- **Suggested priority:** LOW

### 22. `fetchSubject()` on Adapter

- **Vercel file:** `packages/chat/src/types.ts` (Adapter interface)
- **What it does:** Fetches subject metadata for a message — used by GitHub adapter to return issue/PR metadata (title, status, assignee, labels, url). Returns `MessageSubject` with type, id, title, status, assignee, labels, url.
- **Why it matters for FluxyChat:** When an agent responds in a GitHub issue or Linear ticket thread, having subject metadata gives context: "This is issue #123: Fix login bug, assigned to Alice, status: open". Currently we don't fetch this context.
- **Effort estimate:** S
- **Suggested priority:** LOW

### 23. `getChannelVisibility()` on Adapter

- **Vercel file:** `packages/chat/src/types.ts` (Adapter interface, ChannelVisibility type)
- **What it does:** Returns whether a channel is `private`, `workspace`, `external`, or `unknown`. Distinguishes between private channels, public channels, and externally shared channels (e.g., Slack Connect).
- **Why it matters for FluxyChat:** Agents may behave differently in private vs public channels. Compliance features may need to redact messages in external channels. Currently we don't track channel visibility.
- **Effort estimate:** S
- **Suggested priority:** LOW

### 24. `isDM()` on Adapter

- **Vercel file:** `packages/chat/src/types.ts` (Adapter interface)
- **What it does:** Returns whether a thread is a direct message conversation. Used for routing: DMs go to `onDirectMessage` handlers, non-DMs go through mention/pattern matching.
- **Why it matters for FluxyChat:** We don't explicitly distinguish DMs from group threads. Agent behavior should differ: DMs are always 1:1 (no need to check participants), group threads need mention detection.
- **Effort estimate:** S
- **Suggested priority:** LOW

---

## Architectural Patterns Worth Adopting

### A. Lazy Adapter Resolution for Serialized Objects

Vercel's `ThreadImpl` supports both direct adapter and lazy resolution modes. When serialized via `toJSON()` and deserialized via `fromJSON()`, it stores `adapterName` instead of the adapter instance, resolving from the Chat singleton on first access. This is cleaner than our approach of passing context everywhere.

### B. Concurrency Strategy with `skipped` Context

Vercel's queue/debounce/burst strategies pass `MessageContext` with `skipped: Message[]` and `totalSinceLastHandler` to handlers. This lets handlers know what messages were skipped while they were processing. FluxyChat's concurrency doesn't provide this context.

### C. `ChatInstance` Internal Interface

Vercel's `ChatInstance` interface defines what the Chat class exposes to adapters: `processMessage()`, `processAction()`, `processReaction()`, `processModalSubmit()`, `processSlashCommand()`, etc. This clean separation between public API and adapter-facing API is good architecture. FluxyChat doesn't have this formal separation.

### D. Message Deduplication with TTL

Vercel deduplicates messages using `setIfNotExists` with a 5-minute TTL. Same message arriving via multiple paths (Slack `message` + `app_mention`, GChat direct + Pub/Sub) is handled once. FluxyChat has `client-message-id.js` but the TTL and `setIfNotExists` atomic pattern is worth verifying.

### E. `fallbackStreamingPlaceholderText` Config

Vercel lets you configure the placeholder text (`"..."` by default) or set it to `null` to wait until real text arrives before posting. This is a small UX detail that matters: some platforms show "..." briefly which looks broken. FluxyChat doesn't have this config.

---

## Not Gaps (FluxyChat Already Has or Does Better)

- Real-time WebSocket rooms (FluxyChat superior with Durable Objects)
- Multi-tenancy (FluxyChat superior with project isolation)
- Agent system (FluxyChat superior with CRUD, tool calling, streaming)
- SSO/SAML/SCIM, Compliance/GDPR, Billing, Voice, E2E encryption, MCP server
- Streaming markdown renderer (P22-B done)
- Card builder (P22-C done)
- AI tool presets (P22-D done)
- mdast AST (P22-E done)
- Concurrency strategies (P22-D3 done)
- Transcripts, callback URLs, modals, lock scope, identity resolver (P22-F done)
- All P23/P24/P25 items (done or TODO as marked)
