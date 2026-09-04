# Competitive teardown

Intelligence, not evaluation. The output of a teardown is not "their site is bad" — it is what they believe about the market, who they're targeting, where they're spending, and where they're exposed. Read like an analyst, not a rival fan.

If subagents are available, run one per competitor in parallel with this file and the same output schema; synthesize the cross-competitor pattern yourself.

## Sources, in order of signal quality

1. **Their ads** (public ad libraries) — where money goes is what they believe works. Longevity is the strongest single signal available: an ad running for months is being funded because it performs. Full protocol in `paid-ads.md` competitor mode.
2. **Their pricing page** — the most honest page on any site. Structure reveals the target customer; changes over time reveal strategy shifts.
3. **Their job postings** — hiring a "Head of Enterprise Sales" or three ML engineers announces the roadmap a year early.
4. **Customer reviews of them** (G2, app stores, Reddit) — their weaknesses in their customers' words. This is where the attack copy comes from, pre-written by the market.
5. **Their site and blog** — what they say about themselves. Weight it lowest; it's the press release layer.
6. **Their changelog/release notes** — shipping velocity and direction, unspun.

Where web access exists, actually pull these. Where it doesn't, say which sources the teardown is missing and how that limits confidence.

## The teardown protocol (per competitor)

### 1. Positioning read
From homepage + pricing: What category do they claim? Who is the hero customer in their examples? What's the one value claim? What alternative are they positioning against? Run their homepage through the pasteability test — the clauses only they could say are their real position; everything else is decoration.

### 2. Money read
From ads + apparent spend: Which angles are they funding (classify per `copy-frameworks.md`)? Which have they run longest? What did they test and abandon (negative information, free)? Which channels are they absent from — and is that discipline or blindness?

Both major libraries are public and need no API: the **Meta Ad Library** (all active ads per page, with start dates — longevity is readable directly) and the **Google Ads Transparency Center** (search and display, by advertiser). Pull both; a brand heavy in one and absent from the other is itself a finding.

Two structured reads on top of the raw pull:

- **Hook clustering.** Classify every ad's hook against the taxonomy in `hooks.md` and count per tactic. The distribution is the competitor's messaging strategy in one table — a brand running 70% fear/loss hooks believes something specific about its market, and the tactics at zero are the space they've left open.
- **Message-match score.** Follow their top ads to the landing page and score 1-10 how completely the page delivers the ad's promise. A consistently low score on a heavily-funded ad is an exploitable gap: run the same promise and actually keep it.

### 3. Customer read
From reviews: Top 3 loved things (don't attack these; you'll lose). Top 3 complaints (attack surface). The phrase patterns customers use — this vocabulary outranks any persona document. Migration complaints ("switched from X because...") reveal the real competitive set.

### 4. Trajectory read
From jobs + changelog + funding news: Where are they investing? What does the hiring pattern predict? Are they moving upmarket, downmarket, or sideways?

### 5. Exposure read — the deliverable's core
Cross-reference the four reads:
- **The unserved segment**: who do their reviews say they're failing?
- **The silent objection**: what does their marketing refuse to engage with? (The objection nobody answers is usually the one that hurts.)
- **The abandoned angle**: what they tested and dropped may be poison — or may have been badly executed. Flag which you believe.
- **The overextension**: claims their reviews contradict. This is attack copy that writes itself, with receipts.

## Cross-competitor synthesis (when >1)

- **The convergence**: what everyone says. This is the category's table stakes and the zone where differentiation is impossible — flag any of the user's copy living here.
- **The empty quadrant**: map competitors on the two axes buyers actually decide on (price × depth, speed × control, whatever the category's real axes are). The empty quadrant is either the opportunity or the graveyard — check whether someone died there before recommending it.
- **The shared blind spot**: the customer complaint appearing in *everyone's* reviews is either structurally hard (be honest if so) or the open flank.

## Output format

```
# Competitive teardown — [competitor(s)]
[date] · Sources actually accessed: [list] · Missing: [list]

## Executive read
[One paragraph per competitor: what they believe, where they're going, where they're exposed]

## Positioning map
[The axes, the placements, the empty space, and whether the empty space is opportunity or graveyard]

## What they're funding
[Angle/channel table with longevity signals]

## The exposure
[Ranked openings, each with the evidence and the specific move it implies]

## What NOT to do
[Their strengths per their customers — the fights to avoid]

## Steal list
[Specific things they do well that are worth adopting, with attribution to what/where]

## What I couldn't determine
```

Route the "moves" downstream: positioning openings → `positioning.md`, attack copy → `copy.md`, channel gaps → `paid-ads.md`.

## Rules

- **Public sources only.** No scraping behind logins, no fake trial signups for intel, no soliciting confidential information, no pretexting. Beyond ethics, intel gathered that way can't be used publicly anyway.
- **Inference labeled as inference.** "Their hiring suggests an enterprise push" is analysis; "they are pivoting to enterprise" is a claim you can't make. Keep the epistemic labels on.
- **Respect the null result.** If the teardown finds a competitor is simply strong with no meaningful exposure, that is a finding — say it, and redirect energy to segment selection rather than manufacturing a fake weakness.
- Longevity/spend signals from ad libraries are inference from public behavior, not performance data. Say so once in the report.
