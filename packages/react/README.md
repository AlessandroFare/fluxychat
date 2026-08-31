# @fluxy-chat/react

React hooks and providers for [FluxyChat](https://github.com/AlessandroFare/fluxychat).

## Install

```bash
pnpm add @fluxy-chat/react @fluxy-chat/sdk
```

Requires `react` 18+ as a peer dependency.

## Usage

```tsx
import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/react";

function App() {
  return (
    <FluxyRealtimeProvider
      workerUrl={process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL!}
      publishableKey={process.env.NEXT_PUBLIC_FLUXYCHAT_PUBLISHABLE_KEY!}
    >
      <Room />
    </FluxyRealtimeProvider>
  );
}

function Room() {
  const { messages, sendMessage, connectionState } = useChat({ roomId: "general" });
}
```

Private rooms: pass `authTokenProvider` (member JWT) or `connectUrl` instead of `publishableKey`.

Requires `react` 18+ as a peer dependency. Pin `@fluxy-chat/sdk@^0.6.7`.

## Inbox demo

`useInbox` delivers live items, unseen counts, and `onItem` callbacks for badge UX:

![Inbox preview — tabs, unseen badge, mark-read flow](https://raw.githubusercontent.com/AlessandroFare/fluxychat/main/apps/dashboard/public/demos/inbox-preview.svg)

Try it in the hosted console: open **Inbox** after onboarding, or run the [inbox parity E2E smoke](https://github.com/AlessandroFare/fluxychat/blob/main/e2e/inbox-parity.smoke.spec.ts) locally.

```tsx
const { items, unseen, markRead } = useInbox({
  client,
  onItem: (item) => showToast(item.preview),
});
```

## Exports

| Hook / component | Purpose |
|------------------|---------|
| `useChat` | Room messages, send, pagination, connection state |
| `useInbox` | Inbox items feed, unseen count, live `onItem` |
| `useNotifications` | In-app notification list |
| `useLocation` | Consume `fleet.gps_update` tracks. Not a Maps SDK. |
| `useWebPush` | Web push subscription helpers |
| `useUserChannel` | User-scoped WebSocket events |
| `FluxyRealtimeProvider` | Shared client + JWT refresh |
| `useFluxyChat` / `useFluxyChatOptional` | Access provider client |

## Note on the transitional split

During the transitional split, this package re-exports React APIs implemented in `@fluxy-chat/sdk`. **New apps should import hooks from here**; the monolithic SDK export remains for backward compatibility.

Legacy imports via `@fluxy-chat/sdk/react` continue to work during the split.

## Related packages

- [`@fluxy-chat/sdk`](https://www.npmjs.com/package/@fluxy-chat/sdk): `FluxyChatClient`, REST, types
- [`@fluxy-chat/ui`](https://www.npmjs.com/package/@fluxy-chat/ui): prebuilt chat UI components
- [`@fluxy-chat/config`](https://www.npmjs.com/package/@fluxy-chat/config): worker `fluxy.config.ts`

## License

MIT
