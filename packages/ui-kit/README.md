# @fluxy-chat/ui-kit

Drop-in polished chat widget and inbox panel for FluxyChat. Closes the "headless only" gap compared to hosted SDKs.

Built on `@fluxy-chat/ui` + `@fluxy-chat/react`. Optional bridge to [`assistant-ui`](https://assistant-ui.com) via `useFluxyAssistantRuntime`.

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
  theme="brand"
  height={520}
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
