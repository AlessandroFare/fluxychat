# Landing page — reference copy

Live source: `apps/dashboard/lib/marketing-landing.ts` and `lib/marketing-faq.ts`. Do not invent a second hero here.

## Hero

**Eyebrow:** Your product is a room

**Headline:** Humans and agents in the same room.

**Subhead:** Chat, live presence, a shared document, and an agent on the same Durable Object. Public rooms use a pk_ in the browser. Self-host is MIT. Hosted is still beta.

**Primary CTA:** Create free account  
**Secondary CTA:** `pnpm add @fluxy-chat/react`

---

## Why FluxyChat exists

The unit of value is a room: chat, presence, Yjs, and an agent on one Cloudflare Durable Object. MIT self-host or hosted beta. Not Pusher, not Liveblocks, not Stream.

---

## What you get

- One room Durable Object: chat, sendCursor, Yjs, invokeAgent, HTTP ingest
- Guest session or pk_ for public rooms; fc_ stays on the server
- Bridges: you create Slack/Discord/Telegram apps on the same table
- Voice signaling (joinVoiceStage); media is LiveKit
- GDPR export/erasure on the Worker
- Open beta hosted. Pin npm versions.

---

## Use cases

- In-app chat with an agent (same WebSocket as users)
- Bridges (you create the vendor app)
- GDPR export and signed webhooks on the Worker
- JWT, SDK, console (no socket VPS)

---

## Enterprise

Group cipher with signed export (E2EE only if you supply the key out of band). Written SLA only with a signed MSA.

---

## Final CTA

**Headline:** Same SDK on hosted or on your Cloudflare account.

**CTA:** Start free / Book a pilot
