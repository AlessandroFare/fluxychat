# WS client benchmark: Fluxy (fluxy-bot) vs FluxyChat SDK

Reference for SDK hardening. Fluxy source inspected from npm package `fluxy-bot@0.17.2` (`supervisor/chat/src/lib/ws-client.ts`).

## Product boundary (do not confuse)

| | [fluxy-bot](https://www.npmjs.com/package/fluxy-bot) | FluxyChat |
|---|--------|-----------|
| What | Local AI agent + workspace + tunnel | Multi-tenant in-app chat on Cloudflare |
| WS endpoint | `/fluxy/ws` on localhost supervisor | Worker room WebSocket |
| Borrow | Client transport patterns | -- |

---

## File-by-file comparison

### 1. `fluxy-bot` → `supervisor/chat/src/lib/ws-client.ts` (~126 lines)

| Concern | Fluxy `WsClient` | FluxyChat `packages/sdk/src/room-connection.ts` |
|---------|------------------|--------------------------------------------------|
| Reconnect backoff | Multiply delay ×2 on each close, cap **8s**, reset to 1s on open | `computeReconnectBackoffMs`: base **500ms**, cap **20s**, max **8 attempts** then stop |
| Reconnect trigger | `onclose` only (unless intentional) | `onclose` + maps auth close 1008 → no retry |
| Outbound while offline | **`send()` pushes to `queue[]`, flush on open** | **`sendJson()` throws `FluxySendError`** if not OPEN |
| Heartbeat | Client sends plain string `'ping'` every **25s** | **Client does not send ping** |
| Heartbeat server | Supervisor answers `'pong'` string | Room DO answers JSON `{ type: "ping" }` → `{ type: "pong", ts }` |
| Auth | `?token=` on URL via getter | JWT on URL via `FluxyChatClient.connect()` |
| Event routing | `on(type, handler)` per message type | Single `message` listener, typed `FluxyChatEvent` union |
| History on reconnect | DB reload in `useFluxyChat` (REST), not in ws-client | **`replayHistory()`** → REST `fetchMessages` → `history` event |
| Stream mid-reconnect | **`chat:state`** with `buffer` on connect | Partial: `streaming` on message events; **no live buffer replay** |
| Fallback transport | None (local only) | SSE + polling after reconnect exhausted (`room-session.ts`) |
| Optimistic sends | User msg in React state before WS ack | **`clientMessageId`** + pending/failed in `message-delivery.ts` |
| Multi-tab sync | `chat:sync` broadcast | Not a goal (tenant SaaS rooms) |

### 2. Fluxy → `supervisor/index.ts` (server stream state)

On each Fluxy chat WebSocket connect, if an agent query is active:

```ts
ws.send(JSON.stringify({
  type: 'chat:state',
  data: { streaming: true, conversationId, buffer: currentStreamBuffer },
}));
```

FluxyChat equivalent would be: Room DO tracks `activeStreams` per user and on WS attach sends something like `{ type: "streamState", messageId, contentPartial }`. Today streaming uses `message` + `edit` with `streaming: true|false` in `room-do.js`, but **no attach-time snapshot** for clients that reconnect mid-stream.

### 3. Fluxy → `useFluxyChat.ts` (consumer)

- Subscribes to `chat:state` → sets `streamBuffer` + `streaming`
- Periodic DB sync while streaming after reconnect (safety net for final `bot:response`)

FluxyChat consumer: `room-session.ts` + `use-chat.ts` -- reconnect updates `connectionState`; history via `loadMore` / replay; agent tokens via normal events if still connected.

### 4. FluxyChat server already ready for client ping (gap is SDK-only)

`apps/worker/src/durable-objects/room-do.js`:

```js
if (msg.type === "ping") {
  webSocket.send(JSON.stringify({ type: "pong", ts: Date.now() }));
  return;
}
```

**Action:** SDK heartbeat should send `JSON.stringify({ type: "ping" })`, not a raw string (Fluxy uses raw string on a different server).

---

## Gap summary (priority)

| P | Gap | Impact | Status |
|---|-----|--------|--------|
| P0 | Outbound queue while `reconnecting` | User sends lost or throw during brief disconnect | **Done** |
| P0 | Client heartbeat (25–30s) | Idle tabs + proxies + DO hibernation drop silent connections | **Done** |
| P1 | `streamState` on WS open (optional) | Agent UI loses partial stream on reconnect | Open |
| P2 | Align backoff defaults with Fluxy (1s base, 8s cap) vs current 500ms/20s | UX tuning only | Open |

---

## Mini-spec: SDK outbox + heartbeat

### Goals

1. Never lose user-initiated sends during `connecting` / `reconnecting` (within limits).
2. Detect dead connections before user sends.
3. Stay compatible with existing `FluxyChatRoomConnection` API.

### Non-goals (v1)

- Cross-tab sync
- Infinite queue (cap required)
- Changing Worker protocol beyond optional `streamState`

### A. Outbound queue (`room-connection.ts`)

**New private state:**

```ts
interface OutboundFrame {
  payload: Record<string, unknown>;
  enqueuedAt: number;
}

private outboundQueue: OutboundFrame[] = [];
private static readonly MAX_QUEUE = 100;
private static readonly MAX_QUEUE_AGE_MS = 5 * 60_000;
```

**`sendJson` behavior:**

- If `OPEN` → send immediately (unchanged).
- If `connecting` | `reconnecting` → enqueue (do not throw).
- If `disconnected` | `idle` → throw `FluxySendError` with code `not_connected` (callers must `connect()` first).

**On `open`:** `flushOutboundQueue()` FIFO; drop frames older than `MAX_QUEUE_AGE_MS` with optional `onQueueDrop?(n)`.

**Wire from `room-session.ts`:** `sendMessage` / `setTyping` should use queued send path so optimistic UI is not rolled back on transient disconnect.

**Tests:**

- enqueue while reconnecting, flush after open
- cap at 100, drop oldest or reject with error (pick one and document)
- auth close clears queue without flush

### B. Heartbeat (`room-connection.ts`)

**Options:**

```ts
heartbeatIntervalMs?: number;  // default 25_000, 0 = disabled
heartbeatTimeoutMs?: number;   // default 45_000 -- force reconnect if no pong
```

**Client:** every `heartbeatIntervalMs`, send `{ type: "ping" }` (JSON).

**Client:** on `{ type: "pong" }`, reset `lastPongAt`.

**If `Date.now() - lastPongAt > heartbeatTimeoutMs`:** `ws.close(4000, "heartbeat_timeout")` → normal reconnect path.

**Server:** already implemented in Room DO (no change required).

### C. Stream state on reconnect (optional v1.1)

**Worker (Room DO):** on WebSocket accept, if `activeStreams.has(userId)`, send:

```ts
{ type: "streamState", messageId, content, streaming: true }
```

**SDK:** merge into last message or dedicated `streamBuffer` in store (mirror Fluxy `useFluxyChat`).

**Fallback:** keep REST history replay + `streaming` edits (already works when DO still streaming).

### D. Public API surface

Keep `connectRoom()` / `FluxyChatRoomConnection`. Add optional:

```ts
getOutboundQueueDepth(): number;
```

Document in `packages/sdk/README.md`.

### E. Acceptance criteria

- [x] Send during 5s artificial disconnect delivers after reconnect (unit test with mock WS)
- [x] Ping/pong path wired (unit test)
- [x] No regression: auth 1008 still stops reconnect; `replayHistoryOnReconnect` still runs
- [x] `pnpm test` in `packages/sdk` green (44 tests)

### F. Rough effort

| Piece | Size |
|-------|------|
| Outbox + flush | ~80 LOC + tests |
| Heartbeat | ~40 LOC + tests |
| streamState server + client | ~60 LOC each (optional) |

---

## Curated GitHub repos (Cloudflare + SaaS chat + WS patterns)

Use one question per repo: *reconnect? history? multi-tenant? self-host?*

### Tier A -- Cloudflare chat (closest wedge)

| Repo | Why open it | Steal |
|------|-------------|-------|
| [cloudflare/workers-chat-demo](https://github.com/cloudflare/workers-chat-demo) | Official DO + WS hibernation chat (~1k★) | Hibernation, broadcast, storage split |
| [cloudflare/durable-chat-template](https://github.com/cloudflare/durable-chat-template) | CF template + PartyServer | Room routing, SQL storage API |
| [cloudflare/partykit](https://github.com/cloudflare/partykit) → `packages/partyserver` | Edge “party” abstraction on DO | `PartySocket`, reconnect DX, broadcast API |
| [threepointone/durable-chat](https://github.com/threepointone/durable-chat) | DO chat + Workers AI (~130★) | Small readable codebase |
| [kevindamm/cf-chat](https://github.com/kevindamm/cf-chat) | Nuxt + DO + **D1** + auth | Same stack pattern as FluxyChat |
| [Alwurts/Chatsemble](https://github.com/Alwurts/Chatsemble) | Full product: org DO + agents + workflows (GPL) | Agent-in-room shape; **no code import** |

### Tier B -- WS client / realtime layer (patterns only)

| Repo | Why open it | Steal |
|------|-------------|-------|
| [centrifugal/centrifugo](https://github.com/centrifugal/centrifugo) | Realtime bus (~10k★) | Reconnect, presence, channel semantics |
| [partysocket/partysocket](https://github.com/partykit/partysocket) (via partykit monorepo) | Browser WS with backoff | Compare to our `room-connection.ts` |
| npm `fluxy-bot` → `supervisor/chat/src/lib/ws-client.ts` | Queue + heartbeat + 8s cap | P0/P1 SDK items above |

### Tier C -- Category reference (positioning, not architecture)

| Repo | Why | Note |
|------|-----|------|
| [OpenIMSDK/Open-IM-Server](https://github.com/OpenIMSDK/Open-IM-Server) | “Chat core” for custom apps | Heavy; different scale story |
| [chatwoot/chatwoot](https://github.com/chatwoot/chatwoot) | Helpdesk / Intercom alt | **What we are not** -- compare positioning only |
| [tinode/chat](https://github.com/tinode/chat) | IM server Go + clients | Federation / mobile IM, not edge SaaS |

### GitHub search strings (save as saved searches)

```
durable objects websocket chat language:TypeScript
cloudflare workers chat room D1
partyserver cloudflare workers
pusher alternative self-hosted websocket
websocket reconnect queue typescript
useChat websocket reconnect react
```

### Weekly review habit (15 min)

1. Pick one Tier A repo → read reconnect + persistence only.
2. Update internal table: repo | reconnect | history store | tenant model | license.
3. File SDK issue if you find one concrete pattern worth copying.

---

## Related FluxyChat docs

- `/guides/reconnect-durable-objects-hibernation`
- `/guides/agent-events-same-websocket-stream`
- `docs/distribution/insightscout-batch-8-hn-superglue.md` (HN + integration-layer split)
