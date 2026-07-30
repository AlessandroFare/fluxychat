# FluxyChat status (Cloudflare Pages)

Static public status page built from `content/status-incidents.md` with live `/health` checks in the browser.

## Build

```bash
pnpm --filter @fluxy-chat/status build
```

Set `WORKER_URL` or `NEXT_PUBLIC_WORKER_URL` at build time to embed the health endpoint URL.

## Deploy

Point a Cloudflare Pages project at `apps/status` with build command `pnpm build` and output directory `dist`.

The dashboard also exposes `/status` with the same incident feed for console-hosted deployments.
