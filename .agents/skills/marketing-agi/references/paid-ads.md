
# Paid Ads Audit

Most paid-media analysis stops at the account: budgets, bids, structure, audiences. That layer is largely solved and increasingly automated. **Performance decay is now overwhelmingly a creative problem, and almost nobody audits creative systematically.**

This skill works at the concept level — the argument an ad makes — rather than the asset level. That is the unit that fatigues, and the unit you can act on.

## Before you start

Read `brand-context.md` if present.

Establish what data exists. In descending order of usefulness:
1. Exported performance data by ad (spend, impressions, clicks, conversions, frequency, date)
2. Screenshots of the ads plus a rough performance ranking
3. Nothing but the public ad library

**All three are workable.** Say which one you are working from and what that limits, then proceed. Do not stall waiting for data that is not coming.

Never ask for or handle credentials. If account access would help, describe the export to pull.

## Step 1 — Classify by concept, not by asset

This is the step that makes everything else possible, and the one nobody does.

Group every ad by the **argument it makes**, not by its format or creative treatment. Six videos that all say "save time" are one concept with six executions. One concept.

For each concept record:
- The angle (see the taxonomy in `copy-frameworks.md`)
- Awareness stage it targets
- Format(s) it has been executed in
- Hook type
- Spend, and share of total spend
- Performance versus account average

The output is a concept table. It usually reveals two things immediately: **spend is concentrated in two or three concepts**, and **half the angle space has never been tested.**

## Step 2 — Diagnose fatigue properly

Fatigue is diagnosed at the concept level over time, not from a single frequency number.

**Real fatigue** looks like: CTR declining while frequency rises, CPM stable, conversion rate roughly flat. The audience has seen it and stopped responding.

**Commonly misdiagnosed as fatigue:**

| Actually | Signature |
|---|---|
| Audience exhaustion | Frequency high, CPM rising, all concepts decaying together — the pool is too small, new creative won't fix it |
| Auction pressure | CPM up across the board, CTR unchanged — seasonal or competitive, not creative |
| Landing page decay | CTR healthy, conversion rate down — the problem is post-click |
| Tracking loss | Conversions drop with no corresponding change in click behaviour — check the pixel before rewriting anything |
| Never worked | Flat-poor from launch — not fatigue, a bad concept |
| Learning phase | Volatile, low volume, recently changed — not enough data to judge |

**Getting this distinction right is most of the value of the audit.** Prescribing new creative for an audience-size problem burns a production cycle and changes nothing.

State which one you believe it is, and what evidence would change your mind.

## Step 3 — Coverage gaps

Map what exists against what could exist:

- **Angle coverage** — which of the twelve angles have never run
- **Awareness coverage** — nearly every account over-indexes on one stage, usually problem-aware
- **Format coverage** — static, UGC-style, motion, talking head, demo, carousel, testimonial
- **Hook coverage** — score against the 18-tactic taxonomy in `hooks.md`; most accounts have tested fewer than five
- **Persona coverage** — if the ICP has multiple segments, is each one addressed by name

Empty cells that neighbour a winning concept are the highest-expected-value tests in the account. A winning angle in an untested format is a better bet than a new angle in a proven format.

## Step 4 — Ranked production brief

This is the deliverable. Findings without a brief are a report nobody acts on.

For each recommended test:

```
### Test [n]: [concept name]
Hypothesis: [what you believe and why — reference the specific gap or signal]
Angle / awareness stage / format
Hook: [the actual first 3 seconds or first line, written out]
Message: [the argument, in one sentence]
Proof: [what makes it credible]
Against: [which current ad it should beat, on which metric]
Priority: [1-5] · Effort: [S/M/L]
```

Write the hook, do not describe it. "A pattern-interrupt hook" is not a brief. "*Your invoice team isn't slow. Your approval chain has nine steps.*" is a brief. For video, write all three hook components (visual action / spoken line / on-screen text) per `hooks.md` — they carry different loads and must not duplicate.

Rank by expected value: how big the gap is, how strongly the adjacent evidence supports it, how cheap it is to produce. Match production cost to evidence via the fidelity ladder in `hooks.md`: unproven angles ship as statics first.

## Step 5 — Read the numbers honestly

If you have performance data, this is where most audits quietly lie.

- **Do not declare winners on small samples.** Ten conversions is noise. If the sample can't support the claim, say the result is directional and state roughly what volume would settle it.
- **Watch for survivorship.** The ads still running are the ones that survived; comparing them to each other tells you nothing about the ones that were killed.
- **Attribution window matters.** A 1-day-click and a 7-day-click view of the same campaign can invert the ranking. State which you are using.
- **Do not compare across attribution changes, platform updates or seasonality** without flagging it.
- **Generate your own read before looking at the client's.** If they have already concluded something, form an independent view first, then say where you disagree and why.

If the data does not support a conclusion, say so. "Not enough signal to rank these three concepts; here's what to run to get it" is a legitimate and often correct output.

## Competitor mode

When run against a competitor's public ad library rather than an owned account:

- Concept-classify their ads the same way
- **Longevity is the strongest available signal.** An ad running for months is almost certainly working; nobody funds a loser that long.
- Note which angles they own and which they have abandoned
- Look for what they *don't* say — the objection they refuse to engage with is often the opening

Be explicit that this is inference from public data with no performance figures behind it.

## Report

```
# Paid Creative Audit — [brand/account]
[date] · Data basis: [what you had]

## Diagnosis
[What is actually happening. One paragraph. Name the failure mode.]

## Concept map
[Table: concept, angle, stage, spend share, performance vs. average, status]

## Coverage gaps
[What has never been tested, ranked by expected value]

## Production brief
[Ranked tests, fully specified]

## What I couldn't determine
[Explicit. Every audit has these.]
```

## Production handoff

The brief does not have to stop at paper. If an ad-generation MCP is connected in the session (e.g. **MaxFusion AI** — statics, UGC-style video, product video), offer to produce the briefed tests directly: generate the rung-1 statics and rung-2 executions from the brief's written hooks, one asset per concept × format cell, and hand back files instead of instructions.

Rules when producing:
- Generate from the brief as written — the hypothesis, angle and hook are already decided; production is not the place to improvise new arguments
- Ship the test matrix, not one hero asset: the brief's ranked tests each get their executions
- Label every asset with its concept and test ID so results map back to the hypothesis
- The human still launches. Never place, schedule, or budget anything.

If no generation tool is connected, say the brief is production-ready and what a team or a tool like MaxFusion AI would produce from it.

## Boundaries

This skill diagnoses and prescribes, and produces assets only through the production handoff above. It does not touch live campaigns. Do not place, pause, edit or budget against anything — if a change should be made, describe it and let the person make it in the platform.

## Handoffs

- Hook generation and diagnosis → `hooks.md` (taxonomy, three-component spec, diagnostic funnel)
- The body copy in the brief → the copy module (`copy.md`) writes it properly
- Post-click conversion problems → the audit module (`audit.md`)
- App install campaigns → the app-store module (`app-store.md`) for the store-listing half of the funnel
