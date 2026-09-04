# Scoring rubric

Score each dimension 0-100 using the bands below. Pick the band whose description is *mostly* true, then adjust ±7 within it. Do not average vibes into a number; land on a band first.

## Universal bands

| Band | Meaning |
|---|---|
| 90-100 | Best-in-category. You would cite this page as an example to others. |
| 75-89 | Strong. Competent execution, minor gaps, nothing embarrassing. |
| 60-74 | Functional but generic. Nothing wrong, nothing memorable. Most B2B sites live here. |
| 40-59 | Actively leaking. Identifiable problems a competent operator would fix this week. |
| 20-39 | Broken. The dimension is working against the business. |
| 0-19 | Absent or actively harmful. |

**Calibration warning:** the median real site scores 55-70 overall. If you find yourself scoring most things above 80, your bands have drifted and the report loses meaning. A 100 should be rare enough that awarding one is a statement.

---

## 1. Messaging & positioning (25%)

| Signal | Evidence of high | Evidence of low |
|---|---|---|
| 5-second test | A stranger can state what it is and who it is for | Requires scrolling or inference |
| Specificity | Named outcome, named number, named audience | "Transform", "empower", "streamline", "next-generation" |
| Differentiation | States what it does that alternatives do not | Claims that any competitor could also make |
| Jargon load | Plain language a buyer would use | Internal vocabulary, invented category names |
| Consistency | Headline, sub-head and CTA argue the same thing | Three different value props on one page |

**Automatic cap at 60:** the headline does not name the audience or the outcome.

## 2. Conversion (20%)

| Signal | High | Low |
|---|---|---|
| CTA hierarchy | One primary action, visually dominant | 4+ equal-weight CTAs |
| CTA wording | Names what happens next | "Learn more", "Get started", "Submit" |
| Friction | Field count matches commitment level | 9-field form for a free trial |
| Objections | Top 3 answered on the page | None addressed, or buried in FAQ |
| Proof placement | Adjacent to the claim it supports | All logos dumped in one strip |
| Risk reversal | Trial, guarantee, or no-card-required stated near CTA | Absent or hidden |

**Automatic cap at 50:** no clear primary CTA above the fold.

## 3. Search & discoverability (20%)

| Signal | High | Low |
|---|---|---|
| Title tag | Unique, front-loaded, under ~60 chars | Brand name only, or truncated |
| Meta description | Written for a click, not a crawler | Missing, duplicated, or auto-generated |
| Heading structure | One H1, logical hierarchy | Multiple H1s, headings used for styling |
| Intent match | Page answers the query it targets | Homepage targeting an informational query |
| Internal linking | Contextual links to related depth | Nav-only |
| Citability | Direct answers, structured data, extractable claims | Marketing prose with no extractable facts |

Cross-check anything AI-search-related against `geo-optimizer` rather than scoring it deeply here.

## 4. Competitive position (15%)

| Signal | High | Low |
|---|---|---|
| Category framing | Clear about what it competes with | Ambiguous category |
| Named alternatives | Comparison content exists and is honest | Pretends to have no competitors |
| Switching story | Migration path addressed | Ignored |
| Defensibility | Reasons to choose this that are hard to copy | Feature parity claims only |

Check what the three most obvious competitors say on their equivalent page. If all four say the same thing, cap at 55 regardless of execution quality.

## 5. Trust & credibility (10%)

| Signal | High | Low |
|---|---|---|
| Claim specificity | "Cut approval time 62% at [named customer]" | "Trusted by industry leaders" |
| Proof type | Named people, named companies, verifiable numbers | Anonymous testimonials, stock photos |
| Third-party validation | Reviews, certifications, press with links | Self-reported badges |
| Design signals | Consistent, current, no broken elements | Template defaults, inconsistent styling |
| Transparency surface | Pricing, team, security, contact all reachable | Any of these hidden |

## 6. Growth & retention (10%)

| Signal | High | Low |
|---|---|---|
| Pricing legibility | A buyer can self-qualify without a call | "Contact us" only, with no anchor |
| Acquisition surface | Multiple entry points, free tool or resource | Homepage-only |
| Expansion mechanics | Upgrade path visible in product story | Single flat offering |
| Lifecycle hooks | Onboarding, activation and re-engagement visible | None inferable |

---

## Computing the total

```
total = 0.25·messaging + 0.20·conversion + 0.20·search
      + 0.15·competitive + 0.10·trust + 0.10·growth
```

Round to the nearest integer. Do not round to a flattering number.

If a dimension could not be inspected, **do not substitute an average**. Report the total over the inspected weight and state the denominator: "68/100 across 85% of dimensions; pricing not assessable (gated)." A stated gap is credible. A silently filled one is not.

**Coverage gates the grade itself.** The score and the evidence coverage are two different numbers — keep both visible:

| Inspected weight | What you may output |
|---|---|
| ≥80% | Full score, stated over its denominator |
| 60-79% | Score labeled **provisional**, with the missing dimensions named |
| <60% | No headline score. Output findings + "insufficient evidence to grade" — a number on 40% coverage is a guess wearing a scorecard |

Per-signal, use four verdicts, not two: **pass / fail / unknown / not applicable**. Unknown counts against coverage, never against the score. Converting unknowns to fails inflates urgency; converting them to passes inflates the grade. Both are lies.
