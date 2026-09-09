# Positioning and offer — FluxyChat

2026-09-09 · Hypothesis until someone pays. Heuristic scores. No willingness-to-pay interviews.

## The one thing

Sell the room, not the catalog. A founder who already glued Pusher + a doc vendor + a bot will try a `pk_` room this week. A founder who hears "22 industries, production" will wait for Stream.

## Positioning statement

For founding engineers putting a tenant-scoped room in a SaaS product (deal, board, classroom, dispatch, copilot)
who are about to buy three vendors or fork a Durable Objects gist,
FluxyChat is a room layer on Cloudflare
that puts chat, presence, Yjs, and invokeAgent on one Durable Object,
unlike Pusher (transport only) or Stream (consumer chat SaaS),
because the MIT Worker is the product, hosted is the same shape in open beta, and you can fork it onto your own Cloudflare account.

Unpasteable: MIT Worker on your account + humans and agents on the same object. A hosted-only SDK can paste "humans and agents."

## The frame decision

Chosen: room layer for in-app SaaS. You lose Intercom shoppers and MQTT/SFU buyers on purpose.

Rejected: "AI platform with 14 adapters." Sounds like a helpdesk. You lose.

Rejected: "Enterprise room OS." Fine after named customers. Today it fights hosted beta.

Verticals stay. They are the second sentence: "if you later need polls or GPS, it is the same Worker." They are not the subject line.

## Offer

Dream outcome: a public room today, member JWT when you ship, MIT when procurement asks who owns D1.

Likelihood is still the weak axis (no named customers). Fix the agent 400 and stop stamping labs as production. That is cheaper than another module.

Time to first result: `pk_` + gallery. Keep it.

Risk reversal already exists: Free, no card, 200k messages / 5k agent invokes / 50k webhooks per month (`plan-catalog.ts`). Then Starter $20. Do not invent a "pay when happy" SKU until Stripe is on. Say it in the email: try Free, stay if the room holds.

## Pricing

Keep usage meters (messages, invokes, webhooks). Do not switch the hero to per-seat.

Guess, not derived: $20 Starter is the nudge off Free. Interview five people who stayed on Free before you raise it.

## Cascade

Ship in this order:

1. Agent replies without OpenAI 400 (Worker).
2. Honest badges (sdk `PLATFORM_READINESS`, landing, console chrome).
3. Cold email below. Homepage already has the hero; do not restack it until a founder replies "I still don't get what this is."
4. One gallery that matches the email (two tabs + agent).

## What I couldn't determine

- Whether "Durable Object" in the hero helps unaware traffic. It helps this ICP.
- Price elasticity.
- First vertical that actually closes (classroom vs dispatch vs deal room).
