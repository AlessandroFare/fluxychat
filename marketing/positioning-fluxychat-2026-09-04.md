# Positioning & offer — FluxyChat

2026-09-04 · Hypothesis until the market votes. No willingness-to-pay interviews in this file.

## Positioning statement

For **SaaS teams whose product is a room** (deal, board, classroom, dispatch, copilot)
who **refuse to glue Pusher + a doc vendor + a bot SDK, and who may need the Worker on their own Cloudflare account**,
FluxyChat is a **room layer**
that **puts chat, presence, Yjs, and invokeAgent on one Durable Object**,
unlike **Pusher/Ably (transport) or Stream (consumer chat SaaS)**,
because **the MIT Worker is the product, hosted is the same shape in beta, and Bridges are rows you wire rather than a helpdesk SKU**.

Unpasteable clauses: “one Durable Object” + “MIT Worker on your Cloudflare account” + “hosted beta, same SDK.” A hosted-only chat SDK can paste “humans and agents.” They cannot paste MIT self-host of the room object.

## The frame decision

**Chosen frame:** “Room layer for in-app SaaS on Cloudflare.” Wins: developer ICP, Vercel-front + CF-chat split, honest beta. Costs: you will lose buyers shopping for Intercom or for MQTT/SFU.

**Rejected frame A — “AI-native chat platform with 14 adapters.”** Matches leftover FAQ copy. Costs trust. Pusher does not compete there; Intercom does, and you lose.

**Rejected frame B — “Enterprise room OS (quorum, E2EE, spatial twin, 14 verticals).”** Attractive to a future Series-B story. Today it collides with labs flags and beta hosted. Keep as a later cascade after named customers.

**Rejected frame C — “Cheaper Pusher.”** You still pay Cloudflare. Compare already says this. Do not become a price war.

## Offer

Current offer on four axes (heuristic 0–10):

| Axis | Score | Note |
|---|---:|---|
| Dream outcome | 7 | Room in the product, agents on the same timeline |
| Perceived likelihood | 4 | No named customers; hosted beta; FAQ contradiction |
| Time to first result | 8 | `pk_` + playground + gallery times |
| Effort and sacrifice | 6 | JWT mint for private rooms; Bridges need a vendor app |

Redesign (no new SKU): keep Free no-card. Make the dream outcome one sentence on every CTA cluster: “Public room today. Member JWT when you ship. MIT when they ask who owns D1.”

Delta vs current: likelihood is the broken axis. One screenshot of a named design partner would move this more than another module tab.

## Pricing

Structure is already usage (messages, agent invokes, webhooks). That matches value for a room product. Do not switch to per-seat as the hero meter.

Above-the-fold on `/pricing` already answers cost / what you get / which one. Keep it.

Guess, not derived: Starter at $20 is the push off Free. Do not raise it until you have five interviews on “why they stayed on Free.”

Fix copy, not numbers: encryption card; “All plans include the full FluxyChat platform” fights labs-gated console pages. Say “Kernel is on every plan. Bridges and vertical studios follow console flags.”

## Cascade

Must rework before ads/email/PH:

- `apps/dashboard/lib/marketing-landing.ts` → `MARKETING_USE_CASES[1]`
- `apps/dashboard/lib/marketing-faq.ts` → adapters question
- Pricing encryption tile
- Homepage module tabs (equal weight)
- Stale `docs/marketing/landing-page-copy.md`

Do not rewrite `/compare` as the first move. It is already the positioning page.

Paid ads and launch: hold until the FAQ is consistent, or you will pay to explain a product you then unsay.

## What I couldn't determine

- Which frame actually wins sales calls (kernel vs enterprise OS).
- Price elasticity. $20 Starter is a structured guess inherited from the catalog.
- Whether “Hosted chat SDK” column is understood without the internal Portal name.
