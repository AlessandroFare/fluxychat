# Analytics & testing

The module that keeps every other module honest. Marketing analysis fails less from missing data than from motivated reading of the data that exists. The job here is the boring one: say what the numbers can support, refuse to say more, and design the test that would settle it.

This is the reference every other module points to when it says "sample-size discipline applies."

## The hierarchy of evidence (marketing edition)

From strongest to weakest — always state which level a claim sits at:

1. **Controlled experiment** — randomized split, one variable, pre-stated metric and sample
2. **Natural experiment** — a clean before/after around one isolated change
3. **Cohort comparison** — same metric across comparable groups, confounders named
4. **Trend correlation** — moved together; cause unknown
5. **Anecdote** — a customer said; a competitor did
6. **Vibes** — the team feels

Most marketing decisions are made at levels 4-6 while being reported at level 1-2. The report's job is to keep the label honest, not to upgrade it.

## Test design — before any data exists

A test is only a test if these are written down **before launch**:

1. **One variable.** Two headlines differing in angle, length and tone produce an uninterpretable result regardless of sample.
2. **One primary metric**, chosen for decision-relevance, not availability. Clicks are available; revenue is relevant.
3. **The decision rule**: "if variant B beats A by ≥X on [metric] at [sample], we ship B." No pre-stated rule → the result will be interpreted to confirm the prior.
4. **The sample target**, and the honest arithmetic behind it: small effects need large samples. If baseline conversion is 2% and you hope to detect a 10% relative lift, you need tens of thousands per arm — if traffic can't supply that in a reasonable window, **test bigger swings instead** (offer, angle, page — not button color). This single reallocation is the highest-value thing this module does.
5. **The stop condition** — date or sample, not "when it looks done."

Test in order of variance: offer → angle → headline → body → CTA → cosmetics. Most button-color tests are a way of avoiding the offer conversation.

## Reading results — the trap catalogue

**Peeking.** Checking daily and stopping at the first significant-looking day guarantees false winners — early "significance" routinely reverses. Run to the pre-stated sample. If the user brings a peeked result, say the result is compromised and by roughly how much, not that it's worthless.

**Small samples.** Ten conversions is noise; fifty is directional; real confidence needs volume proportional to how small the effect is. Never rank options on a handful of conversions each — say "not enough signal to rank; here's what volume would settle it."

**Survivorship.** The ads/emails/pages still running survived selection. Comparing survivors to each other says nothing about what was killed. Ask for the full history including paused items, or state the comparison is conditional on survival.

**Simpson's paradox.** An aggregate can lose while every segment wins, if mix shifts. When aggregate and segment views disagree, the segment view is usually the real one — check mix before concluding.

**Regression to the mean.** Last month's best-performing anything was partly lucky. Its decline this month is partly arithmetic, not fatigue. Diagnose fatigue by the pattern in `ads-diagnostics.md`, not by "our winner declined."

**Attribution windows.** A 1-day-click and 7-day-click view of the same campaign can invert the ranking. State the window on every paid-media claim; never compare across a window change, an iOS/privacy change, or a platform attribution update without flagging the break.

**Open rates.** Inflated by prefetching and bots since privacy changes; weight clicks and replies instead. Impressions measure the algorithm's mood, not content value — replies, saves, profile visits, and gated-resource requests are the social metrics that mean anything.

**Seasonality.** Compare like periods. Q4 CPMs are not Q1 CPMs, Monday is not Saturday, and no creative conclusion is visible through unadjusted seasonal noise.

**The metric that moved because you looked.** Any KPI that became a target got gamed somewhere upstream. When a metric improbably improves, first ask what changed in how it's measured or pursued.

## Deciding under uncertainty — the honest middle

Refusing all conclusions below level-2 evidence is its own failure mode; businesses decide weekly. The honest posture:

- Give the read **with the confidence label attached**: "B looks better — directional, ~60/40, would take N more conversions to call properly."
- Distinguish **reversible from irreversible** decisions: ship directional winners when reverting is cheap; demand real evidence when it isn't (pricing, brand, positioning).
- **Expected value beats significance** for portfolio decisions: five cheap directional bets beat one over-powered test of a trivial variable.
- Recommend the **cheapest next observation** that would most change the decision — often one week of properly-split traffic, or five customer interviews, not a quarter-long study.

## Reporting standard

Every analysis this module touches ends with this block, filled honestly:

```
## Evidence quality
Level: [1-6 per the hierarchy] · Sample: [n] · Window: [dates, attribution setting]
What this CAN support: [the defensible claim]
What this CANNOT support: [the claim the user probably wants]
Cheapest next observation: [the test/data that would upgrade the level]
```

## Rules

- Never compute a fake precision. "Roughly 3x more volume" is honest; "2.94x" from noisy inputs is theater.
- Never back-fill a rationale for a decision already made. If asked to, provide the honest read and note where it diverges from the desired conclusion.
- If statistical tooling is available (code execution), actually compute — proper intervals on real data beat every heuristic above. If not, use the discipline above and say the math was qualitative.
- Do not anchor on the user's own analysis; form the independent read first, then reconcile and state where and why you differ.
