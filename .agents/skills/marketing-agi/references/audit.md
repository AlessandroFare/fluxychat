
# Marketing Audit

Turn one URL into a scored, prioritized, defensible marketing audit.

The output is not a list of observations. It is a decision document: what is broken, how much it costs, what to fix first, and how confident you are.

## Before you start

Look for `brand-context.md` in the working directory, `.claude/`, or `.agents/`. If it exists, read it — it holds the product, ICP, positioning, tone and constraints, and it changes almost every judgement below. If it does not exist, run the audit anyway but say in the report that findings are un-contextualised, and offer to generate the file at the end.

Ask for at most one thing before starting: whether this is **their own site** or a **prospect/competitor**. It changes the register of the report (internal fix-list vs. sales artefact) and nothing else. If the intent is obvious from the conversation, do not ask.

## Workflow

### 1. Reconnaissance

Fetch the URL. Then fetch, where they exist: the pricing page, one product/feature page, the about page, and the highest-traffic blog post. Five pages is enough for a real audit; twenty is procrastination.

Capture as you go: the headline, the sub-head, every CTA and its wording, the pricing model, visible social proof, and the first three objections a sceptical buyer would raise.

### 2. Analyse across six dimensions

If subagents are available, spawn one per dimension and run them in parallel. If not, work through them in order — the sequence below is deliberate, since messaging findings inform conversion findings.

| # | Dimension | Weight | What it interrogates |
|---|---|---|---|
| 1 | Messaging & positioning | 25% | Value prop clarity, headline specificity, "so what" test, jargon load, differentiation, whether a stranger understands the product in 5 seconds |
| 2 | Conversion | 20% | CTA hierarchy and wording, form friction, objection handling, social proof placement, risk reversal, path from landing to activation |
| 3 | Search & discoverability | 20% | Title/meta quality, heading structure, intent match, internal linking, indexability, whether the page can be cited by AI search |
| 4 | Competitive position | 15% | Category framing, named alternatives, switching cost, what the three obvious competitors say instead |
| 5 | Trust & credibility | 10% | Proof density, specificity of claims, third-party validation, design signals, security and compliance surface |
| 6 | Growth & retention | 10% | Pricing legibility, acquisition surface, referral and expansion mechanics, lifecycle hooks |

For each dimension produce: a 0-100 sub-score, the three highest-value findings, and one thing that is already working. **Always include the thing that is working.** An audit that is entirely negative reads as generated rather than observed, and it destroys the credibility of the criticisms.

Score against the rubric in `audit-rubric.md`. Read it before scoring — consistent scoring is the whole value of the artefact, and an ad-hoc number is worse than no number.

### 3. Synthesise

Compute the weighted total. Then do the part that separates this from a checklist: **find the pattern**. Individual findings are cheap. Saying "every one of your conversion problems traces back to the fact that the headline never names who this is for" is what the reader pays for.

Sort every finding into a 2×2 of impact against effort. The action plan is the high-impact/low-effort quadrant, in order. Everything else goes in an appendix.

### 4. Report

Use this structure exactly:

```
# Marketing Audit — [domain]
[date] · Overall score: XX/100

## The one thing
[Single paragraph. The pattern behind the findings. If they read nothing else.]

## Scorecard
[Table: dimension, score, weight, weighted contribution, one-line verdict]

## Fix these first
[3-5 items. Each: what, why it matters, what to change it to (be specific — write the
actual replacement headline, do not describe it), effort (S/M/L), confidence (high/med/low)]

## What's already working
[2-3 items. Do not skip.]

## Full findings
[By dimension]

## Appendix: lower-priority items
```

Write replacement copy, not instructions to write copy. "Your headline is vague" is worthless. "Replace *Transform your workflow* with *Cut invoice approval from 6 days to 4 hours*" is the deliverable.

## Scoring discipline

These numbers are heuristics derived from marketing judgement. They are not measured performance and they are not anyone's internal ranking data. **Say so in the report.** A stated limitation is more persuasive than a fake precision, and a reader who catches you overclaiming discards the whole document.

Never score a dimension you could not actually inspect. If the pricing page is gated, say the pricing dimension is unscored and explain what would change the number. Partial audits are honest; invented numbers are not.

Do not anchor on any score the user suggests. Form your own, then compare.

## Adapting the register

**Own site** → direct, unhedged, fix-list format. Assume the reader can act today.

**Prospect** → lead with the cost of the problem before naming the problem. End with what a first engagement would tackle. Never open with a number below 50; open with what is working, then the gap. A prospect who feels attacked does not book a call.

**Competitor** → analytical, not evaluative. The output is intelligence: what they believe about the market, who they are targeting, where they are exposed.

## Output format

Write the report to a file — `marketing-audit-[domain]-[date].md` — rather than dumping it into the conversation. It is a document people forward, and it needs to survive leaving the chat.

If PDF conversion is available and the audit is for a prospect, offer it. Client-facing PDFs are the single highest-leverage upgrade to this deliverable.

## Handoffs

- Findings that are mostly copy problems → the copy module (`copy.md`) will rewrite them properly
- Findings about AI-search visibility → the GEO module (`geo.md`) goes far deeper
- Findings about paid traffic quality → the paid-ads module (`paid-ads.md`)
- No `brand-context.md` existed → offer to generate one from what you learned
