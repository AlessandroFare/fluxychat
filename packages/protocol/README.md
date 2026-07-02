# @fluxy-chat/protocol

Shared wire protocol for FluxyChat clients and the worker.

## What it covers

- Canonical **inbound** WebSocket event types (server â†’ client)
- Canonical **outbound** client event types (client â†’ room)
- Lightweight runtime guards (`isFluxyInboundEvent`, `isFluxyOutboundEvent`)

## Usage

```ts
import { isFluxyInboundEvent, FLUXY_INBOUND_EVENT_TYPES } from "@fluxy-chat/protocol";

socket.onmessage = (raw) => {
  const data = JSON.parse(raw.data);
  if (!isFluxyInboundEvent(data)) return;
  // dispatch by data.type
};
```

## P21 contract tests

SDK packages should keep their event unions aligned with `FLUXY_INBOUND_EVENT_TYPES`. When adding a new WS event in the worker:

1. Add to `@fluxy-chat/protocol` inbound/outbound lists
2. Update Room DO handler
3. Extend SDK `FluxyChatEvent` union
4. Run `pnpm --filter @fluxy-chat/protocol test`
