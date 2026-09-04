
# Copy Lab

Most copy tools hand back one draft. One draft is a guess. This produces a set, scores it, and shows the reasoning — so the choice is informed rather than aesthetic.

Three stages, and none is optional: **generate wide → score hard → de-slop.**

## Before you start

Read `brand-context.md` if present. Without it, output will be competent and interchangeable, which is the failure mode this skill exists to prevent.

You need three things. Extract from the conversation first; ask only for what is genuinely missing, and ask for all of it at once:

1. **Who is reading this, and what do they already believe?** Not a demographic. A belief state.
2. **What is the one action?** One. Copy that asks for two things gets neither.
3. **What is true here that a competitor could not also say?** If nothing, say so plainly — that is a positioning problem and no amount of copy fixes it. Flag it and continue.

## Stage 1 — Generate wide

Produce **15-20 variants**, not 3. Volume is not padding: the good one is usually variant 12, and you cannot reach it without writing 11 first.

Force spread by working across distinct angles rather than rephrasing one idea. Pull from `copy-frameworks.md` — it holds the angle taxonomy, the awareness-stage ladder, and the offer structures. Read it before generating; generating from memory collapses toward the same three angles every time.

Cover at minimum:
- Problem-agitation
- Specific outcome with a number
- Contrarian or pattern-interrupt
- Identity ("for people who...")
- Mechanism ("the reason X works is...")
- Direct offer
- Objection-first
- Curiosity gap — **used sparingly**, and never writing a cheque the page does not cash

**Match the awareness stage.** Copy pitched at the wrong stage fails regardless of craft. Unaware readers need the problem named; most-aware readers need the deal. Writing "unaware" copy for a most-aware audience is the most common expensive mistake in this category.

## Stage 2 — Score against the panel

Score every variant against five perspectives. Each is 0-20. Total 100.

| Perspective | Asks | Fails when |
|---|---|---|
| **The skeptic** | Would a smart, busy, distrusting reader believe this? | Unsupported superlatives, claims with no proof adjacent |
| **The stranger** | Read cold, with no context, does this land in 3 seconds? | Requires the rest of the page to make sense |
| **The competitor** | Could a rival paste their logo on this unchanged? | Yes → it is not positioning, it is decoration |
| **The buyer** | Does this speak to what they actually worry about at 2am? | Speaks to what the company is proud of instead |
| **The editor** | Is every word load-bearing? | Adverbs, hedges, throat-clearing, "in today's world" |

**Iterate, don't just rank.** Any variant scoring 70-84 is a rewrite candidate, not a reject: take the panel's specific objection, fix that one thing, re-score. Two or three passes typically move a 76 into the high 80s. Stop at 90+, or at three passes — beyond that you are polishing, not improving.

Kill anything under 70 outright. Do not show it. A list padded with weak options makes the strong ones harder to see.

## Stage 3 — De-slop

Run every survivor through `slop-patterns.md`. It catalogues the constructions that make writing read as machine-generated — and it matters more than it sounds, because a reader who clocks copy as AI-written discounts the claim, not just the prose.

The highest-frequency offenders, checked every time:

- **The "not just X, but Y" construction.** Near-universal tell. Rewrite as a direct statement.
- **Tricolon everywhere.** Three-part lists are fine occasionally and damning as a default rhythm.
- **Empty intensifiers.** "Truly", "genuinely", "incredibly", "seamlessly", "effortlessly".
- **Abstract nouns doing the work.** "Solutions", "offerings", "capabilities", "experiences".
- **Symmetrical sentence length.** Human writing varies. Machine writing metronomes.
- **The em-dash-heavy summarising clause** — like this one — used more than once per paragraph.
- **"In today's fast-paced world"** and every relative of it.
- **Hedging on claims that should be flat.** "Can help you potentially reduce" → "cuts".

De-slop is a rewrite pass, not a find-and-replace. Removing the word is not enough if the underlying rhythm survives.

## Output

```
## Recommended: [variant]
[The copy]
Score: XX/100 · [one line: why this one]

## Runners-up
[2-3 variants, scored, each with a one-line note on when you'd pick it instead]

## What I'd test first
[The single sharpest contrast in the set, and what a result would tell you]

## Flagged
[Anything you couldn't verify, any claim that needs legal or factual sign-off,
 any positioning problem the copy is papering over]
```

Deliver the copy first. Reasoning after. Nobody wants three paragraphs of preamble before the headline.

## Rules that hold regardless of brief

**Never invent proof.** No fabricated statistics, testimonials, customer names, awards or case studies — not as placeholders, not as examples. If a claim needs a number, write `[NEED: conversion figure]` and flag it. Inserting a plausible-looking fake number into marketing copy is how a client ships a false advertising claim.

**Specific beats clever.** "Cut invoice approval from 6 days to 4 hours" outperforms anything with a pun in it.

**Write to one person.** "Marketing teams" is nobody. "You, on Friday, with the deck still unwritten" is somebody.

**Cut the first sentence.** It is almost always throat-clearing. Check whether the second sentence is the real opening. It usually is.

**Do not anchor on the user's draft.** Read the brief, generate independently, then compare. Starting from their version inherits their ceiling.

**Say when the problem is not the copy.** If the offer is weak, the price is wrong, or the product does not differentiate, better words will not fix it. Saying this costs one uncomfortable sentence and saves a wasted quarter.

## Handoffs

- Whole-page or funnel problems → the audit module (`audit.md`)
- Copy destined for ad platforms → the paid-ads module (`paid-ads.md`) for the fatigue and angle-coverage view
- Video and ad **hooks** specifically → `hooks.md` (three-component spec, 18-tactic taxonomy); headlines here, hooks there
- Copy that needs to be citable by AI search → the GEO module (`geo.md`)
- App store listings → the app-store module (`app-store.md`)
