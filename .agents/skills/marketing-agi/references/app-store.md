
# App Store Kit

Two things are conflated in most ASO advice and they run on opposite logic:

- **Discoverability** — being found. Driven by metadata, keywords, category, velocity.
- **Conversion** — being installed once found. Driven almost entirely by the icon, the first two screenshots, and the rating.

A listing can be excellent at one and terrible at the other. Diagnose which before doing anything, because the fixes have nothing in common.

## Before you start

Read `brand-context.md` if present.

Establish three things — infer where possible rather than interrogating:
1. **Which store(s).** App Store and Play have materially different rules; see `store-specs.md`.
2. **Traffic mix.** Mostly browse/search, or mostly paid UA? Paid traffic arrives already convinced and needs a different screenshot sequence — reassurance, not persuasion.
3. **Live listing or pre-launch.** No baseline data changes what can be claimed.

## Step 1 — Diagnose which half is broken

| Symptom | Likely problem | Where to work |
|---|---|---|
| Low impressions | Discoverability | Metadata, keywords, category |
| High impressions, low install rate | Conversion | Icon, screenshots 1-2, rating |
| Good install rate, low volume | Discoverability | Metadata |
| Both low | Start with conversion | Fixing conversion first makes discoverability gains worth having |

If conversion is broken, **fix it before driving more traffic.** Sending volume to a listing that doesn't convert wastes the acquisition and depresses the ranking signals that come from install velocity.

## Step 2 — Metadata and keywords

Build the keyword set from four sources, in this order of reliability:

1. **Store autocomplete** — real user queries, highest signal available for free
2. **Competitor listings** — what the top five in the category target in their titles and subtitles
3. **Review language** — how existing users actually describe the app. Consistently the most underused source, and the one that surfaces the terms nobody thought to target.
4. **Category browse** — what surfaces where you want to surface

Score each term on relevance, estimated volume, and realistic competitiveness. Do not chase head terms an unranked app cannot win; the rankable middle is where installs come from.

Then place them according to the field rules in `store-specs.md`. **The placement rules differ substantially between the two stores** — App Store has a dedicated hidden keyword field and does not index the description; Play indexes the descriptions and has no keyword field. Getting this backwards is the most common ASO error.

Write the actual copy. Title, subtitle, promotional text, description — to character count, not approximate. A subtitle that overruns by four characters is not a deliverable.

## Step 3 — Screenshot sequence

Screenshots are the highest-leverage conversion asset and they are treated as an afterthought almost universally.

**Design the sequence, not the images.** It is an argument delivered in order.

| Frame | Job |
|---|---|
| 1 | The single strongest value claim. Most viewers see only this one. It must work alone. |
| 2 | The second-strongest, or the primary objection answered |
| 3-4 | Depth: the mechanism, the range, the proof |
| 5+ | Long-tail: social proof, integrations, edge use cases |

For each frame specify:
- **The caption** — written out, under ~7 words, benefit-led not feature-led. Not "Advanced Filtering". "Find any invoice in 2 seconds."
- **What the device frame shows** — the specific screen, not "the app"
- **Visual hierarchy** — what the eye lands on first
- **Any overlay, annotation or highlight**

Rules that hold across categories:
- Text must be legible at thumbnail size. Most people never expand a screenshot.
- Do not put the caption below the device frame; it gets cropped in browse view.
- The first frame carries most of the decision. Spend disproportionate effort there.
- Portrait for phone-first apps; the browse view crops landscape badly on App Store.
- Localise text, not just translate it — see `store-specs.md`.

If image generation is available, produce the frames. If not, produce briefs specific enough that a designer needs no follow-up questions.

## Step 4 — Icon

Evaluate against four criteria, in this order:

1. **Thumbnail legibility** — it will be seen at roughly 60px. Squint at it. If the shape isn't readable, nothing else matters.
2. **Category distinctiveness** — place it beside the top ten in the category. If it disappears, it fails, however well crafted.
3. **Category-appropriate signalling** — finance apps that look like games underperform; the convention exists because it works.
4. **No text.** Almost never survives at thumbnail size. Rare exceptions for one-or-two-character wordmarks.

Icon changes are the highest-variance ASO test available. Recommend testing rather than swapping outright, and never change the icon and the screenshots in the same release — you lose the ability to attribute the result.

## Step 5 — Ratings and reviews

Ratings drive both conversion and ranking, which makes this the highest-leverage and most-neglected item.

- **Prompt at moments of demonstrated success**, not on session count or after a delay
- Never prompt after an error, a failed action, or a paywall
- Respond to negative reviews — visible responses affect the reader, and the pattern in the complaints is free product research
- Mine review language for both keywords and objections. If four reviews raise the same worry, that objection belongs in screenshot 2.

**Never advise anything that violates store policy** — no incentivised ratings, no review gating that filters negative reviewers away from the store, no fake reviews. Beyond the ethics, both stores enforce this and the penalty is removal.

## Step 6 — Test plan

Both stores support native listing experiments. Use them rather than swapping and hoping.

Ranked by typical effect size:
1. Icon
2. Screenshot 1
3. Title / subtitle
4. Screenshot order
5. Description

**One variable per test.** Run to a stated sample, not to the first favourable-looking day. Early significance in store experiments is routinely a mirage — traffic composition shifts by day of week.

## Output

```
# App Store Kit — [app name]
[date] · Stores: [which] · Diagnosis: [discoverability | conversion | both]

## Diagnosis
[Which half is broken and the evidence]

## Metadata (ready to paste)
[Title, subtitle, keyword field, description — at exact character counts]

## Screenshot sequence
[Frame by frame: caption, screen, hierarchy, notes]

## Icon assessment
[Verdict + recommended test]

## Ratings strategy

## Test plan
[Ranked, one variable each]

## What I couldn't determine
```

## Honesty

Neither store publishes its ranking algorithm. Everything here is inferred from published guidelines and observed behaviour. Say so. Do not project install lifts from an ASO change — the confounders are severe and the number will be wrong. Describe direction and rationale, and let the test produce the number.

Verify current character limits and field rules before shipping copy; both stores change them.

## Handoffs

- Listing copy that needs real work → the copy module (`copy.md`)
- Paid UA feeding the listing → the paid-ads module (`paid-ads.md`)
- Web presence around the app → the audit module (`audit.md`)
