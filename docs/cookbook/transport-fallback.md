# Transport fallback (WebSocket → SSE → polling)

`useChat` and `createFluxyRoomSession` automatically degrade transport when the room WebSocket cannot stay connected.

## Order

1. **WebSocket** — `FluxyChatRoomConnection` with exponential backoff reconnect (default 6 attempts in `useChat`).
2. **SSE** — `GET /rooms/:id/stream` when reconnect attempts are exhausted and a member JWT is present.
3. **Polling** — REST `GET /api/messages` every 4s if SSE is unavailable.

When WebSocket reconnects, SSE/polling stops and live delivery resumes on the socket.

## UI

Use `connectionState` from the SDK (not raw `connectionStatus` alone):

```tsx
const { connectionState } = useChat({ roomId });

if (connectionState.status === "reconnecting" && connectionState.nextRetryAt) {
  const seconds = Math.max(
    0,
    Math.ceil((new Date(connectionState.nextRetryAt).getTime() - Date.now()) / 1000),
  );
  return <span>Reconnecting in {seconds}s…</span>;
}

if (connectionState.transport === "sse") {
  return <span>Live updates via SSE</span>;
}

if (connectionState.transport === "polling") {
  return <span>Updating every few seconds</span>;
}
```

## Vanilla (no React)

```ts
import { createFluxyRoomSession } from "@fluxy-chat/sdk";

const { store, stop } = createFluxyRoomSession({
  roomId: "my-room",
  client,
});

store.subscribe((state) => {
  console.log(state.connectionState);
});

// later: stop();
```

## Related

- [`packages/sdk/src/room-session.ts`](../../packages/sdk/src/room-session.ts) — fallback implementation
- [`packages/sdk/README.md`](../../packages/sdk/README.md) — optimistic sends + `retryMessage`
