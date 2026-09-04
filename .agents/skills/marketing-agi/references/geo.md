
# GEO Optimizer

Classic SEO optimises for a ranked list. AI search does not return a list — it returns an answer, and a handful of sources get named inside it. Different game, different levers.

The job here: make a page the easiest correct thing for a model to lift, and make the surrounding web agree that it is authoritative.

## Before you start

Read `brand-context.md` if present (working dir, `.claude/`, or `.agents/`). Entity claims are meaningless without knowing what the brand actually is and what it is entitled to claim.

Establish two things from the user, or infer them if obvious — do not interrogate:
1. **The questions they want to win.** Not keywords. Questions, phrased the way a person types into ChatGPT.
2. **Whether they can edit the site.** It determines whether you produce a diff or a brief.

If they cannot name the questions, generate 15 candidates from the product and have them cut.

## The five levers

Everything that moves AI-search citation reduces to these. Audit each, score each 0-100.

### 1. Extractability (25%)

Can a model lift a self-contained, correct answer without needing the rest of the page?

- **Answer-first structure.** The direct answer sits in the first 2-3 sentences under the heading that asks the question. Not after a preamble, not at the end of the section.
- **Self-contained units.** Each section survives being read in isolation. Pronouns resolved, subject restated, no "as mentioned above".
- **Question-shaped headings.** H2/H3 phrased as the question a human asks, matched to the question list.
- **Extractable facts.** Numbers, dates, definitions, comparisons in tables or lists rather than buried in prose.
- **Answer-block length.** A self-contained answer block of roughly 100-170 words is the community-measured sweet spot — long enough to be complete, short enough to be lifted whole. Treat as a heuristic, not a rule.
- **No paywall or JS-gate on the answer itself.**

Fastest diagnostic: take one section, paste it alone, and ask whether it answers the question. If it does not, the page is not extractable.

### 2. Specificity and evidence (25%)

Models preferentially cite sources that contain things they cannot generate themselves.

- Named numbers with a stated source and date
- First-party data, original research, benchmarks — the single highest-leverage GEO asset
- Named entities: real people, real companies, real products, real versions
- Explicit dates on time-sensitive claims
- Stated methodology where a number is claimed

Generic marketing prose is uncitable because a model can already produce it. **If a page contains no fact a model could not have invented, it will not be cited, no matter how well it ranks.**

The one controlled benchmark in this space (the Princeton GEO study, KDD 2024, arxiv.org/abs/2311.09735) measured visibility lifts per tactic: adding quotations ~+41%, adding statistics ~+33%, fluency edits ~+29%, citing sources ~+27% — while keyword stuffing did nothing in generative engines. Directional, engine behaviour has moved since, but the ordering (evidence density beats keyword tactics) has held in every replication.

### 3. Entity clarity (20%)

Does the web have a coherent, consistent understanding of who this brand is?

- One canonical description used everywhere — site, About page, LinkedIn, Crunchbase, G2, directories
- Consistent naming: legal name, product name, and any abbreviation, stated together at least once
- Structured data: `Organization`, `Product`, `FAQPage`, `Article` with `author` and `datePublished`
- An About page that reads like a reference entry, not a manifesto
- Explicit category statement: "X is a [category] for [audience] that [outcome]"

Inconsistent self-description across sources is the most common and most fixable GEO failure.

### 4. Corroboration (20%)

Models weight what other sources say about the brand more than what the brand says about itself.

- Presence in the listicles that answer the target questions ("best X for Y")
- Review-platform presence with volume and recency
- Independent mentions with the canonical description intact
- Comparison pages — both yours and third parties'
- Community surfaces (Reddit, forums, Q&A) where the category is discussed

Audit by actually querying: ask the engines the target questions and record who gets cited. That citation set *is* the competitive set, and it is often not the SEO competitive set.

### 5. Machine access (10%)

- `llms.txt` at the root, if the site has documentation or a large content library
- `robots.txt` not blocking AI crawlers the client wants (GPTBot, PerplexityBot, ClaudeBot, Google-Extended) — and **flag this as a business decision, not a technical default**. Some clients want to block them.
- Clean HTML; primary content not client-side rendered
- Fast, stable, no interstitials over the content

## Anti-citation signals

Positive levers can all be present and citation still not happen because the page carries disqualifiers. Check for these explicitly — removing one is often cheaper than adding anything:

- CTA density high enough that content reads as a funnel step, not a reference
- Interstitials, popups, or cookie walls sitting over the primary content
- Thin pages that restate what a hundred other pages say
- No named author, no about-the-source identity anywhere
- Undated claims on time-sensitive topics
- Keyword-stuffed passages (measured near-useless in generative engines, and a credibility tell)
- Primary content rendered client-side or behind interaction
- Claims with superlatives but no evidence attached ("the leading platform for...")

## Workflow

1. **Baseline.** Query each target question against the engines available to you, **at least three times per question** — citation is non-deterministic and a single observation is noise. Record per query: brand *mentioned* vs brand *domain cited* (different events, track both), who else was cited, what the answer claimed. This is the only real measurement in GEO — everything else is proxy.
2. **Audit** the five levers. Score each. Weight into a total.
3. **Diagnose** which lever is binding. Usually one dominates; fixing the other four moves nothing until it is addressed.
4. **Rewrite.** Produce actual revised page content — answer-first restructures, real headings, real tables, real schema JSON-LD. Not a list of recommendations.
5. **Set up re-measurement.** Same questions, same engines, dated. GEO without a repeat query is astrology.

## Report structure

```
# GEO Audit — [domain]
[date] · Citability score: XX/100

## Baseline: who gets cited today
[Table: question | brand cited? | who was cited | what the answer claimed]

## The binding constraint
[Which lever is actually limiting citation, and why the others don't matter yet]

## Scorecard
[Five levers, scores, weights]

## Rewrites
[Actual revised content, page by page. Before/after.]

## Schema to add
[Complete JSON-LD blocks, ready to paste]

## Re-measure on [date + 30]
[The exact queries to re-run]
```

## Honesty requirements

These are non-negotiable, because GEO is the single most over-claimed area in marketing right now and the credibility of the deliverable depends on not participating in that.

- **No engine publishes its citation criteria.** Everything here is inferred from observed behaviour and from published guidance on helpful content. Say so.
- **Citation is not deterministic.** The same query returns different sources across sessions and regions. One observation is not a measurement — sample at least three times.
- **Do not promise citation.** Promise improved extractability, evidence density and entity consistency, which are the things actually under the client's control.
- **Do not invent traffic figures for AI search.** Attribution here is genuinely immature. If asked to quantify, explain what is and is not measurable rather than producing a number.
- Engine behaviour changes frequently. If the user has search available, verify current behaviour rather than relying on what you remember.

## Handoffs

- Page-level copy quality → the copy module (`copy.md`)
- Broader marketing problems surfaced during the audit → the audit module (`audit.md`)
- Classic technical SEO (crawl, redirects, CWV) → outside this skill's scope; say so rather than half-doing it
