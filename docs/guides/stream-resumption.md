# Stream resumption

KV snapshot of an agent run after refresh. Not Think-style fiber resume after Durable Object eviction.

`GET /ai/streams/active` and `GET /ai/streams/:id/resume` read `RATE_LIMIT_KV` or `STREAM_RESUME_KV`. `POST /ai/streams/:id/chunk` appends text. Missing bindings: empty list, resume 503.

If the room Durable Object hibernates mid-generation, the in-flight LLM call does not come back. D1 history still loads.

```ts
const streams = await client.getActiveStreams(roomId);
const hit = streams.find((s) => s.active !== false) ?? streams[0];
if (hit?.streamId) {
  const snapshot = await client.resumeStream(hit.streamId);
}
```

`getActiveStreams` / `resumeStream` alias `listActiveAiStreams` / `resumeAiStream`. `FluxyRoomChatTransport.reconnectToStream` uses the same HTTP. `@fluxy-chat/react` `useChat` does not auto-call these endpoints.

Published copy: [docs site](https://docs.fluxychat.com/docs/guides/stream-resumption).
