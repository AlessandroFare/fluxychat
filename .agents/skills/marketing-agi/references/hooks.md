# Hook Engine

The first 1-3 seconds decide whether the remaining 30 exist. On paid social, the hook is not the ad's opening — it is the ad; everything after it is permission to keep going. This module generates hooks systematically instead of by vibes, and diagnoses which layer is failing when performance drops.

Used by `paid-ads.md` (production briefs), `copy.md` (short-form), and `competitive.md` (clustering competitor hooks).

## The three components

A video hook is three things firing simultaneously, and they must not say the same thing:

1. **Visual action** — what is physically happening on screen in second one
2. **Spoken line** — the first sentence out of a mouth (or VO)
3. **On-screen text** — the caption or headline overlay

**The no-duplication rule:** if the text repeats the spoken line, one of them is wasted. Each component carries a different part of the load — the visual earns the stop, the spoken line opens the argument, the text adds the stake or the audience callout. For statics the same rule applies across visual / headline / support line.

Write all three explicitly in every hook. "A strong hook about saving time" is not a hook. This is:

> Visual: hands ripping a printed report in half
> Spoken: "I stopped sending clients reports."
> Text: "agencies: read this"

## Grounding — before generating anything

Hooks written from imagination converge on the same five clichés. Build a corpus first:

- **Winning ads** — the account's current best performers, and the competitor ads with the longest run time (see `competitive.md`)
- **Reviews** — the customers' own words for the pain and the outcome (G2, app stores, Amazon, Reddit)
- **Comments** — under the brand's ads and the competitors' ads; objections and enthusiasm, verbatim
- **Community threads** — how the category is actually discussed when no marketer is present

**Verbatim beats paraphrase.** A hook built from a customer's actual sentence ("I didn't touch our ad account for a week and nothing broke") outperforms the marketer's translation of it. Quote the corpus in the hook matrix so every hook is traceable to a source.

If no corpus exists and none can be gathered, generate anyway but label the set: *ungrounded hypotheses, expect a lower hit rate, validate cheap.*

## Generation pipeline

Work the sequence — each step constrains the next:

1. **Segment** — who exactly is this batch for (one segment per batch)
2. **Motivation** — which pain or desire, in the corpus's words
3. **Tactic** — pick from the taxonomy below; force spread across at least 6 tactics per batch
4. **Format** — talking head, demo, static, UGC, split-screen; a tactic × format pair is one hook

Output is a **hook matrix**, not a list: rows = hooks, columns = segment / motivation (with corpus quote) / tactic / format / the three components written out.

## The tactic taxonomy

Eighteen named tactics. Force spread — a batch that is all questions and callouts has not explored the space.

| # | Tactic | What it is | Don't confuse with | Fails when |
|---|---|---|---|---|
| 1 | **Callout** | Name the audience in the first line ("If you run Meta ads for a DTC brand...") | Identity (self-image, not role) | The callout is broader than the targeting |
| 2 | **Question** | Open a loop the viewer must resolve | Curiosity gap (withholds; question invites) | Answerable with "no" and a scroll |
| 3 | **Contrarian** | Attack a belief the audience holds | Contrast (shows; contrarian argues) | The belief attacked is a strawman |
| 4 | **Contrast** | Before/after or us-vs-them, side by side | Contrarian | The "before" is not recognisable as the viewer's present |
| 5 | **Demonstration** | The product doing the impossible thing, cold, no setup | Outcome (shows result; demo shows process) | The demo needs context to read as impressive |
| 6 | **Pattern interrupt** | Something visually wrong for the feed — breaks scroll grammar | Demonstration | The interrupt has nothing to do with the message (clickbait decay) |
| 7 | **Stat lead** | One number that reframes the problem | Social proof (stat about the world, not the brand) | The number is round, unsourced, or unbelievable |
| 8 | **Fear / loss** | What the status quo is costing them right now | Problem-agitation body copy | Audience isn't problem-aware yet — reads as fearmongering |
| 9 | **Outcome** | The after-state, specific and sensory | Demonstration | The outcome is generic ("save time and money") |
| 10 | **Social witness** | A real person mid-experience, UGC grammar — overheard, not performed | Testimonial (witness is in-moment) | Production polish breaks the "real person" read |
| 11 | **Authority** | Credentials speak first ("I've audited 400 ad accounts") | Social proof (authority = depth, proof = volume) | The credential doesn't map to the claim |
| 12 | **Social proof** | Volume and consensus ("12,000 teams switched") | Authority | The number can't be substantiated — never invent it |
| 13 | **Story cold-open** | In medias res, mid-conflict, no preamble | Social witness | The payoff doesn't arrive inside the on-ramp |
| 14 | **Implied answer** | Pose the setup so the viewer completes the thought themselves | Question (implied answer never asks) | The inference is too big a jump |
| 15 | **Borrowed enemy** | Align with the viewer against a shared villain — the old way, the incumbent, the platform | Contrarian | The enemy is the viewer's own past choice (insults them) |
| 16 | **Trojan horse** | Borrow a native format — Notes screenshot, iMessage thread, reply-to-comment — so the ad reads as content | Pattern interrupt | The reveal feels like betrayal instead of a wink |
| 17 | **Curiosity gap** | Withhold the mechanism, promise the reveal | Question | The reveal can't cash the cheque — burns trust for the whole account |
| 18 | **Identity** | Mirror the self-image ("for founders who still write their own copy") | Callout (role vs self-image) | The identity flatters instead of recognises |

