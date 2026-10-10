# FluxyChat live cursors + chat

Same room WebSocket: `sendCursor` + `useChat` messages. Not `client_event` for pointers.

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-cursors-chat --example live-cursors-chat
cp .env.example .env
npm run dev
```

Open two tabs. Move the pointer and send a chat line.

OBS browser source (not Overlayed Electron): append `?overlay=1` for a transparent chat+cursors layer. Worker `GET /overlays/:id/widget` is the JSON widget URL.
