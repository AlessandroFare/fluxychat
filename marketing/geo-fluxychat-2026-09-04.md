# GEO Audit — FluxyChat

2026-09-04 · Citability score: **62/100** (proxy only)

No engine publishes citation criteria. Citation is not deterministic. This session did **not** query ChatGPT, Perplexity, or AI Overviews three times per question. Do not treat the score as a citation forecast. It is extractability + evidence + entity + machine access from pages we fetched.

## Baseline: who gets cited today

| Question | Brand cited? | Who was cited | What the answer claimed |
|---|---|---|---|
| What is FluxyChat? | Not measured | — | — |
| Pusher alternative on Cloudflare Workers? | Not measured | — | — |
| In-app chat SDK with Durable Objects? | Not measured | — | — |
| FluxyChat vs Ably for Next.js? | Not measured | — | — |
| Can I self-host FluxyChat? | Not measured | — | — |

Re-measure protocol: run each question 3× on ChatGPT, Perplexity, and Google AI Overviews. Record mention vs domain citation separately.

## The binding constraint

**Corroboration**, not extractability. Docs `llms.txt` is already one of the denser vendor files in this category. Models still prefer pages *other people* wrote. You have almost no independent mentions, reviews, or named customers. Fixing H2s on the homepage will not beat that until a third-party post repeats the canonical sentence.

Second constraint: **homepage JS**. The kernel paragraph is in the HTML we fetched; the live playground is not a citable fact block.

## Scorecard

| Lever | Score | Weight | Weighted |
|---|---:|---:|---:|
| Extractability | 78 | 25% | 19.5 |
| Specificity and evidence | 70 | 25% | 17.5 |
| Entity clarity | 60 | 20% | 12.0 |
| Corroboration | 28 | 20% | 5.6 |
| Machine access | 72 | 10% | 7.2 |
| **Total** | **62** | | **61.8** |

## Rewrites

Canonical sentence to paste everywhere (site, GitHub About, npm, LinkedIn):

> FluxyChat is a room layer for in-app chat: humans and agents share one Cloudflare Durable Object. MIT self-host or hosted beta.

Answer-first block for `/compare` H2 “Is FluxyChat a Pusher alternative?” (add as H2 if missing):

> For tenant-scoped in-app chat on Cloudflare, yes: rooms, D1 history, reconnect, and an operator console. For generic pub/sub, keep Pusher or Ably. For SMS or WhatsApp to phones, keep a telco API and use FluxyChat for the in-app thread. Hosted is open beta. Self-host is MIT on your Cloudflare account.

Do not stuff “best realtime platform 2026.”

## Schema to add

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "FluxyChat",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Cloudflare Workers",
  "license": "https://opensource.org/licenses/MIT",
  "url": "https://fluxychat.com",
  "description": "FluxyChat is a room layer for in-app chat: humans and agents share one Cloudflare Durable Object. MIT self-host or hosted beta.",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "description": "Free hosted tier: 200000 persisted messages per month, no credit card. Hosted is open beta."
  }
}
```

FAQPage JSON-LD: only after the 14-adapter FAQ is rewritten. Shipping the current answer as structured data would teach models the wrong product.

## Re-measure on 2026-10-04

Same five questions, three engines, three samples each. Success is not “we are cited.” Success is: the canonical sentence appears unchanged when we *are* cited, and the 14-adapter sentence does not.

## What I couldn't determine

- Actual citation set (engines not sampled).
- robots.txt / GPTBot policy on production (not fetched this session).
- Indexation of `/subprocessors` after the auth-gate fix (deploy-dependent).