## The on-ramp rule

Seconds 3-15 must **extend the hook's premise**, not start the pitch. A viewer stopped by "I stopped sending clients reports" stays for *why you stopped*, not for a feature tour. When a hook tests well and the ad still dies, the on-ramp broke the premise — which means **every hook test is also an on-ramp test**, and a "failed hook" verdict is unreliable if the on-ramp changed too.

## The diagnostic funnel

When an ad underperforms, the funnel tells you which component to fix. Read top-down; fix the first broken stage only.

| Metric | What it isolates | If broken, fix |
|---|---|---|
| **Thumbstop rate** (3-sec views / impressions) | The visual + on-screen text | The hook's visual action; the first frame |
| **Hold rate** (15-sec / 3-sec views) | The spoken line + on-ramp | The premise extension, not the hook |
| **CTR** (given healthy hold) | The argument + CTA clarity | The offer as stated in the ad |
| **CVR** (given healthy CTR) | Post-click | The landing page — message match first (`audit.md`); stop editing the ad |

Fixing CVR problems with new hooks is the most common wasted motion in creative testing. The funnel exists to prevent it.

## The fidelity ladder

Ideas are cheap to have and expensive to produce, so match production cost to evidence:

1. **Rung 1 — text and uglies.** New angles ship as plain statics or text-on-screen mockups. Spend nothing on polish.
2. **Rung 2 — cheap motion.** Angles that survive rung 1 get a UGC read or a rough cut.
3. **Rung 3 — production.** Only validated angles earn real production budget.

Skipping rungs is how accounts end up with one beautiful ad of an unproven argument. The corollary from `ads-diagnostics.md` applies: a proven angle in an untested format outranks a new angle in a proven format.

## Static formats

Named layouts with their copy slots. Statics are rung 1 of the ladder and a format dimension of the coverage map in `paid-ads.md`.

1. **Us vs. them table** — two columns, 4-6 rows, checkmarks; slots: column headers, row labels
2. **Stat callout** — one giant number, one line of context under it
3. **Review card** — a real review, screenshot-styled; slots: quote, name, star row
4. **Before/after split** — two panels, one caption each
5. **Founder note** — plain-text letter, signed; slots: one problem, one promise
6. **FAQ card** — the hardest objection as the question, the honest answer
7. **Checklist** — "signs you need X", 4-5 items, viewer self-diagnoses
8. **Comparison receipt** — cost of the old way itemised vs one line for the new
9. **Native screenshot** — Notes app / iMessage thread carrying the argument (trojan horse as a static)
10. **Headline-on-product** — the product photographed, one hard claim set over it
11. **Pull-quote** — one sentence from a customer, typeset huge, attribution small
12. **Offer card** — the offer, the price anchor, the risk reversal, nothing else

Every static still needs the three-component check: visual, headline, support line each carrying different load.

## Output format

```
# Hook matrix — [brand / segment]
[date] · Corpus: [what it was built from] · [n] hooks across [n] tactics

| # | Tactic | Format | Visual | Spoken/Headline | Text/Support | Corpus source |

## Recommended first tests
[3-5 hooks, each with why, mapped to the coverage gap it fills]

## Ladder plan
[Which ship as statics now, which earn motion if they survive]
```

## Handoffs

- Full production briefs around the winning hooks → `paid-ads.md` Step 4
- Body copy past the on-ramp → `copy.md`
- Clustering a competitor's hooks to read their strategy → `competitive.md`
- If an ad-generation MCP is connected (e.g. MaxFusion AI), rung 1-2 executions can be generated directly from the matrix — see the production handoff in `paid-ads.md`
