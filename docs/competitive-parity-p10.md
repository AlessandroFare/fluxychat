# Competitive parity — P10 (Sendbird, Sent.dm, Pusher)

Cross-vendor gap analysis after P9 Pusher Channels parity. Roadmap: `ROADMAP_EXECUTION.md` § P10.

## Summary

| Vendor | FluxyChat strength | Main gaps |
|--------|-------------------|-----------|
| **Pusher Channels** | Realtime pub/sub, presence, user channel, cache, webhooks, debug console | Channel list API polish; Beams/push covered by **P10-ext** web push (VAPID) |
| **Sent.dm** | Built-in offline SMS/WhatsApp, delivery log, contact sync, SMS OTP | Two-way inbound telco → room (**P13-T1**); WhatsApp prod UI polish |
| **Sendbird** | Core chat + translation, delivery, FCM + web push, supergroup sharding, Desk doc | Native Desk-style operator queues (we document admin parity in `sendbird-desk-vs-admin.md`) |

---

## Pusher — remaining items

| Pusher feature | P10 ID | Status |
|----------------|--------|--------|
| `member_added` / `member_removed` / `subscription_count` webhooks | P10-P1 | DONE — `deliverWebhooks` from Room DO |
| `GET /channels/{name}` (occupied, counts) | P10-P2 | DONE — `GET /rooms/:id/live` |
| Terminate by `socket_id` | P10-P3 | DONE — `POST /rooms/:id/terminate-connection` |
| `POST /auth/channel` compat | P10-P4 | DONE — Pusher-style `auth` signature |
| Encrypted channel trust model docs | P10-P5 | DONE — `pusher-channels-parity.md` § P10-P5 |
| Debug console (socket list, trigger) | P10-P6 | DONE — admin inspector v2 |
| Beams / push bridge | P10-ext | DONE — see [web-push-vapid.md](./web-push-vapid.md) (VAPID + RFC 8188, self-hosted, no Pusher dependency) |

See also: [pusher-channels-parity.md](./pusher-channels-parity.md)

---

## Sent.dm — integration depth

| Sent.dm capability | P10 ID | Status |
|--------------------|--------|--------|
| Outbound template send | Built-in | `offline-notify-sent.js` |
| Persist `message_id` | P10-S1 | DONE — `sent_dm_deliveries` |
| Inbound webhook + HMAC | P10-S2 | DONE — `POST /integrations/sent/webhook` |
| Multi-channel SMS + WhatsApp | P10-S3 | DONE — `OFFLINE_SMS_CHANNELS=sms,whatsapp` |
| Admin delivery log | P10-S4 | DONE — `GET /admin/integrations/sent/deliveries` + admin console card |
| Contact sync / opt-out | P10-S5 | DONE — `POST /integrations/sent/contacts/sync` |
| OTP templates | P10-S6 | DONE — `POST /auth/sms-otp/send` + `/verify` |

**Env vars (Worker):**

| Variable | Purpose |
|----------|---------|
| `OFFLINE_SMS_ENABLED` | Enable built-in offline notify |
| `SENT_DM_API_KEY` / `SENT_DM_PROFILE_ID` | Sent API credentials |
| `OFFLINE_SMS_CHANNELS` | `sms` or `sms,whatsapp` |
| `SENT_DM_WEBHOOK_SECRET` | Verify inbound Sent webhooks |
| `PUBLIC_APP_URL` | `room_url` + `media_url` (for `/attachments/*`) template parameters |
| `OFFLINE_SMS_MEDIA_ENABLED` | Include MMS/WA media params on offline notify (P13-T3) |
| `AGENT_QUEUE_SLA_MINUTES` | Default SLA for agent tasks (P13-T4, default 15) |
| `AGENT_QUEUE_AUTO_INBOUND` | Auto-enqueue on inbound telco message |

Cookbook: [offline-notify-sent-dm.md](./cookbook/offline-notify-sent-dm.md)  
Ops: [US SMS compliance playbook](./operations/us-sms-compliance-playbook.md)

---

## Sendbird — feature mapping

