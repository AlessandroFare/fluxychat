# Store specifications

**Verify these before shipping copy.** Both stores change limits and rules, and writing to a stale character count wastes a submission cycle. If web search is available, confirm current values first. What follows is the working baseline.

---

## The critical difference

| | App Store | Google Play |
|---|---|---|
| Dedicated keyword field | **Yes** (hidden, 100 chars) | **No** |
| Description indexed for search | **No** | **Yes** |
| Where keywords go | Title, subtitle, keyword field | Title, short description, full description |

**This inverts the strategy.** On App Store the description is pure conversion copy — write it for a human, since it earns you nothing in search. On Play the description does double duty and must carry terms naturally without turning into keyword soup, which Play penalises.

Applying App Store logic to Play (thin description) or Play logic to App Store (keyword-stuffed description) are the two most common structural ASO errors.

---

## App Store fields

| Field | Limit | Indexed | Notes |
|---|---|---|---|
| App name | 30 | Yes, heavily | Brand + strongest term |
| Subtitle | 30 | Yes, heavily | Second term + outcome. Highest-value 30 characters in the listing. |
| Keyword field | 100 | Yes | Comma-separated, **no spaces after commas** — spaces waste characters |
| Promotional text | 170 | No | Editable without review. Use for launches, offers, seasonal. |
| Description | 4,000 | No | Pure conversion copy. First ~3 lines visible before "more". |
| What's New | 4,000 | No | Read more than expected; do not ship "bug fixes" |

**Keyword field rules that materially change the output:**
- Do not repeat words already in the name or subtitle — they are already indexed and you are burning characters
- Do not include the category name; it is implicit
- Singular forms generally cover plurals
- Omit articles and conjunctions
- The store auto-combines terms across fields, so target single words and let it build phrases

**Screenshots:** up to 10 per device size. First 3 appear in search results. Portrait strongly preferred for phone-first apps — landscape crops badly in browse.

---

## Google Play fields

| Field | Limit | Indexed | Notes |
|---|---|---|---|
| App name | 30 | Yes, heavily | Brand + primary term |
| Short description | 80 | Yes, heavily | Appears above the fold. Doubles as the strongest conversion line. |
| Full description | 4,000 | Yes | Terms should appear naturally; repetition is penalised |
| Feature graphic | — | No | 1024×500. Shows above screenshots; often ignored and shouldn't be. |

**Full description guidance:** aim for natural placement of primary terms a handful of times across 4,000 characters. Do not target a density figure — Play's spam detection penalises mechanical repetition, and readable copy outperforms optimised copy in practice.

**Screenshots:** 2-8 per device type. Minimum 2 to publish. Feature graphic is mandatory and is the first visual many users see.

---

## Localisation

Each localisation gets its own indexed keyword set. This is the highest-ROI ASO work available to most apps and it is routinely skipped.

- **Localise, do not translate.** Terms people search for differ from literal translations. Run autocomplete in each target locale.
- App Store indexes some locales together — notably, adding en-AU or en-CA alongside en-US can extend the indexed keyword pool for English. Verify current behaviour before relying on it.
- Screenshot captions must be localised too. Untranslated captions on a localised listing read as abandoned.

---

## Store experiments

**App Store — Product Page Optimization:** up to 3 treatments against the control. Tests icon, screenshots, app preview. Does not test text fields.

**Google Play — Store Listing Experiments:** tests icon, screenshots, feature graphic, short and full description. Broader coverage than App Store.

Both: run to a stated sample, not to the first good-looking day. Traffic composition shifts by day of week and early significance frequently reverses.

---

## Policy boundaries

Do not advise any of the following. Both stores enforce, and the penalty runs to removal:

- Incentivised ratings or reviews of any kind
- Review gating — routing unhappy users to a private form instead of the store
- Fake or purchased reviews or installs
- Competitor brand names in metadata
- Claims of store rankings or editorial features that aren't real ("#1 App", "Editor's Choice")
- Keyword stuffing in Play descriptions
- Screenshots depicting functionality the app doesn't have

If a client asks for any of these, say plainly that it risks removal and offer the legitimate version of what they actually want.
