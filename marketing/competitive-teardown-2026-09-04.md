# Competitive teardown — Pusher, Ably, Stream, hosted chat SDKs

2026-09-04 · Sources actually accessed: FluxyChat live `/compare` and `/pricing`, FluxyChat docs `llms.txt`, repo `compare-providers.ts`. Missing: Meta/Google ad libraries, G2/Reddit review pulls, competitor job boards, live competitor homepages this session (except Fluxy’s own). Confidence on *their* current pricing and ads: **low**. Confidence on *your* public contrast: **high**.

## Executive read

**Pusher.** They believe the market buys channels and connections. Exposed when the app becomes a room with history, agents, and a console. Silent objection: you still assemble chat. Attack copy they already wrote for you: connection bills after the free demo. Do not attack their pub/sub reliability; you will lose.

**Ably.** They believe Next.js/Vercel teams want a realtime network, not a chat product. Exposed on tenant history, operator console, and “agent on the same WebSocket.” Silent objection: Chat is an add-on story. Your Vercel guides already occupy this. Ads not pulled.

**Stream.** They believe consumer and in-app chat is a SaaS with video as a second SKU. Exposed on MIT self-host and Cloudflare-native rooms. Loved for product completeness. Do not claim feature parity on moderation/feeds. Attack lock-in and extra video SKU only with their current docs in hand.

**Hosted proprietary chat SDKs** (internal key `portal`). They believe `pk_` + React hooks + SSR wins the first five minutes. Exposed on MIT Worker-in-your-account. Loved for DX. Your public column header “Hosted chat SDK” is correct. Do not name Portal on fluxychat.com. Time-to-first-message is their funded angle; you already match it with `publishableKey`. Compete on “same SDK after you self-host,” not on hook names.

## Cross-competitor synthesis

**Convergence (table stakes):** WebSockets, some history, some React SDK, “realtime.” If Fluxy copy lives here, it dies.

**Empty quadrant:** MIT room kernel (chat + presence + Yjs + agent) on Cloudflare Durable Objects, hosted optional and labeled beta. PartyKit is nearby on collab parties, not on tenant JWT + D1 + console. DIY DO gists are nearby on mechanism, not on product.

**Shared blind spot:** “Who owns the data plane when legal asks.” Hosted vendors mumble. You can answer: your D1, or hosted beta with subprocessors listed.

## Exposure you should not overplay

- 14 adapters vs their Slack integrations: you are weaker as a desk, stronger as a kernel. Do not pick that fight.
- Spatial / digital twin: they do not care; your own console treats them as labs.
- Cross-org quorum and signed E2EE export: real differentiators *if* you sell to the segment that needs them. They are not why a Next.js shop leaves Pusher this weekend.

## Attack copy (receipts = your compare page, 2026-09-04)

Pusher bill: use the existing “When the Pusher bill catches up” block. Do not invent percentages.

Ably: “Keep Ably if you only need generic pub/sub. Tenant rooms, history, and the operator console stay in FluxyChat.”

Stream: “Stream bundles chat and feeds with separate video. FluxyChat is not an SFU. Media is LiveKit.”

Hosted SDK: “Client MIT only. Sockets are their cloud.” (Already in the table.)

## What I couldn't determine

- Longevity of their ads (no ad library pull).
- Top G2 complaints in their customers’ words this month.
- Whether Stream/Ably HIPAA/SLA pages changed since last repo research.
- Share of search clicks on “Pusher alternative” landing on you vs them.