| Sendbird feature | FluxyChat | P10 ID |
|------------------|-----------|--------|
| Group / open / DM channels | `rooms.type` dm/group/public | P9 |
| Typing indicators | WS + intent (P8-5) | — |
| Read receipts | `read_receipts` + SDK `seenBy` | P7 |
| Reactions | REST + WS | M2 |
| Scheduled messages | P8-11 | — |
| **Pinned messages** | `PATCH /rooms/:id/pin` | P10-SB1 DONE |
| Polls | `createPoll`, `votePoll`, WS `poll_updated` | P10-SB2 DONE |
| Message translation | `POST /messages/:id/translate` | P10-SB3 DONE |
| Delivery receipts (per peer) | `POST /messages/:id/delivered` | P10-SB4 DONE |
| Open channel (no login) | `POST /public/rooms/:id/guest-session` | P10-SB6 DONE |
| Message collection / offline sync | `loadMore` + replay | Partial |
| Push (FCM/APNs) | `POST /push/devices` + FCM legacy API | P10-SB7 DONE |
| **Web Push (VAPID)** | `POST /push/web/subscribe`, `GET /push/web/vapid-public-key` | P10-ext DONE — [web-push-vapid.md](./web-push-vapid.md) |
| User block (global) | `GET/POST/DELETE /blocks` | P10-SB5 DONE |
| Supergroup (100k+) | Optional `shard_count` + `room-shard.js` | P10-SB8 DONE — [supergroup-room-sharding.md](./supergroup-room-sharding.md) |
| Desk / operator queues | Admin dashboard + doc | P10-SB9 DONE — [sendbird-desk-vs-admin.md](./sendbird-desk-vs-admin.md) |

### Sendbird-inspired quick wins (next sprint)

1. **Polls MVP** — `createPoll`, `votePoll`, WS `poll_updated` (shipped P10-SB2)
2. **Global block** — `/blocks` API + DM enforcement (shipped P10-SB5)
3. **Guest open channel** — `joinPublicRoomAsGuest(roomId)` (shipped P10-SB6)

---

## SDK (P10)

```ts
// Pusher-style live stats
const live = await client.getRoomLive(roomId);
// { occupied, subscriptionCount, userCount, users, members: [{ userId, userInfo }] }

// Portal-style "getParticipants()" — just the members slice
const participants = await client.getRoomParticipants(roomId);

// Sendbird-style pin
await client.pinMessage(roomId, messageId);
await client.pinMessage(roomId, null); // unpin

// Moderation: drop one socket
await client.terminateRoomConnection(roomId, socketId);

await client.createPoll(roomId, { question: "Ship?", options: ["Yes", "No"] });
await client.votePoll(messageId, 0);
await client.blockUser("user-to-block");

const guest = await FluxyChatClient.joinPublicRoomAsGuest(workerUrl, "lobby");
const guestClient = new FluxyChatClient({ baseUrl: workerUrl, userId: guest.userId, token: guest.token });

const channelAuth = await client.authorizeChannel(socketId, "private-room-lobby");

const { translation } = await client.translateMessage(messageId, "it");
await client.markMessageDelivered(messageId);
await client.registerPushDevice("fcm", fcmToken);
```

### Before-persist hooks (OpenIM "before-send" equivalent)

FluxyChat's before-persist hook surface is the inbound message middleware pipeline — every chat message (WebSocket `type: "message"` and `POST /messages`) runs through `runInboundMessageMiddleware` **before** it is persisted or broadcast:

- **Validate** — non-empty, max 4000 chars.
- **Filter** — optional block on substring match (env-driven, P7-A).
- **Enrich** — optional tag on outbound payload.

Env vars: `MESSAGE_MIDDLEWARE_BLOCK_ON_MATCH`, `BUILTIN_MODERATION_BLOCKED_SUBSTRINGS`, `MESSAGE_MIDDLEWARE_ENRICH_TAG`. See [message-middleware.md](./message-middleware.md) for the full pipeline doc.

---

## Public documentation (dashboard)

These routes are **public** (no Clerk login), like `/compare`:

- `/docs` — hosted quick reference
- `/guides` and `/guides/*` — long-form guides
- `/compare`, `/get-started`, `/demo`, `/landing`, `/why`

Console routes (`/rooms`, `/admin`, `/billing`, …) require sign-in when Clerk is enabled. The monorepo `docs/` folder on GitHub is always public.

---

## Deploy

Apply migrations **0043–0047** (Sent, pins, polls, blocks, translations, push, contacts, OTP, shards, web-push VAPID):

```bash
cd apps/worker
wrangler d1 migrations apply fluxychat-db --remote
wrangler deploy
```

Register Sent webhook URL: `https://<worker>/integrations/sent/webhook`

