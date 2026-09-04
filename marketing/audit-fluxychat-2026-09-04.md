# Marketing Audit — fluxychat.com

2026-09-04 · Overall score: **69/100**

Basis: live homepage, `/compare`, `/pricing`, `/subprocessors`, docs `llms.txt`, and repo copy (`marketing-landing.ts`, `marketing-faq.ts`). Heuristic scores from the marketing-agi rubric, not measured conversion or ranking data.

Brand context: `marketing/brand-context.md`.

## The one thing

The kernel is already said well: a room on a Durable Object, `pk_` for public, MIT when procurement cares, hosted still beta. Then the rest of the site argues a different product. The homepage tabs cycle Chat / AI / Location / Stream / Collab / Game / IoT / Bridges. The FAQ still answers “14 platforms behind a unified interface.” Use-case copy still says “Slack, Discord, Telegram, WhatsApp, Teams, and 9 more.” A sceptical SaaS buyer cannot tell if they are evaluating a chat kernel or an omnichannel OS. Compare is the honest page. The leak is every surface that did not get the same edit.

## Scorecard

| Dimension | Score | Weight | Weighted | Verdict |
|---|---:|---:|---:|---|
| Messaging & positioning | 64 | 25% | 16.0 | Hero is specific. Audience unnamed. Contradictory body. |
| Conversion | 72 | 20% | 14.4 | No-card Free + playground. CTA clutter below the fold. |
| Search & discoverability | 70 | 20% | 14.0 | Docs and compare are extractable. Homepage is a JS app. |
| Competitive position | 78 | 15% | 11.7 | `/compare` is unusually sharp. FAQ undoes it. |
| Trust & credibility | 58 | 10% | 5.8 | Beta honesty helps. Zero named customers. E2EE mixed. |
| Growth & retention | 68 | 10% | 6.8 | Pricing is readable. No referral, no named proof loop. |
| **Overall** | **69** | | **68.7** | Functional, leaking consistency. |

Rubric note: headline does not name the ICP (“SaaS putting a room in the product”). That is why messaging sits in the 60s, not the 70s.

## Fix these first

1. **Kill the 14-adapter FAQ and use-case.** Why: it is the highest-trust leak and it is false as a finished desk. Replace FAQ answer with: `Bridges are console rows. You create the Slack, Discord, Telegram, WhatsApp, or Teams app, paste the token, and point the webhook at the Worker. Not a finished 14-channel helpdesk.` Effort **S**. Confidence **high**.

2. **Replace the homepage use-case “Multi-platform messaging apps”.** Current body sells nine-plus adapters. Replacement title: `Channel bridges you wire`. Body: `Slack, Discord, Telegram, WhatsApp, Teams: you create the vendor app. Same channel_configs table. Web is just a room.` Effort **S**. Confidence **high**.

3. **Name the buyer in the hero without abandoning the mechanism.** Recommended headline: `In-app rooms for SaaS. Humans and agents on one Durable Object.` Keep the current subhead (it is already the best paragraph on the site). Effort **S**. Confidence **med** (untested).

4. **Align pricing “End-to-end encryption” with docs.** Live pricing says TLS plus “Double Ratchet for private rooms (roadmap).” Enterprise landing still sells “E2EE group cipher + signed conversation attestation.” One sentence on pricing: `TLS on the wire. Group cipher is E2EE only if you supply the key out of band. Double Ratchet is roadmap.` Effort **S**. Confidence **high**.

5. **Stop cycling eight modules as equal tabs.** Keep Chat + Agents as default. Put Location / Stream / Collab / Game / IoT behind “Same Worker, optional modules.” Effort **M**. Confidence **med**.

## What's already working

- Hero subhead states mechanism, keys, MIT, and beta in four sentences. Rare for this category.
- `/compare` names Pusher, Ably, Stream, DIY DO, PartyKit, helpdesks, and refuses SFU/MQTT theatre. That is the competitive asset.
- Free plan is a real risk reversal: no card, `pk_` in the client, cursors not billed as messages.
- Docs `llms.txt` is a first-class GEO artifact. Most chat vendors do not have one this specific.

