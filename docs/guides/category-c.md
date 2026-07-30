# Broadcast/Campaign Messaging

Send scheduled broadcasts to user segments with delivery tracking.

```ts
import { createBroadcastApi } from "@fluxy-chat/sdk";
const api = createBroadcastApi();
const seg = api.createSegment("beta-testers", ["u1", "u2", "u3"]);
const bc = api.createBroadcast(seg.id, "Welcome to beta!");
api.sendBroadcast(bc.id);
// stats: { delivered: 3, failed: 0, total: 3 }
```

# Adaptive Transport

Automatic WebSocket/SSE/long-poll/polling fallback based on failure count.

```ts
import { createAdaptiveTransport } from "@fluxy-chat/sdk";
const t = createAdaptiveTransport({ failureThreshold: 3, initialTransport: "websocket" });
t.recordSuccess(); // resets
t.recordFailure(); // triggers fallback to SSE after threshold
t.onFallback((from, to) => console.log(`Fell back from ${from} to ${to}`));
```

# WebTransport Adapter

HTTP/3 bidirectional streams with WebSocket/SSE fallback.

```ts
import { createWebTransportAdapter } from "@fluxy-chat/sdk";
const wt = createWebTransportAdapter();
wt.isSupported(); // false in Node, true in browser with WebTransport
const neg = wt.negotiate(); // capabilities + fallback
await wt.connect(url);
wt.send("data");
```

# Regional Failover

Cross-region reconnect with latency-based routing.

```ts
import { createRegionalFailover } from "@fluxy-chat/sdk";
const rf = createRegionalFailover();
rf.addRegion({ id: "us-east", name: "US East", priority: 1, active: true, latencyMs: 50 });
rf.addRegion({ id: "eu-west", name: "EU West", priority: 2, active: true, latencyMs: 30 });
rf.setLatency("eu-west", 25);
rf.getOptimalRegion(); // "eu-west"
rf.failover(); // switch to next region
```

# Per-Room Sequencing

Server-authoritative event sequencing with gap detection.

```ts
import { createRoomSequencer } from "@fluxy-chat/sdk";
const rs = createRoomSequencer();
const ev = rs.recordEvent("room-1", "message", "hello");
const events = rs.getEventsSince("room-1", 0);
const gaps = rs.detectGaps("room-1", [1, 3, 5]); // [2, 4]
```

# Delivery Semantics

At-least-once/exactly-once delivery with idempotency keys.

```ts
import { createDeliverySemantics } from "@fluxy-chat/sdk";
const d = createDeliverySemantics();
const r = d.send("exactly-once", "msg-1", "consumer-1", "payload");
d.isDuplicate(r.idempotencyKey); // true
d.acknowledge(r.idempotencyKey, "delivered");
d.getReceipt("msg-1"); // { stage: "delivered", ... }
```

# Platform Adapters

WhatsApp, Telegram, Line, Viber, iMessage, Messenger stubs.

```ts
import { createPlatformAdapter } from "@fluxy-chat/sdk";
const pa = createPlatformAdapter();
pa.getSupportedPlatforms(); // ["whatsapp", "telegram", ...]
const msg = await pa.send({ platform: "whatsapp", enabled: true }, "Hello", "user-123");
```

# Spatial Copresence

Digital-twin rooms with shared position state.

```ts
import { createSpatialCopresence } from "@fluxy-chat/sdk";
const sc = createSpatialCopresence();
sc.createRoom({ id: "lobby", name: "Main Lobby" });
sc.join("lobby", "user-1", { x: 0, y: 0, z: 0 });
sc.join("lobby", "user-2", { x: 5, y: 0, z: 0 });
const nearby = sc.getNearby("lobby", "user-1", 10);
```

# MCP Protocol Negotiation

Versioned protocol negotiation with transport fallback.

```ts
import { createMcpNegotiation } from "@fluxy-chat/sdk";
const neg = createMcpNegotiation();
const result = neg.propose([
  { transport: "streamable-http", version: "v3", features: ["tools"] },
]);
// { agreedVersion: "v3", agreedTransport: "streamable-http" }
```

# Decentralized Relay

P2P message relay for edge network latency reduction.

```ts
import { createDecentralizedRelay } from "@fluxy-chat/sdk";
const r = createDecentralizedRelay();
r.registerPeer("peer-1", "10.0.0.1:8080");
r.registerPeer("peer-2", "10.0.0.2:8080");
r.send("peer-1", "peer-2", "hello"); // creates message
r.broadcast("peer-1", "announce"); // sends to all except sender
```
