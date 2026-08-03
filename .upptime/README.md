# Upptime status page config (#62)

This folder holds the **source config** for the public FluxyChat status page.

## Deploy (one-time)

1. Create a repo from [Upptime template](https://github.com/upptime/upptime/generate).
2. Copy `config.json` into that repo as `.upptime/config.json`.
3. Enable GitHub Actions + GitHub Pages.
4. Point DNS: `status.fluxychat.com` → GitHub Pages (see `status-website.cname` in config).

## Validate locally / CI

```bash
pnpm run check:upptime
```

## Dashboard ops

**Settings → Public status page** (`/settings/status`) — deploy checklist and live URL.

## Docs

[docs/STATUS_PAGE_UPPTIME.md](../docs/STATUS_PAGE_UPPTIME.md)
