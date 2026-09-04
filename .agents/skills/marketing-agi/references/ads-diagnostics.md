# Fatigue diagnostics

Getting the diagnosis right is most of the value of a creative audit. Prescribing new creative for an audience-size problem burns a production cycle and changes nothing.

Read the metrics as a pattern, never individually. Frequency alone diagnoses nothing.

---

## The decision table

| CTR | CPM | CVR | Frequency | Diagnosis | Action |
|---|---|---|---|---|---|
| ↓ | → | → | ↑ | **True creative fatigue** | New concepts, not new executions of the same one |
| ↓ | ↑ | → | ↑ | **Audience exhaustion** | Expand the pool. New creative won't fix a small audience. |
| → | ↑ | → | → | **Auction pressure** | Seasonal or competitive. Not a creative problem. Check the calendar. |
| → | → | ↓ | → | **Post-click problem** | Landing page, offer, or checkout. Stop rewriting ads. |
| ↓ | → | ↓ | → | **Message-match break** | Ad promises something the page doesn't deliver |
| ↓↓ | → | ↓↓ | → | **Tracking failure** | Verify the pixel before concluding anything else |
| flat-poor from launch | — | — | low | **Bad concept** | Never worked. Not fatigue. Kill it. |
| volatile, low volume | — | — | low | **Insufficient data** | Recently launched or edited. Wait. |

**Check tracking first, always.** A pixel break looks exactly like a catastrophic creative failure and is far more common than a genuine overnight collapse. Rewriting ads to fix a broken pixel is the single most wasteful thing a team can do in this situation.

---

## Platform mechanics that impersonate creative events

Before attributing any inflection to creative, rule out the machine. These are system behaviours, mostly Meta's, that read as creative failures and are not:

- **Learning-phase resets.** Significant edits (creative swaps, meaningful budget jumps, audience or optimization changes) throw the ad set back into learning: volatile costs, unstable delivery. Judging performance during a reset judges nothing. Check the change history against the inflection date before anything else.
- **The breakdown effect.** Delivery systems shift budget toward the segments converting *right now*, so any per-segment breakdown shows money in segments that look inefficient in the report — by design, because the report shows averages and the system chases margins. Do not conclude "this placement/audience is wasting spend" from a breakdown table alone.
- **Auction overlap.** Multiple ad sets from the same account bidding on the same users inflate costs in ways that look like fatigue. Check audience overlap before diagnosing creative decay across several ad sets simultaneously.
- **Pacing.** Budget-constrained and cost-cap campaigns deliberately buy unevenly across the day and the auction. A "bad day" inside a pacing window is not a signal.

**The delivery-era corollary for creative volume:** modern delivery systems do audience-finding from the creative itself — the creative *is* the targeting. Variety across genuinely different concepts expands reach; five polished executions of one concept do not. This shifts the production question from "make it better" to "make it argue something different" — which is what the coverage map in `paid-ads.md` measures.

---

## Frequency, properly understood

Frequency thresholds circulate as universal rules. They aren't.

- **Broad prospecting:** decay typically becomes visible somewhere around 2-3, but varies enormously by category and creative strength
- **Retargeting:** much higher frequency is normal and often fine — the audience is small and warm by design
- **Considered purchase:** high frequency is expected; multiple exposures are part of the mechanism

**The number is only meaningful as a trend against CTR.** Frequency 4 with stable CTR is fine. Frequency 1.8 with falling CTR is a bad concept, not fatigue.

Never quote a frequency threshold as a rule. Read the trend.

---

## Concept lifespan

The fatigue curve runs at the concept level, not the asset level. A concept passes through:

1. **Learning** — volatile, don't judge
2. **Peak** — best performance, scale here
3. **Plateau** — stable, still profitable
4. **Decay** — CTR sliding, CPA climbing
5. **Dead** — below account average

**Refreshing the execution of a decayed concept usually buys very little.** New footage making the same argument to the same audience fatigues fast, because what exhausted was the argument. Genuine recovery requires a new angle or a new awareness stage.

The corollary matters for the production brief: **a proven angle in an untested format is a better bet than a new angle in a proven format.** It carries the validated argument into fresh territory.

---

## Reading data honestly

**Survivorship.** The ads still running survived a selection process. Comparing them to each other says nothing about what was killed. Ask for the full history, including paused ads, or state that the comparison is conditional on survival.

**Sample size.** Ten conversions is noise. Fifty is directional. Meaningful differences need real volume. If the data can't support the claim, say the result is directional and state roughly what volume would settle it. Do not manufacture confidence.

**Attribution windows.** A 1-day-click and a 7-day-click view of the same campaign can invert the ranking entirely. Always state which you are using. Never compare across a window change.

**Platform changes.** Algorithm updates, attribution changes and privacy changes create step changes that look like creative events. Check whether the inflection point aligns with a known platform change before attributing it to a creative decision.

**Seasonality.** Compare like periods. Q4 CPMs are not Q1 CPMs and no creative decision is visible through that noise.

**Simpson's paradox.** A concept can lose on aggregate while winning in every segment, if the segment mix differs. When aggregate and segment views disagree, the segment view is usually the real one.

---

## Signals available without account access

Working from a public ad library only:

- **Longevity is the strongest signal there is.** An ad running for months is almost certainly profitable — nobody funds a loser that long. Rank by run duration.
- **Variant count** — many variants of one concept means they found something and are exploiting it
- **Recency** — what launched in the last 30 days shows where they're currently exploring
- **Abandonment** — angles they ran heavily and then dropped were probably tested and lost, which is free negative information
- **Placement spread** — which surfaces they buy tells you where the audience is
- **Silence** — the objection they never engage with is often the opening

Be explicit that this is inference from public data with no performance figures behind it. It is genuinely useful and it is not measurement.
