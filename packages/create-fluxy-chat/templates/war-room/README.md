# FluxyChat war room

Chat + presence + `invokeAgent` on **one** room WebSocket. `scheduleAgent` is room-DO cron/delay, not a Cloudflare Agents SKU. Open **two tabs**.

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-war --example war-room
cp .env.example .env
npm run dev
```

Set `VITE_FLUXYCHAT_AGENT_ID` if the Worker has an agent; otherwise messages still fan out as chat.
