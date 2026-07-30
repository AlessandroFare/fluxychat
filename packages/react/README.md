# @fluxy-chat/react

React hooks and providers for [FluxyChat](https://github.com/AlessandroFare/fluxychat).

## Install

```bash
pnpm add @fluxy-chat/react @fluxy-chat/sdk
```

Requires `react` 18+ as a peer dependency.

## Usage

```tsx
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { FluxyRealtimeProvider, useChat, useInbox } from "@fluxy-chat/react";

const client = new FluxyChatClient({
  baseUrl: process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL!,
  userId: "alice",
  token: memberJwt,
});

function App() {
  return (
    <FluxyRealtimeProvider workerUrl={process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL!} connectUrl="/api/fluxy/connect">
      <Room roomId="general" />
      <InboxPanel />
    </FluxyRealtimeProvider>
  );
}

function Room({ roomId }: { roomId: string }) {
  const { messages, sendMessage, connectionState } = useChat({ roomId, client });
  // connectionState: connected | degraded | degraded-http | blocked | …
}

function InboxPanel() {
  const { items, unseen, onItem } = useInbox({ client, onItem: (item) => console.log(item) });
}
```

## Exports

| Hook / component | Purpose |
|------------------|---------|
| `useChat` | Room messages, send, pagination, connection state |
| `useInbox` | Inbox items feed, unseen count, live `onItem` |
| `useNotifications` | In-app notification list |
| `useLocation` | Realtime location sharing |
| `useWebPush` | Web push subscription helpers |
| `useUserChannel` | User-scoped WebSocket events |
| `FluxyRealtimeProvider` | Shared client + JWT refresh |
| `useFluxyChat` / `useFluxyChatOptional` | Access provider client |

## Note on the transitional split

During the transitional split, this package re-exports React APIs implemented in `@fluxy-chat/sdk`. **New apps should import hooks from here**; the monolithic SDK export remains for backward compatibility.

Legacy imports via `@fluxy-chat/sdk/react` continue to work during the split.

## Related packages

- [`@fluxy-chat/sdk`](https://www.npmjs.com/package/@fluxy-chat/sdk) — `FluxyChatClient`, REST, types
- [`@fluxy-chat/ui`](https://www.npmjs.com/package/@fluxy-chat/ui) — prebuilt chat UI components
- [`@fluxy-chat/config`](https://www.npmjs.com/package/@fluxy-chat/config) — worker `fluxy.config.ts`

## License

MIT
