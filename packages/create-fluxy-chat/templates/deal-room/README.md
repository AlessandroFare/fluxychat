# FluxyChat deal room

Chat + quorum decisions (`createDecision` / `ackDecision`) + Markdown export. Open **two tabs** and ack from both.

Cross-org room linking is **server-side** REST (`/cross-org/...`), not MQTT and not this Vite app.

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-deal --example deal-room
cp .env.example .env
npm run dev
```
