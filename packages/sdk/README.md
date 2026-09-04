# @fluxy-chat/sdk

Client for a **FluxyChat Worker** (self-hosted or [FluxyChat Cloud](https://github.com/AlessandroFare/fluxychat)): rooms, messages, WebSockets, agents, and vertical SDKs.

For **React hooks** (`useChat`, `useInbox`, `FluxyRealtimeProvider`), install [`@fluxy-chat/react`](https://www.npmjs.com/package/@fluxy-chat/react) alongside this package.

The SDK talks to **your** Worker URL. It does **not** include LLM API keys; only your Fluxy **project API key** or **member JWT**.

## Install

```bash
npm install @fluxy-chat/sdk zustand
# React apps also need:
npm install @fluxy-chat/react react
# or
pnpm add @fluxy-chat/sdk @fluxy-chat/react zustand
```

**Peer dependencies:** install `react` (18+) when you use hooks from `@fluxy-chat/react`, and `zustand` (5+) for `createFluxyRoomSession` or room store helpers. The SDK has **no runtime npm dependencies** beyond protocol/types; only your Worker URL is contacted over the network ([Socket network-access note](https://socket.dev/alerts/networkAccess)).

### Bundle size

Import only what your app needs. The full `dist/index.js` artifact is ~112 KB uncompressed; tree-shaken app bundles (client + hooks via `@fluxy-chat/react`) are typically much smaller. Compare gzip size in your bundler (Vite/webpack) when evaluating against other chat SDKs.

**Industry reference:** ~14 kB gzip for a chat-only React import path in comparable hosted SDKs. FluxyChat CI gates `@fluxy-chat/react` at **≤20 kB gzip** (`pnpm run check:bundle-size`).

#### Measure in your Vite app (tree-shaken)

```bash
# From monorepo root after building packages
pnpm --filter @fluxy-chat/react build
pnpm run check:bundle-size
# → bundle-size-report.json
```

Minimal Vite consumer (copy into a scratch app):

```ts
// src/main.tsx — chat-only import path
import { useChat } from "@fluxy-chat/react";
export function App({ roomId }: { roomId: string }) {
  const { messages, sendMessage } = useChat({ roomId });
  return null;
}
```

```bash
npm create vite@latest fluxy-bundle-check -- --template react-ts
cd fluxy-bundle-check
npm i @fluxy-chat/react @fluxy-chat/sdk zustand
npm run build
# Inspect dist/assets/*.js with gzip:
npx gzip-size dist/assets/*.js
```

Monorepo script: `node scripts/analyze-sdk-bundle.mjs` reports per-entry gzip budgets. Artifact sizes are upper bounds — your app bundle after tree-shaking is usually smaller.

## Browser vs Worker runtime

| Import | Use in | Contents |
|--------|--------|----------|
| `@fluxy-chat/sdk` | Browser, Node scripts, React/React Native | `FluxyChatClient`, hooks (transitional), types, client-safe helpers |
| `@fluxy-chat/react` | React apps | `useChat`, `FluxyRealtimeProvider`, inbox hooks (re-exported from SDK during split) |
| `@fluxy-chat/sdk/worker-runtime` | Cloudflare Worker, Node agent services | Agent loop, sandbox, HITL approval store, TTS/image stubs wired on the Worker |

Do **not** import `@fluxy-chat/sdk/worker-runtime` from browser bundles — those factories expect KV/D1 and Worker APIs. The FluxyChat Worker ships its own implementations under `apps/worker/src/lib/`; the SDK subpath is for **custom Workers** that embed the same agent helpers.

Quick local smoke test (monorepo):

```bash
pnpm run first-message
```

## Errors and connection status

### Typed errors (REST + chat)

| SDK class / code | HTTP / WS | User action |
|------------------|-----------|-------------|
| `FluxyTokenExpiredError` / `token_expired` | 401, WS 1008 | Mint fresh JWT via `POST /auth/token` |
| `FluxyNotMemberError` / `not_member` | 403, WS 1008 Forbidden | Add member to room or join with correct JWT |
| `FluxyAnonymousNotAllowedError` | WS 1008 | Use authenticated JWT, not anonymous |
| `FluxyAuthError` / `auth_refused` | 401, WS 1008 | Check API key (server) or JWT claims |
| `RateLimitError` / `FluxyRateLimitError` / `RATE_LIMITED` | 429 | Wait `retryAfterMs`, backoff, reduce send rate |
| `LockError` / `FluxyLockError` / `LOCK_ACQUISITION_FAILED` | 409 | Retry send or refresh thread lock |
| `NotImplementedError` / `FluxyNotImplementedError` | 501 | Feature not on this adapter/runtime |
| `FluxyConnectionError` | WS abnormal close | Auto-reconnect; check network |
| `FluxySendError` | — | Wait until socket open or use REST fallback |

Use `describeConnectionError()` from `@fluxy-chat/sdk` for UI copy. Full troubleshooting: [Integration troubleshooting guide](https://github.com/AlessandroFare/fluxychat/blob/main/apps/docs/content/docs/guides/troubleshooting-integration.mdx).

### Connection status labels (hosted chat SDK parity)

| `status` | UI label (`getConnectionStatusLabel`) |
|----------|----------------------------------------|
| `connected` | Connected |
| `connecting` | Connecting… |
| `reconnecting` | Reconnecting in Ns… |
| `degraded` | Degraded — realtime limited |
| `degraded-http` | Degraded — HTTP fallback active |
| `blocked` | Connection blocked |
| `disconnected` | Disconnected |

```ts
import { getConnectionStatusLabel } from "@fluxy-chat/sdk";

const label = getConnectionStatusLabel(connectionState.status, {
  includeTransport: true,
  nextRetryAt: connectionState.nextRetryAt,
});
```

### Vanilla store (Vue, Solid, Node)

```ts
import { createFluxyRoomSession } from "@fluxy-chat/sdk";

const { store, stop } = createFluxyRoomSession({
  roomId: "my-room",
  client,
});

const unsub = store.subscribe((state) => {
  console.log(state.messages, state.connectionState);
});

store.getState().sendMessage("hello");
store.getState().sendMessage("", null, undefined, {
  templateId: "tpl_…",
  templateVars: { name: "Ada" },
});

// cleanup: unsub(); stop();
```

## What you must configure

| Piece | Who sets it | Notes |
|--------|-------------|--------|
| **Worker `baseUrl`** | You | e.g. `https://fluxychat-worker.<account>.workers.dev` or your custom domain |
| **Project API key** (`fc_…`) | Worker / console | Mint JWTs via `POST /auth/token` with header `X-Fluxy-Api-Key` — **server-side only** |
| **Member JWT** | Your backend or Fluxychat console | Passed to `FluxyChatClient` / `useChat` as `token` |
| **LLM provider keys** | Worker secrets or console | For agents; never embed in the npm package |

### Minimal backend (mint JWT)

```bash
curl -X POST "$WORKER_URL/auth/token" \
  -H "Content-Type: application/json" \
  -H "X-Fluxy-Api-Key: fc_your_project_key" \
  -d '{"userId":"alice","roles":["member"],"ttlSeconds":3600}'
```

Use the returned `token` in the browser.

## Quick start (React)

### Quick smoke test  run this before writing SDK code

```bash
# Set these in your shell or .env.local first.
export WORKER_URL=https://your-worker.example.workers.dev
export JWT=eyJ...                              # member JWT from /auth/token
export ROOM_ID=general

# 1. Send a message
curl -sS -X POST "$WORKER_URL/messages" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"roomId\":\"$ROOM_ID\",\"content\":\"hello from the smoke test\"}"

# 2. Read it back
curl -sS "$WORKER_URL/api/messages?roomId=$ROOM_ID&limit=1" \
  -H "Authorization: Bearer $JWT"
# Verified against @fluxy-chat/sdk@0.5.0
```

If both calls return 200 and the message id round-trips, your Worker URL, JWT, and room are wired correctly. Skip to Option A below.

### Option A — explicit client

```tsx
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useChat } from "@fluxy-chat/react";

const client = new FluxyChatClient({
  baseUrl: process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL!,
  userId: "alice",
  token: memberJwtFromYourBackend,
});

function Room({ roomId }: { roomId: string }) {
  const {
    messages,
    sendMessage,
    connectionState,
    retryMessage,
    loadMore,
    hasMore,
    isLoadingMore,
  } = useChat({ roomId, client, markReadLatest: true });
  // connectionState.nextRetryAt → "Reconnecting in 3s…"
  // messages[].deliveryStatus → pending | sent | failed
  // render messages; call loadMore() when the user scrolls to the top
}
// Verified against @fluxy-chat/sdk@0.4.2  2026-06-26
```

### Room catch-up + drafts

```ts
const catchUp = await client.getRoomCatchUp(roomId);
// { unreadCount, lastReadMessageId, firstUnreadMessageId }

await client.putRoomDraft(roomId, { content: "…", replyToId: null });
const draft = await client.getRoomDraft(roomId);

// Ephemeral message (1 hour TTL)
await client.createMessage(roomId, "self-destructs", null, undefined, undefined, {
  expiresInSeconds: 3600,
});
```

### Rooms unread + notifications

```ts
const rooms = await client.listRooms(); // may include unreadCount per room
const notes = await client.listNotifications({ unreadOnly: true });
await client.markNotificationRead(notes[0].id);
// useNotifications(client) — React hook for in-app notification inbox
```

### Public rooms — `publishableKey` (no backend)

```tsx
import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/react";

<FluxyRealtimeProvider workerUrl="https://api.example.com" publishableKey="pk_...">
  <Chat />
</FluxyRealtimeProvider>

function Chat() {
  const { messages, sendMessage } = useChat({ roomId: "general" });
}
```

The SDK mints an anonymous guest JWT. Private rooms still need a member JWT.

### Option B — `FluxyRealtimeProvider` (hosted Next.js or custom mint)

Wrap your app (or chat layout) once. The provider refreshes the member JWT before expiry and on auth errors.

```tsx
import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/react";

export function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <FluxyRealtimeProvider
      workerUrl={process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL!}
      connectUrl="/api/fluxy/connect"
    >
      {children}
    </FluxyRealtimeProvider>
  );
}

function Room({ roomId }: { roomId: string }) {
  const { messages, sendMessage, loadMore, hasMore } = useChat({ roomId });
  // …
}
```

For your own backend mint flow, pass `authTokenProvider={() => fetch("/api/chat-token").then(r => r.json())}` instead of `connectUrl`.

### Pagination

`GET /api/messages` supports a `before` cursor (`createdAt` of the oldest visible message). The SDK sorts history chronologically and exposes:

- `hasMore` — another page may exist
- `isLoadingMore` — `loadMore()` in flight
- `loadMore()` — prepends older messages

### Live snapshot (`getParticipants`)

`GET /rooms/:id/live` returns the room's Pusher-style channel stats plus a `members: [{ userId, userInfo }]` array (aggregated across shards for supergroup rooms, P10-SB8). Use it from the SDK to know "who's connected right now" without waiting for the next `presence` WS event:

```ts
const live = await client.getRoomLive("lobby");
// { occupied, online, subscriptionCount, userCount, users[], members: [{ userId, userInfo }], socketIds[] }

// Just the participants slice
const participants = await client.getRoomParticipants("lobby");

// React hook exposes a live snapshot in the store
const { live, loadLive } = useChat({ roomId: "lobby" });
await loadLive(); // refresh on demand
```

`userInfo` reflects whatever was passed in the WS `presenceInfo` query (or the JWT `name` / agent profile). For agent-typed participants, `userInfo.agentId` is set; consumers can branch on that.

### Connection resilience

`connectRoom()` (used by `useChat` / `createFluxyRoomSession`) includes:

- **Exponential backoff reconnect** — `connectionState.status`, `nextRetryAt`, `reconnectAttempt`
- **Outbound queue** — `sendJson` queues while `connecting` or `reconnecting` (cap 100 frames, 5 min TTL); flush on open. Inspect with `getOutboundQueueDepth()`.
- **Heartbeat** — client sends `{ type: "ping" }` every 25s by default; server replies `{ type: "pong" }`. Disable with `heartbeatIntervalMs: 0` on `connectRoom` options.
- **WS connect snapshot** — `replay=connect` + `replayLimit` query params; server sends `{ type: "replay", messages }` (or `history` by default). Set `replay: "off"` via `connect(roomId, { replay: "off" })` for heavy rooms.
- **REST history replay** after reconnect only if no WS snapshot arrived first (`replayHistoryOnReconnect`, default true)
- **Streaming edit batching** — rapid `edit` events with `streaming: true` are coalesced (~80ms) to reduce React re-renders during agent token streams
- **SSE / polling fallback** when reconnect attempts are exhausted (see transport fallback doc in monorepo)

```ts
const conn = client.connectRoom(roomId, {
  heartbeatIntervalMs: 25_000,
  onOutboundQueueDrop: (n) => console.warn("dropped", n),
});
```

#### Reconnect backoff defaults — FluxyChat vs Fluxy reference

`computeReconnectBackoffMs(attempt, baseMs, maxMs)` is `min(maxMs, baseMs * 2^attempt)`, capped internally at attempt ≤ 6 and bounded by `maxReconnectAttempts` (default 8). The two default profiles produce the schedule below:

| Attempt | FluxyChat default (`500ms` / `20s`) | Fluxy reference (`1s` / `8s`) |
|--------:|--------------------------------------:|--------------------------------:|
| 0       | 500 ms                                | 1 000 ms                        |
| 1       | 1 000 ms                              | 2 000 ms                        |
| 2       | 2 000 ms                              | 4 000 ms                        |
| 3       | 4 000 ms                              | 8 000 ms (capped)               |
| 4       | 8 000 ms                              | 8 000 ms                        |
| 5       | 16 000 ms                             | 8 000 ms                        |
| 6       | 20 000 ms (capped)                    | 8 000 ms                        |
| 7       | 20 000 ms                             | 8 000 ms                        |
| **Total wall time** (8 tries) | **≈ 71.5 s**              | **≈ 47 s**                      |

**Why we keep the wider window (current default)**

- **Shorter transient drops recover faster.** Mobile networks flap in the 1–3 s window; a 500 ms first step lands a reconnect before most apps show a "disconnected" toast, which is what the dashboard UX relies on (`connectionState.status` is rendered in the room header).
- **Longer outages still give up reasonably fast.** The 20 s cap means a 10-minute Worker outage costs ~30 reconnect attempts' worth of traffic, and the SSE/polling fallback (`useChat`) kicks in well before users notice.
- It's configurable per-room. Call sites that want the Fluxy-style curve set `baseBackoffMs: 1_000, maxBackoffMs: 8_000` on `connectRoom` options. See [public SDK docs](https://docs.fluxychat.com/packages/sdk).

**When to flip to the Fluxy profile**

- Heavy rooms (≥ 1k concurrent sockets) where each reconnect attempt costs meaningful origin CPU on the Worker, and you'd rather batch retries at 8 s.
- Backend-driven bots / workers where the long backoff is fine because the agent is the only writer.
- Network profiles known to be slow (satellite, intermittent VPNs) where the extra 500 ms either way is in the noise.

**When to keep the current default**

- Consumer chat UIs, mobile-first apps, anything where the user perceives the first 1–2 s after a drop.
- The dashboard, agent chat, and any room where `presenceInfo` is shown live.

```ts
// Match the Fluxy-style curve (1s base, 8s cap)
const conn = client.connectRoom(roomId, {
  baseBackoffMs: 1_000,
  maxBackoffMs: 8_000,
});
```

The current defaults favor fast recovery on mobile networks. Use `baseBackoffMs` and `maxBackoffMs` on `connectRoom` when you need the Fluxy profile instead.

## Self-host vs hosted cloud

- **Self-host:** deploy `apps/worker` from the [monorepo](https://github.com/AlessandroFare/fluxychat), run D1 migrations, set secrets. See `apps/worker/.dev.vars.example`.
- **Hosted cloud:** use the Fluxychat dashboard on Vercel; sign in with Clerk; project + API keys are provisioned for you.

Full operator docs: [docs/dashboard-integration.md](https://github.com/AlessandroFare/fluxychat/blob/main/docs/dashboard-integration.md).

## Agents

Agent invokes run on the Worker (`POST /agents/:id/invoke` or `@handle` in a room message). Configure provider keys on the Worker or per-project in the console.

- `invokeAgentRest(agentId, roomId, content, { replyTo })` — REST invoke with optional thread parent message id.
- `getAgentRuns(agentId)` — run history including `tool_calls` when tools were used.
- Live room events (WebSocket): `tool_call`, `tool_result`, `tool_error`, `agentRun` (latency, tokens, status).

### History replay (heavy rooms)

```tsx
const { messages, loadHistory, historyLoaded } = useChat({
  roomId,
  replay: "request", // skip REST + WS history on connect
});
// later: await loadHistory();
```

Default is `replay: "connect"`. Pass `replayHistoryOnReconnect: false` to `connectRoom` if you manage history yourself.

### Custom bot streaming (`FluxyMessageStream`)

For bots outside the built-in agent runtime, stream into one message row over WebSocket:

```ts
import { FluxyChatClient, FluxyMessageStream } from "@fluxy-chat/sdk";

const connection = client.connectRoom(roomId);
// connectRoom() auto-connects  no .connect() needed
const stream = new FluxyMessageStream(connection, agentUserId, { parentId: null });
stream.push("Hello ");
stream.end();
// Verified against @fluxy-chat/sdk@0.4.2  2026-06-26
```

See [docs/cookbook/bot-streaming-fluxy-message-stream.md](https://github.com/AlessandroFare/fluxychat/blob/main/docs/cookbook/bot-streaming-fluxy-message-stream.md) in the monorepo.

## Console and admin APIs (2026)

| Feature | SDK method |
|---------|------------|
| AI image generation | `generateAiImage(roomId, prompt, opts?)` — requires `AI_IMAGE_GENERATION_ENABLED` on Worker |
| Composer tool prompts | `buildDeepResearchPrompt()`, `buildWebSearchPrompt()`, `buildImageGenerationCaption()` |
| AI reply suggestions | `suggestReplies(roomId, parentId?)` |
| Thread TL;DR | `summarizeThread(messageId)` |
| Full-text search | `searchMessages({ q, roomId?, from?, to? })` |
| Unified inbox | `getInbox()`, `snoozeRoom()`, `createInboxFollowUp()` |
| Room export | `exportRoomMarkdown(roomId)`, `exportRoomPdf(roomId)` |
| Custom domains (admin) | `listCustomDomains()`, `createCustomDomain()`, … |
| Embed config (admin) | `getEmbedConfig()`, `updateEmbedConfig()` |
| Quiet hours | `getQuietHoursPreferences()`, `updateQuietHoursPreferences()` |
| Digest preferences | `getDigestPreferences()`, `updateDigestPreferences()` |
| Agent handoff | `getRoomHandoff()`, `requestRoomHandoff()`, `resolveRoomHandoff()` |
| Agent queue | `getAgentQueue()`, `claimAgentTask()`, `resolveAgentTask()` |
| Feature flags | `getFeatureFlags()` (backoff applied on room session connect) |
| Public host / embed | `getPublicHostConfig()`, `getPublicEmbedConfig()` |

Docs: [docs.fluxychat.com](https://docs.fluxychat.com) · deploy: [production setup](https://docs.fluxychat.com/docs/operations/production-setup)

## Pusher Channels parity

FluxyChat maps [Pusher Channels](https://pusher.com/docs/channels) features to rooms plus JWT. Full matrix: [Pusher Channels parity](https://docs.fluxychat.com/docs/reference/pusher-channels-parity).

| Feature | SDK API |
|---------|---------|
| Presence / subscription count | WS events: `subscription_succeeded`, `member_joined`, `member_left`, `subscription_count` |
| Cache channel | `connect(roomId, { cache: true })` |
| E2E encrypted room | `getRoomE2eKey(roomId)` + encrypted sends |
| User channel | `signIn(...)`, `connectUser()`, `connectInbox()`, `triggerUserEvent()`, `useUserChannel()` / `useInbox()` |
| Multi-room HTTP trigger | `triggerEvents({ roomIds, name, data, excludeSocketId })` |
| Exclude sender | `excludeSocketId` on trigger (no `connection.socketId` in the SDK) |
| Connection state | `connectionState`, `state_change` event |
| Global binding | `connection.onAnyEvent()` / `connection.offAnyEvent()`, `useChat({ onAnyEvent })` |
| Watchlist | `listWatchlist()`, `addWatchlistTarget()`, `removeWatchlistTarget()` |
| Terminate connections | `terminateUserConnections(userId)` |
| Public room | Room `type: "public"` — any project member may connect (JWT still required) |

```ts
// signIn() mints a member JWT using the apiKey configured on the client
const signed = await client.signIn({ userId: "alice", roles: ["member"], ttlSeconds: 3600 });
// For React: prefer the `useUserChannel` hook  it wraps the WS lifecycle.
// For non-React: use `client.connectUser()` directly (returns a raw WebSocket).
const userWs = client.connectUser(signed.userId);
userWs.onmessage = (event) => console.log("user-channel:", event.data);

await client.triggerEvents({
  roomIds: ["lobby", "scores"],
  name: "leaderboard",
  data: { top: 3 },
});

// onAnyEvent lives on the room connection, not the client
const conn = client.connectRoom("lobby");
conn.onAnyEvent((type, payload) => {
  if (type.startsWith("client-")) return;
});
// Verified against @fluxy-chat/sdk@0.4.2  2026-06-26
```

```tsx
import { useUserChannel } from "@fluxy-chat/sdk";

function Inbox({ userId }: { userId: string }) {
  const { events, connectionState } = useUserChannel({ userId });
  // …
}
```

### Sendbird, Sent, and remaining Pusher gaps

See [messaging parity checklist](https://docs.fluxychat.com/docs/reference/messaging-parity-checklist).

| Feature | SDK API |
|---------|---------|
| Live channel stats | `getRoomLive(roomId)` |
| Pin message | `pinMessage(roomId, messageId \| null)` |
| Terminate one socket | `terminateRoomConnection(roomId, socketId)` |
| Poll message | `createPoll()`, `votePoll()`, `getPoll()` — WS `poll_updated` |
| Block user (global) | `blockUser()`, `unblockUser()`, `listBlocks()` |
| Guest open channel | `FluxyChatClient.joinPublicRoomAsGuest(baseUrl, roomId)` |
| Pusher channel auth | `authorizeChannel(socketId, roomIdOrChannel)` |
| Message translation | `translateMessage(messageId, targetLang, sourceLang?)` |
| Delivery receipts | `markMessageDelivered()`, `getMessageDeliveries()` — WS `delivery_updated` |
| FCM push devices | `registerPushDevice()`, `unregisterPushDevice()`, `listPushDevices()` |
| Sent contact sync | `syncSentContact(e164, userId?)` |
| SMS OTP login | `FluxyChatClient.requestSmsOtp()` / `verifySmsOtp()` (API key) |
| Supergroup shards | `PATCH /rooms/:id` `{ shardCount: 4 }` — see `docs/supergroup-room-sharding.md` |

```ts
const guest = await FluxyChatClient.joinPublicRoomAsGuest(workerUrl, "lobby");
const guestClient = new FluxyChatClient({
  baseUrl: workerUrl,
  userId: guest.userId,
  token: guest.token,
});
const channelAuth = await client.authorizeChannel(socketId, "private-room-lobby");
await client.translateMessage(messageId, "it");
await client.markMessageDelivered(messageId);
await client.registerPushDevice("fcm", fcmToken);
```

## Architecture features

FluxyChat includes a full-stack adapter system, streaming markdown renderer, card builder, and AI tool presets for multi-platform chat deployments.

| Feature | What it does |
|---------|-------------|
| **Multi-platform adapters** | Pluggable adapter system (Web, WhatsApp, Telegram, Slack, Discord, Teams, Email, SMS, Webhook, Matrix) with unified thread ID encoding and channel mapping |
| **Streaming markdown** | Real-time markdown rendering with table buffering, code fence tracking, and inline marker healing for partial bold/strikethrough/backtick sequences |
| **Card builder** | Composable card elements (Text, Button, Image, Divider, Table, Fields) with renderers for fallback text, Markdown, Slack Block Kit, and Teams Adaptive Cards |
| **AI tool presets** | Pre-configured tool groups (reader, messenger, moderator) with per-tool approval gates for enterprise governance |
| **Tool overrides** | Customize tool descriptions, titles, and approval requirements per agent profile without duplicating tool code |
| **Message format** | Canonical mdast AST format for messages, with serialization/deserialization and typed stream chunks (markdown_text, task_update, plan_update) |
| **SentMessage factory** | Post methods return objects with `.edit()`, `.delete()`, `.addReaction()`, `.removeReaction()` for cleaner message lifecycle management |

```ts
// Multi-platform adapter example
import { getAdapter, dispatchThreadEvent, dispatchMessageEvent } from "@fluxy-chat/sdk";

const adapter = getAdapter("web");
const threadId = adapter.encodeThreadId({ userId, roomId }); // "web:{userId}:{roomId}"

// Streaming markdown
import { StreamingMarkdownRenderer } from "@fluxy-chat/sdk";
const renderer = new StreamingMarkdownRenderer();
renderer.push("**bold** and `code`");
const html = renderer.getHtml(); // renders incrementally

// Card builder
import { Card, Text, Button, cardToMarkdown } from "@fluxy-chat/sdk";
const card = Card(Text("Hello"), Button("Click me", "https://example.com"));
const markdown = cardToMarkdown(card);
```

## AI-native architecture

Adopted from the [Vercel Chat SDK](https://chat-sdk.dev) and [AI SDK](https://sdk.vercel.ai) architecture.

### Adapters, streaming, and cards

| Feature | SDK export |
|---------|------------|
| Multi-platform adapters | `getAdapter(slug)`, `listAdapters()`, `BaseAdapter` |
| WebAdapter | Registered by default in worker |
| FormatConverter | `toAst(text)`, `fromAst(ast)`, `renderPostable(message)` |
| StreamingMarkdownRenderer | `new StreamingMarkdownRenderer()` — `.push()`, `.getHtml()`, `.finish()` |
| Card builder (function API) | `Card`, `Section`, `Text`, `Button`, `LinkButton`, `Actions`, `Image`, `Divider`, `Field`, `Fields`, `Table`, `CardLink` |
| Card builder (JSX) | `/** @jsxImportSource @fluxy-chat/sdk */` — custom JSX runtime, no React needed |
| Card rendering | `cardToMarkdown(card)`, `cardToFallbackText(card)` |
| AI tool presets | `getToolPreset("reader" \| "messenger" \| "moderator")` |
| Tool overrides | `applyToolOverrides(tools, overrides)` |
| Concurrency strategies | `drop`, `queue`, `debounce`, `burst`, `concurrent` |
| Message format | mdast AST canonical format, `StreamChunk` union type |
| Serialization | `toJSON()` / `fromJSON()` with `_type` discriminator |
| SentMessage factory | `.edit()`, `.delete()`, `.addReaction()`, `.removeReaction()` |
| Transcripts API | `append()`, `list()`, `count()`, `delete()` |
| Custom emoji | `createEmoji()`, `getEmoji()` with platform-specific maps |
| Callback URLs | Encode callback tokens in button values for server-side routing |
| Errors | `ChatError`, `RateLimitError`, `LockError`, `NotImplementedError` |
| Logger | `ConsoleLogger` with child loggers and log levels |
| Thread state | Per-thread key-value with TTL |
| Mock adapter | `MockAdapter` for testing |

### AI SDK core features

| Feature | SDK export |
|---------|------------|
| Stream resumption | `client.resumeStream(streamId)`, `client.getActiveStreams(roomId)` |
| Human-in-the-loop approval | `needsApproval` flag, approval workflow UI cards |
| MCP client | `createMcpClient({ transport, url })` — `.listTools()`, `.listResources()`, `.readResource()` |
| MCP tool conversion | `convertMcpTools(mcpTools)` → FluxyChat tool definitions |
| LLM middleware | `wrapLanguageModel()`, `transformParams()`, `wrapGenerate()`, `wrapStream()` |
| Middleware composition | `composeMiddleware([mw1, mw2, ...])` |
| DevTools web UI | Visual inspector for LLM calls, tool calls, token usage |
| OpenTelemetry | GenAI semantic conventions, `@ai-sdk/otel` compatible |
| Per-step performance | Model output timing, streaming speed, tool execution time |
| WorkflowAgent | `new WorkflowAgent({ agentId, model, tools })` — `.step()`, `.run()` |
| Typed runtime context | `defineContext(schema)` for type-safe cross-step data |
| Sandbox sessions | `SandboxSession` for isolated code execution |
| Realtime voice | Stage signaling (`joinVoiceStage`) + async clips. Media plane is LiveKit. |
| Scoped tool context | Per-tool secret/config isolation via `contextSchema` |

### AI SDK medium features

| Feature | SDK export |
|---------|------------|
| Tool call streaming | `onInputStart` / `onInputDelta` / `onInputAvailable` callbacks |
| Multi-step loop control | `maxSteps`, `stopWhen`, `isStepCount`, `hasToolCall`, `isLoopFinished` |
| Provider-defined tools | Provider supplies schema, developer provides `execute` |
| Provider-executed tools | Server-side tools (web search, code execution) |
| Pluggable transport | `DefaultChatTransport`, `ChatTransport` interface |
| Typed UIMessage | Generic type parameter for end-to-end type safety |
| Data parts | Stream arbitrary typed data alongside text |
| extractReasoningMiddleware | `extractReasoningMiddleware()` |
| RAG middleware | `createRagMiddleware({ retrieve })` |
| Provider-level middleware | `wrapProvider(provider, [middleware])` |
| Image generation | `generateImage()` API |
| Speech generation | `generateSpeech()` (TTS) |
| useObject hook | `useObject()` — stream structured JSON from LLM |
| Structured output | `generateObject()`, `streamObject()` with Zod schemas |
| MCP Apps | Sandboxed iframe rendering of tool UIs |
| Slash commands | Cross-platform `/command` handling |

### AI SDK advanced features

| Feature | SDK export |
|---------|------------|
| experimental_throttle | Configurable render throttle for streaming |
| smoothStream | Flicker-free text streaming |
| Ephemeral messages | User-only visible with DM fallback |
| Cosine similarity | `cosineSimilarity(a, b)` utility |
| Strict tool calling | `strict: true` schema enforcement |
| sendAutomaticallyWhen | Auto-submit when all tool results available |
| Sensitive context controls | Prevent secrets in telemetry |

Guides with examples: [`docs/guides/`](https://github.com/AlessandroFare/fluxychat/blob/main/docs/guides/)

## Product links

- [Hosted quickstart](https://fluxychat.com/get-started)
- [Guest demo room](https://fluxychat.com/demo)
- [Compare vs Stream / Ably / Pusher](https://fluxychat.com/compare)
- [Cloudflare Workers chat guide](https://fluxychat.com/guides/cloudflare-workers-chat)
- [Dev.to: build chat on Workers without a socket fleet](https://dev.to/fluxychat_sdk_330378fbf56/how-to-build-a-realtime-chat-app-on-cloudflare-workers-without-managing-a-socket-fleet-4hdh)

## Support

Questions: [fluxychat@outlook.com](mailto:fluxychat@outlook.com) · Issues: [github.com/AlessandroFare/fluxychat/issues](https://github.com/AlessandroFare/fluxychat/issues)

## License

MIT — see [LICENSE](./LICENSE).

