# FluxyChat Tiptap room

Yjs Storage + Tiptap on the room Durable Object (binary WS, `yjs-sync.js`). Not a second CRDT. Open **two tabs**.

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-doc --example tiptap-room
cp .env.example .env
# VITE_FLUXYCHAT_WORKER_URL + PUBLIC_ROOM_ID or MEMBER_JWT
npm run dev
```

## Code

`FluxyYjsProvider` + `useStorage` / `useMutation` from `@fluxy-chat/sdk/yjs`. Tiptap `Collaboration` uses `useYjsDoc()` and `field: "prosemirror"`. LiveFile refs go through `uploadLiveFile` (existing `POST /upload`).
