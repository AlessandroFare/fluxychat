# Browser Run (P12-K)

When `env.BROWSER` is bound, FluxyChat uses [Browser Run Quick Actions](https://developers.cloudflare.com/browser-run/quick-actions/) for richer link previews on JS-heavy sites.

## Wrangler

```toml
compatibility_date = "2026-03-24"

[browser]
binding = "BROWSER"
```

Requires compatibility date `2026-03-24` or later.

## Behavior

`fetchOgPreview` in `message-enrichment.js`:

1. If `BROWSER` is bound → `quickAction('markdown', { url })` and parse title/description/image.
2. Fallback → direct HTML fetch + OG meta tags.
3. If HTML fetch is empty but browser is bound → retry markdown path.

SSRF private URLs are blocked in both paths.

## Future surfaces

- Screenshot attachments / OG images via `browserScreenshotBytes`
- HTML→Markdown for exports (room export already uses DB markdown; browser path optional for URL-only content)
