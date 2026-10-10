# @fluxy-chat/protocol

Shared wire protocol for FluxyChat clients and the worker.

## What it covers

- Canonical **inbound** WebSocket event types (server → client)
- Canonical **outbound** client event types (client → room)
- Lightweight runtime guards (`isFluxyInboundEvent`, `isFluxyOutboundEvent`)
- Numeric **error catalog** (`errors/catalog.json` → `FLUXY_ERROR_CODES`). Edit the JSON, then `pnpm generate:errors`. Public pages: https://docs.fluxychat.com/errors
- Exclusive room locks: outbound `lock_acquire` / `lock_release`, inbound `lock`

## Install

```bash
pnpm add @fluxy-chat/protocol
```

Usually consumed as a dependency of `@fluxy-chat/sdk` — you rarely install it directly.

## Usage

```ts
import { isFluxyInboundEvent, FLUXY_INBOUND_EVENT_TYPES } from "@fluxy-chat/protocol";

socket.onmessage = (raw) => {
  const data = JSON.parse(raw.data);
  if (!isFluxyInboundEvent(data)) return;
  // dispatch by data.type
};
```

## Contract tests

SDK packages should keep their event unions aligned with `FLUXY_INBOUND_EVENT_TYPES`. When adding a new WS event in the worker:

1. Add to `@fluxy-chat/protocol` inbound/outbound lists
2. Update Room DO handler
3. Extend SDK `FluxyChatEvent` union
4. Run `pnpm --filter @fluxy-chat/protocol test`

## License

MIT
