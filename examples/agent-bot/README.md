# Agent bot example

Server-side bot using `@fluxy-chat/agent` with **streaming** (`FluxyMessageStream`).

```bash
# Terminal 1 â€” Worker
cd apps/worker && npx wrangler dev

# Terminal 2 â€” example
cd examples/agent-bot
export FLUXY_API_KEY=fc_your_key
export FLUXY_AGENT_ID=my-agent
export FLUXY_ROOM_ID=your-room-id
pnpm install
pnpm start
```

Type a line in stdin; the bot streams words into the room with throttled `stream` frames.
