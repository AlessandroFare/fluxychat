# Ship in-app chat in one afternoon

Goal: first live message in a room using FluxyChat local Worker or hosted deployment.

## 0. Zero-to-message (repo clone, ~90 seconds)

```bash
pnpm install
pnpm run first-message
```

Uses `http://127.0.0.1:8787`, project `dev-local`, room `dev-local-general`. The script writes `FLUXY_CONSOLE_API_KEY` to `apps/worker/.dev.vars` when a new key is minted.

## 1. Install in your app (2 min)

```bash
pnpm add @fluxy-chat/sdk @fluxy-chat/react
```

## 2. Worker URL + JWT (10 min)

**Local dev:** use values printed by `pnpm run first-message`.

**Hosted:** sign up at your dashboard → Quickstart → copy **member JWT** and **Worker URL**.

**Self-host:** deploy `apps/worker`, run D1 migrations (`wrangler d1 migrations apply`), mint JWT via `POST /auth/token` with project API key.

## 3. React hook (15 min)

```tsx
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/react";

const client = new FluxyChatClient({
  baseUrl: process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL!,
  userId: "user-1",
  token: memberJwt,
});

function Room({ roomId }: { roomId: string }) {
  const {
    messages,
    sendMessage,
    connectionState,
    sendReadReceipt,
    loadMore,
  } = useChat({
    roomId,
    client,
    markReadLatest: true,
  });

  return (
    <div>
      <p>Status: {connectionState}</p>
      <ul>
        {messages.map((m) => (
          <li key={m.id ?? m.clientMessageId}>{m.content}</li>
        ))}
      </ul>
      <button type="button" onClick={() => sendMessage("Hello")}>
        Send
      </button>
      <button type="button" onClick={() => loadMore()}>
        Older
      </button>
      <button
        type="button"
        onClick={() => {
          const last = messages.at(-1);
          if (last?.id) sendReadReceipt(last.id);
        }}
      >
        Mark read
      </button>
    </div>
  );
}

export function App({ jwt }: { jwt: string }) {
  return (
    <FluxyRealtimeProvider client={client}>
      <Room roomId="dev-local-general" />
    </FluxyRealtimeProvider>
  );
}
```

## 4. Rooms + unread (5 min)

```ts
const rooms = await client.listRooms();
// each room may include unreadCount when using member JWT
```

## 5. In-app notifications (optional)

```ts
import { useNotifications } from "@fluxy-chat/react";

const { notifications, markRead, markAllRead } = useNotifications(client, {
  unreadOnly: true,
});
```

Mentions and DM messages create rows automatically (requires migration `0037_in_app_notifications.sql`).

## Next

- [Message middleware](./message-middleware.md)
- [Transport fallback](./cookbook/transport-fallback.md)
- [Dashboard integration](./dashboard-integration.md)
