# @portalsdk/wire-protocol

The canonical TypeScript definition of the Portal wire protocol v1: every frame on the
channel and inbox sockets, the message envelope, refusal codes, and the pure guards for
parsing them. This is the transport layer that sits below Portal's public SDK types —
`t`, `seq`, and frame shapes live here and are stripped at the SDK edge, so most
applications should reach for [`@portalsdk/core`](../core) instead and let it own the
socket. Reach for this package directly when you are implementing a Portal client or
server yourself. It is types and total, pure functions only: zero runtime dependencies,
no I/O, no classes, no state. The types and their JSDoc are the reference — the
`§`-markers throughout the source refer to the Portal wire protocol v1 specification.

## Install

```bash
npm install @portalsdk/wire-protocol
```

## Parsing a frame

`parseChannelFrame` is total: it never throws, returns `null` for anything that is not a
frame this version can honour, and hands back an unknown frame type intact rather than
dropping it — forward compatibility (§6) says ignore what you don't recognise, not lose
it.

```ts
import {
  isBatch,
  isChannelReady,
  isKnownChannelFrame,
  parseChannelFrame,
} from "@portalsdk/wire-protocol";

socket.addEventListener("message", (event: MessageEvent<string>) => {
  const frame = parseChannelFrame(event.data);

  if (frame === null) return;          // malformed, or a known frame with a bad shape
  if (!isKnownChannelFrame(frame)) {
    return;                            // a newer frame type — ignore, don't drop
  }

  if (isChannelReady(frame)) {
    console.log(`connected at seq ${frame.seq}`, frame.me.capabilities);
  } else if (isBatch(frame)) {
    for (const msg of frame.msgs) console.log(msg.id, msg.seq, msg.content);
  }
});
```

Guards narrow frames that have already been through a parser — that is what makes a `t`
check sufficient, since the parser has already validated the shape.

## Sending a frame

```ts
import { serializeFrame } from "@portalsdk/wire-protocol";

socket.send(serializeFrame({ t: "watermark", seq: 4810 }));
```

## Building an upgrade URL

Query-parameter names are exported as constants so a protocol rename is a compile error
rather than a silent 4xx.

```ts
import { PROTOCOL_VERSION, UPGRADE_PARAMS } from "@portalsdk/wire-protocol";

const url = new URL(`wss://realtime.useportal.co/v1/channels/${channelId}`);
url.searchParams.set(UPGRADE_PARAMS.version, String(PROTOCOL_VERSION));
url.searchParams.set(UPGRADE_PARAMS.token, jwt);
```

## License

[MIT](./LICENSE)
