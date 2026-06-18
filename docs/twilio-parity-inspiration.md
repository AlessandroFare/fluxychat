# Twilio — parity & inspiration map

Cross-vendor gap analysis vs [Twilio Docs](https://www.twilio.com/docs) (Messaging, Verify, Conversations, Flex).  
FluxyChat positioning: **edge-native in-app chat** with optional telco reach via **Sent.dm** (not a Twilio clone).  
Roadmap: `ROADMAP_EXECUTION.md` § P13-Twilio inspiration.

---

## Summary

| Twilio product | What Twilio sells | FluxyChat today | Main gap / opportunity |
|----------------|-------------------|-----------------|------------------------|
| **Programmable Messaging** | SMS, MMS, RCS, WhatsApp via one REST API | Outbound offline notify + OTP via Sent.dm (P10-S1–S6) | **Two-way** SMS/WA ↔ in-app thread; RCS/MMS rich content |
| **Verify** | OTP across SMS, voice, email, WhatsApp, TOTP, push, passkeys | SMS OTP only (`POST /auth/sms-otp/*`, Sent.dm template) | Multi-channel verify, TOTP, fraud/rate policies per service |
| **Conversations** | One conversation thread across web + SMS + WhatsApp | Web rooms + DO realtime; telco is **notify-only** | **Proxy / bridge**: inbound telco message → `messages` row + WS fanout |
| **Flex** | Agent desktop, queues, SLA, supervisor | Admin console, P12-H handoff planned, Desk doc (P10-SB9) | Queue routing, wrap-up codes, SLA timers (enterprise) |
| **Messaging Services** | Sender pools, templates at scale, compliance | `message_templates` CRUD, Sent delivery log | US **10DLC / TFN** operator playbook; sender reputation docs |
| **Conversation Intelligence** | Real-time signals, AI actions | P12-D/F/B AI, agents, moderation | Thread sentiment / escalation signals (compounds P12-H) |

---

## Programmable Messaging

Twilio highlights: appointment reminders, auth, order updates; MMS media; RCS rich cards; WhatsApp E2E option.

| Twilio capability | FluxyChat equivalent | Status |
|-------------------|----------------------|--------|
| Outbound SMS body | Sent.dm template `chat_notify` | DONE — `offline-notify-sent.js` |
| Outbound WhatsApp | `OFFLINE_SMS_CHANNELS=sms,whatsapp` | DONE — P10-S3 |
| Delivery status webhook | `POST /integrations/sent/webhook` + `sent_dm_deliveries` | DONE — P10-S2 |
| Message list / delete API | `GET /admin/integrations/sent/deliveries` | DONE — P10-S4 |
| MMS / media on telco | `media_url` in Sent.dm offline notify | DONE — **P13-T3** (`telco-outbound-media.js`) |
| RCS rich content | — | GAP — **P13-T7** (when provider supports) |
| Inbound SMS → app thread | — | GAP — **P13-T1** (highest value) |

**Inspiration:** Twilio routes every channel into one **Conversation** with ordered history. FluxyChat already has ordered `messages` + rooms — the missing piece is mapping **E.164 / WA sender → room participant** on inbound events.

---

## Verify API

Twilio Verify channels: SMS, passkeys, silent network auth, auto channel pick, voice, WhatsApp, email, TOTP, push.

| Twilio Verify feature | FluxyChat | Status |
|-----------------------|-----------|--------|
| SMS OTP send/verify | `requestSmsOtp` / `verifySmsOtp` (Sent.dm) | DONE — P10-S6 |
| Per-IP rate limit | `RATE_LIMIT_SMS_OTP_PER_MINUTE` | DONE |
| Hashed codes + TTL | `sms_otp_codes` D1 | DONE |
| Email OTP | — | GAP — **P13-T2a** |
| TOTP (authenticator app) | — | GAP — **P13-T2b** |
| Voice OTP | — | GAP — **P13-T2c** (Sent.dm or Twilio adapter) |
| Verify **Service** config (code length, fraud) | Env-only | PARTIAL — **P13-T2d** project-scoped verify policies |
| Pluggable provider (`Verify` vs Sent.dm) | Sent.dm only | GAP — **P13-T2e** adapter interface |

**Inspiration:** Keep Sent.dm as default; add optional `TWILIO_VERIFY_SERVICE_SID` adapter for teams already on Twilio — same HTTP surface (`/auth/otp/send`, `/auth/otp/verify`) with `channel` param.

---

## Conversations (classic + new stack)

Twilio primitives: **Conversation**, **Participant**, **Proxy Address** (Twilio-owned number as window for SMS/WA users).

| Twilio Conversations feature | FluxyChat | Status |
|------------------------------|-----------|--------|
| Web chat SDK + WebSocket | Room DO + `@fluxy-chat/sdk` | DONE |
| Typing / read horizon | WS typing + read receipts | DONE |
| SMS participant in same thread | Offline SMS only (one-way) | GAP — **P13-T1** |
| WhatsApp in same thread | Outbound WA notify | GAP — **P13-T1** |
| Cross-channel media | In-app attachments | PARTIAL |
| Conversation Memory (customer context) | Room history + P12-E search | PARTIAL — **P12-C** inbox compounds |
| Conversation Orchestrator | Room DO + webhooks | PARTIAL |
| Agent Connect (AI + routing) | `agent-runtime.js`, P12-H | TODO |

**Recommended architecture for P13-T1:**

```
Inbound Sent.dm (or Twilio) webhook
  → resolve (projectId, e164) → roomId + userId
  → INSERT messages (kind=sms|whatsapp, external_id=provider_msg_id)
  → fanoutRoomInternal /announce
```

Reuse P10-S2 webhook HMAC; extend payload schema for `direction=inbound`.

---

## Flex (contact center)

| Flex capability | FluxyChat | Status |
|-----------------|-----------|--------|
| Agent inbox | Admin reports + notifications | PARTIAL |
| Takeover from bot | `POST /rooms/:id/handoff` + banner | DONE — **P12-H** MVP |
| Task queues / routing | `GET/POST /agent-queue` claim + SLA | DONE — **P13-T4** (moderator/admin JWT) |
| Supervisor monitor | Realtime inspector v2 | PARTIAL — P10-P6 |
| Wrap-up / disposition codes | `GET /agent-queue/dispositions` + stats | DONE — **P13-T5** |

**Inspiration:** Don't rebuild Flex — document **admin parity** (already `sendbird-desk-vs-admin.md`) and ship **P12-H** as the MVP handoff surface.

---

## Compliance & operator surface (Messaging Services)

Twilio pushes: A2P 10DLC, toll-free verification, opt-out handling, fraud prevention.

| Item | FluxyChat | Action |
|------|-----------|--------|
| Contact opt-out sync | `POST /integrations/sent/contacts/sync` | DONE — P10-S5 |
| Delivery failure visibility | Sent deliveries admin card | DONE — P10-S4 |
| 10DLC / TFN registration guide | `docs/operations/us-sms-compliance-playbook.md` | DONE — **P13-T6** |
| Opt-out keyword handling (STOP) | Via Sent.dm webhook | PARTIAL — document + test in cookbook |

---

## Prioritized backlog (added to roadmap)

| ID | Feature | Twilio source | Compounds with | Effort |
|----|---------|---------------|----------------|--------|
| **P13-T1** | **Inbound SMS/WhatsApp → room message** (two-way omnichannel) | Conversations proxy model | P10-S2 webhook, P12-C inbox | L |
| **P13-T2** | **Multi-channel Verify** (email OTP, TOTP, optional Twilio Verify adapter) | Verify API | P10-S6, auth flows | M |
| **P13-T3** | **Telco outbound with media** (template params + attachment URL on SMS/WA) | Messaging MMS/WA media | Attachments R2 | S |
| **P13-T4** | **Agent task queue** (assign room to available agent, SLA timer) | Flex tasks (lite) | P12-H handoff | M |
| **P13-T5** | **Conversation disposition** (close reason / tags on handoff) | Flex wrap-up | P12-H | S |
| **P13-T6** | **US SMS compliance playbook** (10DLC, opt-out, Sent.dm) | Messaging Services | Ops / GTM | S (docs) |
| **P13-T7** | **RCS channel** (when Sent.dm or adapter exposes it) | Programmable Messaging RCS | P13-T1 | L (blocked on provider) |

---

## What we should *not* copy

- **Twilio Studio** no-code builder — FluxyChat targets developers + SDK; use dashboard guides instead.
- **Full Flex UI** — use our admin console + embed (P12-A).
- **Per-message telco pricing layer** — keep billing at project quota; telco is bring-your-own Sent.dm/Twilio keys.
- **Facebook Messenger beta** — low priority unless a customer asks (P13-T7 tier).

---

## References

- [Twilio Docs home](https://www.twilio.com/docs)
- [Programmable Messaging](https://www.twilio.com/docs/messaging)
- [Verify API](https://www.twilio.com/docs/verify/api)
- [Conversations overview](https://www.twilio.com/docs/conversations/overview)
- FluxyChat: `docs/competitive-parity-p10.md` (Sent.dm), `docs/cookbook/offline-notify-sent-dm.md`, `docs/sendbird-desk-vs-admin.md`

