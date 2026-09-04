# Brand context

Filled 2026-09-04 from the FluxyChat repo, live site, and docs. Spec is docs, not the compare table.

---

## Product

What it is, in one sentence a stranger would understand:

FluxyChat is a room layer for in-app chat: humans and agents share one Cloudflare Durable Object, with MIT self-host or hosted beta.

What it actually does (the mechanism, not the promise):

One Worker, one Durable Object per room, D1 for history. Browser SDK (`@fluxy-chat/sdk` / `@fluxy-chat/react`) joins a WebSocket. Public rooms: `publishableKey` (`pk_`) mints an anonymous JWT. Private rooms: member JWT minted with `fc_` on the server. Same SDK hosted or on your Cloudflare account. Kernel: chat (`useChat`, nested `useThread` on `parentId`), presence/cursors (`sendCursor`), Yjs (`FluxyYjsProvider`), `invokeAgent` on the timeline. HTTP ingest fans out `iot.reading` / `fleet.gps_update`. Bridges are console rows: you create Slack/Discord/Telegram/etc. apps and paste tokens. Voice is `joinVoiceStage` signaling; media is LiveKit, not a FluxyChat SFU.

What it does NOT do:

Not a helpdesk (no Intercom/Zendesk SKU). Not Pusher-style generic pub/sub as the product. Not Liveblocks-only document collab. Not Stream-scale consumer chat. Not MQTT. Not an SFU. Not HIPAA attested. No public fleet uptime SLO (written SLA only with a signed MSA). Hosted is open beta. Comment pins (`useThreads` / `/comment-threads`) are not chat nested threads. Copilot UI does not write the room timeline. Hosted never evals tenant JS. Do not market “14 finished adapters” as a desk: Bridges exist; you wire the vendor app. Spatial / digital twin and many vertical studio pages are labs or REST extras, not the kernel.

## Audience

Who buys it:

SaaS developers and founding teams putting tenant-scoped rooms in a product (deal, board, classroom, dispatch, copilot). Often already on Vercel/Netlify for the UI and willing to put sockets on Cloudflare. Secondary: teams that must self-host on their CF account for procurement.

What they believe before they arrive:

“I’ll glue Pusher or Ably for realtime, Liveblocks for the doc, and a bot SDK for the agent.” Or: “I’ll fork a Durable Objects chat gist.” Or they compare FluxyChat to a support widget.

What they worry about at 2am:

Socket bills after the demo. Who owns message history. Reconnect after hibernation. Whether hosted beta is safe to ship. Whether they are buying a chat kernel or a 14-channel OS they cannot operate.

What they'd use instead if you didn't exist:

Pusher, Ably, Stream Chat, a proprietary hosted chat SDK (`pk_` + React hooks), PartyKit, DIY Room DO + D1, Liveblocks if the artifact is only a document, Intercom if they actually wanted a support desk.

## Positioning

The one thing true about us that a competitor could not also say:

Chat, presence, Yjs, and `invokeAgent` share one Durable Object you can MIT-fork onto your Cloudflare account. Hosted is the same Worker shape, still beta.

Category we compete in:

In-app realtime / room infrastructure for SaaS (not support desk, not generic pub/sub).

Named competitors:

Pusher, Ably, Stream, proprietary hosted chat SDKs (internal compare key `portal`; do not name-drop Portal in public copy), PartyKit, DIY Durable Objects, Liveblocks (document-only), helpdesks (negative space).

## Proof

Numbers we can cite (with source and date):

- Hosted Free: 200k persisted messages / 5k agent invokes / 50k webhooks per month, no card. Source: `plan-catalog.ts` + live `/pricing`, 2026-09-04.
- Starter $20, Pro $50, Team $99, Growth from $199, Business from $699, Enterprise custom. Same source.
- CI gzip budgets: `@fluxy-chat/react` chat-only entry gated at 20 kB gzip; full SDK budget 160 kB. Source: live compare page + repo `check:bundle-size`. Do not quote a single gzip as “the product size” without the tree-shake caveat.
- Thread depth cap 8. Source: SDK `ThreadDepthExceededError`, 2026-09.
- Presence aggregate above 250 unique users. Source: docs/llms.txt.
- npm pins as of 2026-09-04 in repo: `@fluxy-chat/sdk@0.6.9`, `@fluxy-chat/react@0.1.7` (publish status: confirm on npm before citing as live).

Named customers we're allowed to name:

None on the public site as of 2026-09-04.

Claims that need legal sign-off:

SOC 2 / HIPAA as attestations. Any SLA percentage. E2EE (group cipher is E2EE only if the key never hits FluxyChat servers). “14 adapters” as a finished omnichannel desk. Double Ratchet as shipped (pricing page still says roadmap).

## Voice

How we sound:

Engineer talking to an engineer. Short. Mechanism first. Hosted beta said out loud. MIT when they ask who owns the data.

How we never sound:

“Transform your workflow.” Platform OS with 14 adapters as the hero. Fake incidents on the status page. Portal as a named reference in public docs.

Words we always use:

Room, Durable Object, D1, `pk_` / `fc_`, MIT self-host, hosted beta, invokeAgent, Bridges (you create the vendor app).

Words we never use:

Seamless, frictionless, industry-leading, SFU (as ours), MQTT (as ours), HIPAA-compliant (as a badge), 14 adapters (as a finished product).

## Constraints

Regulatory or legal limits:

No invented testimonials. No public uptime number. GDPR export exists on the Worker; DPA download is later. Subprocessors page is public (Clerk, Stripe, Cloudflare, LLM path, Vercel).

Anything off-limits:

Leaking `fc_` / `pk_` / JWTs. Claiming spatial/digital twin as kernel. Mixing comment threads with chat `parentId`. Unscoped `npx create-fluxy-chat` (ours is `@fluxy-chat/create-fluxy-chat`).
