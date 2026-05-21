# Cookbook: Node bot that streams into a room

Use `FluxyMessageStream` from `@fluxy-chat/sdk` when your bot runs **outside** the Worker (Node script, Cloudflare Worker cron, etc.) but should publish the same streaming UX as built-in agents: one message row, `streaming: true` deltas, then a final edit.

The Worker Durable Object handles persistence and broadcasts `message` / `edit` events to WebSocket clients.

## Prerequisites

- Member JWT for a user that is a **member** of the room (or admin JWT with room access).
- Room id (e.g. `assistant:general`).
- Agent id string used as `userId` on stream frames (typically your bot’s `bots.id`).

## Install

```bash
pnpm add @fluxy-chat/sdk
```

## Minimal Node script

```typescript
import { FluxyChatClient, FluxyMessageStream } from "@fluxy-chat/sdk";

const BASE_URL = process.env.FLUXY_BASE_URL ?? "https://api.fluxychat.com";
const MEMBER_JWT = process.env.FLUXY_MEMBER_JWT!;
const ROOM_ID = "assistant:general";
const AGENT_ID = process.env.FLUXY_AGENT_ID!; // bots.id from POST /agents

async function main() {
  const client = new FluxyChatClient({
    baseUrl: BASE_URL,
    userId: "bot-runner",
    token: MEMBER_JWT,
  });

  const connection = client.connectRoom(ROOM_ID, {
    replayHistoryOnReconnect: false,
    historyLimit: 0,
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("connect timeout")), 15_000);
    const unsub = connection.addEventListener("message", (ev) => {
      if (ev.type === "history" || ev.type === "presence") {
        clearTimeout(timeout);
        resolve();
      }
    });
    connection.connect();
    void unsub;
  });

  const stream = new FluxyMessageStream(connection, AGENT_ID, {
    flushIntervalMs: 120,
    parentId: null, // or a message id for reply-to
  });

  const chunks = ["Hello ", "from ", "your Node bot."];
  for (const chunk of chunks) {
    stream.push(chunk);
    await new Promise((r) => setTimeout(r, 200));
  }
  stream.end();

  connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## Wire protocol (what the SDK sends)

`FluxyMessageStream` emits WebSocket JSON frames understood by the room DO:

| Phase | `type` | `op` | Notes |
|-------|--------|------|--------|
| Start | `stream` | `start` | `userId`, `content` (initial buffer), optional `parentId` |
| Delta | `stream` | `delta` | `messageId`, `content` (full text so far) |
| End | `stream` | `end` | Final content; clears `streaming` on the row |
| Abort | `stream` | `abort` | Drops in-flight stream |

The DO responds with `stream` / `op: "started"` and `id` so the SDK can attach `messageId` before deltas.

## Reply-to

Pass `parentId` in `FluxyMessageStreamOptions` to thread under an existing message (same as REST `replyTo` / chat `parent_id`).

## When to use REST invoke instead

- You want the Worker **agent runtime** (tools, context fetch, billing, run rows): use `POST /agents/:id/invoke` or `@mention` in chat.
- You only need **custom streaming text** from your own LLM loop: `FluxyMessageStream` is the right tool.

## Related

- [Assistant room use case](../use-cases/assistant-room.md)
- [Dashboard integration](../dashboard-integration.md) — `useChat` replay modes
