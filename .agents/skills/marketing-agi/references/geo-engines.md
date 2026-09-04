# Engine playbooks

Behaviour differs enough between answer engines that a single "GEO checklist" is a lie. What follows is observed behaviour and published guidance, not documented ranking criteria — none of these engines publish citation rules.

**Verify before relying on any of this.** These surfaces change on a scale of weeks. If web search is available, check current behaviour first.

---

## Google AI Overviews / AI Mode

**What it draws on:** predominantly pages already performing in classic organic results. Ranking is close to a prerequisite; citability is what converts a ranking into a citation.

**What moves it**
- Conventional SEO fundamentals still apply — this is the one engine where they are load-bearing
- Passage-level extractability: AI Overviews frequently lift a single section, so each section must stand alone
- Structured data for entity clarity: `Organization`, `Product`, `Article` with real `author` and `datePublished`
- Demonstrable first-hand experience: original photography, named authors with credentials, stated methodology
- Freshness signals on anything time-sensitive

**Schema deprecation warning:** Google retired `HowTo` rich results in 2025 and stripped `FAQPage` rich results for most sites (fully by May 2026). The markup still aids machine comprehension and costs little to keep, but do not promise rich-result visibility from either, and do not let a report recommend them as if it were 2023. Verify the current rich-results list before recommending any schema for display purposes.

**What does not**
- Keyword density
- Thin comparison pages generated at scale
- Schema that does not match visible page content — this is a stated Google violation, not a grey area

**Note:** Google publishes guidance on AI features and on helpful content. Treat that guidance as the primary source and treat third-party GEO advice — including this file — as secondary.

---

## ChatGPT (with browsing / search)

**What it draws on:** live retrieval at query time plus training-data priors about the brand.

**What moves it**
- Entity consistency across the open web. The model's prior about a brand is formed from many sources; a contradictory or absent description costs citations before retrieval even runs.
- Presence in the listicles and roundups that answer the target question. These are heavily retrieved.
- Clean, fast, non-JS-gated HTML
- Recency on anything the query implies is current
- `GPTBot` allowed in robots.txt, if the client wants the traffic

**Distinctive weakness to exploit:** it will confidently describe a brand from stale priors. Query the brand name directly and record what it says. Correcting a wrong prior is done by fixing the corroborating sources, not the site.

---

## Perplexity

**What it draws on:** aggressive live retrieval, many sources per answer, citations displayed prominently.

**What moves it**
- Direct answers near the top of the page — Perplexity favours pages that answer fast
- Breadth of corroboration: it cites many sources, so being one of eight is realistic where being one of two is not
- Recency, weighted heavily
- Community and forum presence for opinion-shaped questions
- `PerplexityBot` access

**Practical note:** Perplexity is the cheapest engine to measure against, because citations are visible and consistent enough to track week over week. Use it as the primary measurement surface even when it is not the primary traffic target.

---

## Claude, Copilot, Gemini and the rest

Less studied, and the honest position is that the differentiated tactics are not well established. What generalises:

- Extractable structure
- Factual density with sources
- Entity consistency
- Crawler access

Do not invent engine-specific tactics for these. If asked, say the differentiated playbook is not established and that the general levers apply.

---

## llms.txt

A proposed convention: a markdown file at `/llms.txt` listing the site's key pages with short descriptions, so a model can navigate the site efficiently.

**Adoption is marginal and its effect is not established** — measured adoption sits well under 1% of top-1000 sites, and no major engine has publicly confirmed consuming the file. The strongest public evidence review (in the claude-seo project's `llmstxt-evidence.md`) concludes it is not currently a citation lever. Recommend it when:
- The site has substantial documentation or a large content library
- It costs an hour to produce

Do not recommend it as a primary GEO tactic for a five-page marketing site, and do not claim it drives citations. Positioning it as a cheap, low-risk hygiene item is honest; positioning it as a lever is not.

Minimal format:

```markdown
# Company Name

> One-sentence description of what the company does, for whom.

## Docs
- [Getting started](https://example.com/docs/start): What it covers
- [API reference](https://example.com/docs/api): What it covers

## Key pages
- [Pricing](https://example.com/pricing): Plans and what each includes
```

---

## Crawler directives

| Engine | User-agent |
|---|---|
| OpenAI (search/browse) | `OAI-SearchBot` |
| OpenAI (training) | `GPTBot` |
| Perplexity | `PerplexityBot` |
| Anthropic | `ClaudeBot` |
| Google AI training opt-out | `Google-Extended` |

**Always surface the trade-off rather than defaulting.** Blocking `GPTBot` reduces training exposure but may reduce citation. Blocking `Google-Extended` does not remove a site from AI Overviews, which is a common and expensive misunderstanding. Publishers with a licensing strategy may deliberately want to block. Present the choice; let the client make it.

Verify current user-agent strings before writing them into a client's robots.txt — these get renamed.