## Full findings

### 1. Messaging & positioning — 64

Highest-value findings:

- Two products on one domain: kernel (hero, compare, docs) vs platform OS (tabs, FAQ, `docs/marketing/landing-page-copy.md` still talking about omnichannel inbox and “Book a demo”).
- Enterprise block “The room Cloudflare Agents will not ship” is a strong frame, then lists SSO/SCIM/PITR in the same breath as quorum. Premium features bury the kernel.
- Internal `docs/POSITIONING.md` already forbids 14-adapter hero claims. The landing FAQ never got the memo.

Already working: “Your product is a room” as eyebrow. That is the category hint.

### 2. Conversion — 72

Highest-value findings:

- Primary CTA “Create free account” is fine. Secondary “pnpm add” is the developer action and should stay visible.
- Playground “No signup required” is the real first value. It sits after a lot of chrome.
- “Talk to sales” on pricing competes with Free. Fine for Enterprise. Wrong as equal weight on the Free card.

Already working: no-card Free stated next to the price.

### 3. Search & discoverability — 70

Highest-value findings:

- Compare and guides target “Pusher on Vercel” / “Ably for Next.js” with extractable lists. Good.
- Homepage is a client app. Crawlers get less of the demo than of the FAQ blob.
- Title pattern “Pricing: Fluxychat · Fluxychat” is brand-doubled and weak.

Already working: public docs + `llms.txt` + OpenAPI.

### 4. Competitive position — 78

Highest-value findings:

- You already occupy the empty quadrant: MIT room kernel on CF vs hosted-only chat SDKs vs pub/sub. Do not leave it for “14 adapters.”
- Naming a proprietary hosted SDK as “Hosted chat SDK” is the right public stance. Keep Portal out of user-facing copy.
- Switching story (self-host when the Pusher bill hits) is written. Migration from Stream/Ably is thinner.

Already working: the compare table’s “not this table” disclaimer for MCP/spatial/PITR.

### 5. Trust & credibility — 58

Highest-value findings:

- Zero named customers, case studies, or GH stars-as-proof with a date.
- Pricing encryption card contradicts the roadmap line in the same section.
- Beta banner everywhere is honest and also trains people not to ship. Pair it with “self-host MIT if you need the Worker in your account today” next to every beta chip.

Already working: subprocessors is a real public page. Status does not fake a resolved incident (repo intent).

### 6. Growth & retention — 68

Highest-value findings:

- Tier names (Free/Starter/Pro/Team/Growth) are adjective-ish, not identity. Fine for usage metering; weaker for “which one am I.”
- No public “first private room” time-to-value besides gallery estimates.
- No customer-led loop (template gallery is the loop; it is not labeled as such).

Already working: quotas are specific numbers, not “unlimited* except.”

## Appendix: lower-priority items

- `docs/marketing/landing-page-copy.md` is stale (demo, SLA, omnichannel inbox). Redirect authors to `marketing-landing.ts`.
- Product Hunt launch module: there is PH widget code in the landing. No public PH proof in this audit. Do not run a second launch until the FAQ contradiction is gone.
- App Store / Play: N/A. Native SDKs are repo-only until pub.dev/CocoaPods.
- Paid ads: no ad-library pull this session.
- Analytics: no traffic or activation numbers available.

## What I couldn't determine

- Homepage conversion rate, playground-to-signup, or hosted vs self-host mix.
- Whether `@fluxy-chat/sdk@0.6.9` is on npm yet (repo pin only).
- AI-engine citation share (see GEO artifact; engines not sampled 3× here).
- Whether Bridges OAuth for Slack+Telegram is a gold path or still paste-tokens.
- Sales cycle length for Business/Enterprise mailto.
