---
name: fluxy-chat-room
description: Scaffold a FluxyChat gold room (human + invokeAgent on chat, whisper visibility, traces in feeds). Use when building or reviewing a room that mixes chat, agents, and two-tab identity.
---

# FluxyChat gold room

FluxyChat is a **tenant room** on one Cloudflare Durable Object. Humans and `invokeAgent` share the chat timeline. Feeds are logs. Copilot `AiChat` does not write chat.

Do not treat this as Cloudflare Think (the agent is the DO) or as a document-only CRDT product.

## Scaffold

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-deal --example deal-room
```

Env: `VITE_FLUXYCHAT_WORKER_URL` plus either a **public room id** (two-seat whispers) or a member JWT (same user in every tab).

## Must

- `invokeAgent(content, { agentId })` — not `invokeAgent(agentId, prompt)`.
- Token stream: `streaming: true` on the **chat** row. `stopAgentStream()` keeps text already shown and aborts the Worker LLM fetch.
- Agent steps go in `useFeeds` / `useFeedMessages` (`kind: "agent"`). Do not POST traces as chat.
- Feeds have no PATCH. New status = new feed message.
- Whisper: `visibility: "whisper"` + `visibleTo: [userId]`. Kernel filters D1 and WebSocket. CSS hide is not enough.
- Two identities: `joinPublicRoomAsGuest` with a stable `guestKey` **per seat** (sessionStorage). A shared member JWT is one user; both tabs will see whispers.
- Hibernate: if the room DO sleeps mid-LLM, that call does not resume. Reconnect still loads D1 messages.
- Hosted is beta. Self-host is MIT on the user's Cloudflare account. Do not name other vendors in public product copy unless the user asks.

## Two-tab check

1. Buyer URL (default seat).
2. Same origin with `?seat=counsel`.
3. Counsel sends a whisper to self. Buyer timeline must not receive it.
4. Propose/ack quorum from both seats.
5. Ask agent or `@assistant`. Stream lands on chat. Trace column is the feed (member JWT) or a hint (guest).

## Do not

- Dual-runtime (Vercel Functions + Worker) “for portability”.
- SFU / huddles spend in this demo.
- Invent traction, SOC2, or HIPAA.
- Copy Portal thread-docs deploy. Nested `parentId` / `useThread` is already the chat reply path; comment pins are `useThreads`.
