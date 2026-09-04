# Positioning

FluxyChat is a **room layer**: chat, presence/cursors, Yjs, and `invokeAgent` on one Cloudflare Durable Object. It is not Pusher (transport), not Liveblocks (document), not Stream (consumer chat).

## Funnel vs money

Offer a **30 second** public-room path so Portal (and similar `pk_` + `useChannel` tools) do not own the first click.

- Path A: `FluxyRealtimeProvider` + `publishableKey` (`pk_`) + `useChat({ roomId })`. Anonymous guest JWT. Public rooms only.
- Path B: member JWT (`fc_` on the server) for private rooms, roles, production.
- Path C: MIT self-host of the Worker.

Monetize **SaaS whose product is a room** (deal, board, classroom, dispatch) plus agents on the timeline. HITL / quorum / EU AI Act are premium, not the only wedge.

## ICP

- B2B workspace SaaS
- Agent-native products
- Teams already on Cloudflare or Vercel

Not: consumer chat at Stream scale, helpdesk SKU, SFU, MQTT, HIPAA attestation on Monday.

## Do not ship as marketing claims

SFU, MQTT, rollback netcode, fake SLA numbers, HIPAA attestation, unscoped `npx create-fluxy-chat` (ours is `@fluxy-chat/create-fluxy-chat`).

Hosted is **beta**. Pin npm versions.

## Flagship examples

Gallery: `deal-room` (decisions / acks / `visibleTo`) and `war-room`. Agents: `useChat().invokeAgent`. Voice is signaling (`joinVoiceStage`) plus LiveKit for media.

Free path: hosted Free (no card, `pk_`, 200k persisted messages; cursors do not count) or MIT self-host.

## Still later (not this weekend)

Console playground before billing, hosted `PUBLIC_DEMO_PUBLISHABLE_KEY` on production, signed DPA, PITR UI, Slack+Telegram OAuth gold path, native pub.dev/CocoaPods, Worker `/v1` pin, status-page SLO.

Recorded 2026-08-31 after Portal SDK research (`docs/research/portal-sdk-main`).
