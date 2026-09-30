# Shared AI room

First contact without a hosted signup. Public room + `pk_` + guest widget. Humans and `invokeAgent` share the timeline.

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-room --example shared-ai-room
cp .env.example .env
npm run dev
```

The Worker is yours. Clone `apps/worker` from the FluxyChat repo and run `wrangler deploy` on your Cloudflare account. Point `VITE_FLUXYCHAT_WORKER_URL` at that origin.

Vercel AI SDK `useChat` without Redis: see the docs guide `resumable-usechat-cloudflare`. Token paint still uses the room WebSocket. KV snapshot is `GET /ai/streams/active`.
