# @fluxy-chat/ui-kit

Chat widget and inbox panel on `@fluxy-chat/ui` + `@fluxy-chat/react`. Optional bridge to [`assistant-ui`](https://assistant-ui.com) via `useFluxyAssistantRuntime`.

## Install

```bash
pnpm add @fluxy-chat/ui-kit @fluxy-chat/ui @fluxy-chat/react @fluxy-chat/sdk
```

## FluxyChatWidget (3 lines)

```tsx
import { FluxyChatWidget } from "@fluxy-chat/ui-kit";

<FluxyChatWidget
  roomId="general"
  workerUrl={process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL!}
  guest
  publishableKey={process.env.NEXT_PUBLIC_FLUXYCHAT_PUBLISHABLE_KEY}
  theme="brand"
  height={520}
/>
```

`guest` on a public room. Hosted multi-tenant also needs `publishableKey` (`pk_`). Member JWT still works via `token` or a `client`.

## Agent turn chrome (optional)

`FluxyAgentTurnChrome` is a **presentational** strip: sibling count, citation list, reasoning `<details>`, a cost label, HITL status. You pass the data. The widget does not invent branches, Stripe lines, or an in-composer approve button.

```tsx
import { FluxyAgentTurnChrome } from "@fluxy-chat/ui-kit";

<FluxyAgentTurnChrome
  citations={[{ title: "Room memory", url: "https://docs.fluxychat.com/docs/guides/room-memory" }]}
  costLabel="~1.2k tokens (operator estimate)"
  approval={{ toolName: "http_request", status: "pending" }}
/>
```

## Inbox

```tsx
import { FluxyInboxPanel } from "@fluxy-chat/ui-kit";

<FluxyInboxPanel workerUrl={url} token={jwt} onSelectItem={(item) => openRoom(item.roomId)} />
```

## assistant-ui (optional)

```bash
pnpm add @assistant-ui/react
```

```tsx
import { useExternalStoreRuntime, Thread } from "@assistant-ui/react";
import { useFluxyAssistantRuntime } from "@fluxy-chat/ui-kit";

const { externalStoreProps } = useFluxyAssistantRuntime({ roomId, client });
const runtime = useExternalStoreRuntime(externalStoreProps);
return <Thread runtime={runtime} />;
```

## CLI

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-chat --minimal
```

Generates Vite + `FluxyChatWidget` only (no platform modules).
