# @fluxy-chat/sdk

[![Socket Badge](https://badge.socket.dev/npm/package/@fluxy-chat/sdk/0.3.0)](https://badge.socket.dev/npm/package/@fluxy-chat/sdk/0.3.0)

Client for a **Fluxychat Worker** (self-hosted or [Fluxychat Cloud](https://github.com/AlessandroFare/fluxychat)): rooms, messages, WebSockets, agents, and optional React `useChat`.

The SDK talks to **your** Worker URL. It does **not** include LLM API keys — only your Fluxy **project API key** or **member JWT**.

## Install

```bash
npm install @fluxy-chat/sdk
# or
pnpm add @fluxy-chat/sdk
```

Requires **React 18+** if you use `useChat` (peer dependency).

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

### Option A — explicit client

```tsx
import { FluxyChatClient, useChat } from "@fluxy-chat/sdk";

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

### Option B — `FluxyRealtimeProvider` (hosted Next.js or custom mint)

Wrap your app (or chat layout) once. The provider refreshes the member JWT before expiry and on auth errors.

```tsx
import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/sdk";

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
- **It's configurable per-room.** Call sites that want the Fluxy-style curve set `baseBackoffMs: 1_000, maxBackoffMs: 8_000` on `connectRoom` options; see the [P11-B2 entry in `ROADMAP_EXECUTION.md`](https://github.com/AlessandroFare/fluxychat/blob/main/ROADMAP_EXECUTION.md#p11--research-synthesis-backup-docsresearch--started-2026-06-04).

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

See [`docs/research/ws-client-benchmark-fluxy.md`](https://github.com/AlessandroFare/fluxychat/blob/main/docs/research/ws-client-benchmark-fluxy.md) § 1 for the upstream reference. The defaults are not changing in this minor; P11-B2 stays in the roadmap as a documented decision rather than a code change.

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
connection.connect();
const stream = new FluxyMessageStream(connection, agentUserId, { parentId: null });
stream.push("Hello ");
stream.end();
```

See [docs/cookbook/bot-streaming-fluxy-message-stream.md](https://github.com/AlessandroFare/fluxychat/blob/main/docs/cookbook/bot-streaming-fluxy-message-stream.md) in the monorepo.

## P12 / open beta APIs (2026)

| Feature | SDK method |
|---------|------------|
| Voice message upload | `sendVoiceMessage(roomId, audioBlob, opts?)` |
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
| Feature flags (P12-J) | `getFeatureFlags()` — backoff applied on room session connect |
| Public host / embed | `getPublicHostConfig()`, `getPublicEmbedConfig()` |

Docs in monorepo: `docs/README.md` · deploy: `docs/operations/open-beta-deploy-guide.md`

## Pusher Channels parity (P9)

FluxyChat maps [Pusher Channels](https://pusher.com/docs/channels) features to rooms + JWT. Full matrix: [docs/pusher-channels-parity.md](https://github.com/AlessandroFare/fluxychat/blob/main/docs/pusher-channels-parity.md).

| Feature | SDK API |
|---------|---------|
| Presence / subscription count | WS events: `subscription_succeeded`, `member_joined`, `member_left`, `subscription_count` |
| Cache channel | `connect(roomId, { cache: true })` |
| E2E encrypted room | `getRoomE2eKey(roomId)` + encrypted sends |
| User channel | `signIn()`, `connectUser()`, `triggerUserEvent()`, `useUserChannel()` |
| Multi-room HTTP trigger | `triggerEvents({ roomIds, name, data, excludeSocketId })` |
| Exclude sender | `connection.socketId`, `excludeSocketId` on trigger |
| Connection state | `connectionState`, `state_change` event |
| Global binding | `onAnyEvent()` / `offAnyEvent()`, `useChat({ onAnyEvent })` |
| Watchlist | `listWatchlist()`, `addWatchlistTarget()`, `removeWatchlistTarget()` |
| Terminate connections | `terminateUserConnections(userId)` |
| Public room | Room `type: "public"` — any project member may connect (JWT still required) |

```ts
await client.signIn({ email, password }); // or your auth payload
const user = client.connectUser();
user.on("watchlist_event", (p) => console.log(p));

await client.triggerEvents({
  roomIds: ["lobby", "scores"],
  name: "leaderboard",
  data: { top: 3 },
});

client.onAnyEvent((type, payload) => {
  if (type.startsWith("client-")) return;
});
```

```tsx
import { useUserChannel } from "@fluxy-chat/sdk";

function Inbox({ userId }: { userId: string }) {
  const { events, connectionState } = useUserChannel({ userId });
  // …
}
```

### P10 — Sendbird / Sent / remaining Pusher

See [docs/competitive-parity-p10.md](https://github.com/AlessandroFare/fluxychat/blob/main/docs/competitive-parity-p10.md).

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
