# FluxyChat live cursors

Presence pointers on the room WebSocket (`type: "cursor"`). Not `client_event`. Open **two tabs**.

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-cursors --example live-cursors
cp .env.example .env
# VITE_FLUXYCHAT_WORKER_URL + PUBLIC_ROOM_ID or MEMBER_JWT
npm run dev
```

## How to try

1. Set Worker URL and a public room id (guest) or member JWT.
2. Open http://localhost:5173 in two tabs (or two browsers).
3. Move the pointer. Peers see a labeled cursor.

## Code

`useChat({ roomId, replay: "request" })` returns `sendCursor` and `liveCursors`. Same socket as chat — do not add a second realtime vendor.
