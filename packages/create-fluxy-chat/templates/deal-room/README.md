# FluxyChat deal room

Quorum decisions, a counsel whisper the buyer tab never sees, and an agent on the same timeline. Traces go in a feed, not in chat.

Open **two tabs**. This URL is the buyer. Add `?seat=counsel` for counsel.

Use a **public guest room** for the whisper check. A shared member JWT is one user, so both tabs would see the note.

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-deal --example deal-room
cp .env.example .env
npm run dev
```

Set `VITE_FLUXYCHAT_AGENT_ID` to call `invokeAgent`. Without it, the `@assistant` button sends a mention (needs a handle on the Worker). Token stream is `streaming: true` on the chat row. Stop stream keeps tokens already shown and aborts the Worker LLM fetch when `stopAgentStream` lands. If the room Durable Object hibernates mid-call, the model run does not resume.

Two-tab screenshots (needs the Vite app on a **public guest room**):

```bash
DEAL_ROOM_ORIGIN=http://127.0.0.1:5173 pnpm --filter @fluxy-chat/dashboard capture:deal-room
```

Writes `docs/marketing/assets/deal-room/buyer.png`, `counsel.png`, and `counsel-after-refresh.png` (whisper, quorum acks, then counsel reload). If `ffmpeg` is on PATH, also `two-tab.gif`. That is the capture path for the 60s hosted clip. It is not the clip itself.

Cross-org linking is REST `/cross-org`, not this app.
