# Public demo & guest token hardening

The dashboard route `/demo` and Worker `GET|POST /demo/session` mint short-lived guest JWTs for a shared room. Without guards, bots can burn quota and pollute the demo room.

This checklist implements patterns from **free4chat** (Turnstile, origin allowlist, rate limits) and FluxyChat P4 hardening (2026-05-28).

## Checklist

| Layer | Env / config | Status in FluxyChat |
|-------|----------------|---------------------|
| Disable by default | `DEMO_ENABLED` not `true` | ✅ 404 when off |
| Dedicated demo project key | `DEMO_API_KEY` + `DEMO_ROOM_ID` | ✅ not platform default project |
| IP rate limit | `RATE_LIMIT_DEMO_SESSIONS_PER_MINUTE` | ✅ `checkAndConsumeIpRateLimit` scope `demo-session` |
| Origin allowlist | `DEMO_ALLOWED_ORIGINS` | ✅ `Origin` / `Referer` match |
| Turnstile | `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ✅ POST `/demo/session` with `turnstileToken` |
| Read-only demo | `DEMO_READ_ONLY=true` | ✅ UI + no send |
| Short JWT TTL | `DEMO_TOKEN_TTL_SECONDS` (300–3600) | ✅ default 1800 |
| Auth token mint RL | `RATE_LIMIT_AUTH_TOKEN_PER_MINUTE` | ✅ `/auth/token` per IP + key fingerprint |
| WS connect RL | `RATE_LIMIT_WS_CONNECTIONS_PER_MINUTE` | ✅ optional per-IP (P2) |

## Turnstile (production demo)

**Worker** (`wrangler secret put`):

```bash
TURNSTILE_SECRET_KEY=...
DEMO_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
DEMO_ENABLED=true
# GET blocked when Turnstile is on (use POST from dashboard)
# DEMO_ALLOW_GET_WITHOUT_TURNSTILE=true   # local only — not for prod
```

**Dashboard** (Vercel env at build time):

```bash
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
```

Flow:

1. User opens `/demo`.
2. Turnstile widget renders; on success the app `POST`s `{ "turnstileToken": "..." }` to `/demo/session`.
3. Worker verifies via Cloudflare `siteverify`, then mints JWT.

Local dev without Turnstile: omit both keys — `GET /demo/session` still works.

## Origin allowlist

Set `DEMO_ALLOWED_ORIGINS` to the exact origins that host your demo UI (comma-separated). Requests without a matching `Origin` or `Referer` receive `403 demo_origin_forbidden`.

Leave unset in local dev (`localhost` flows often omit `Origin` on same-origin fetches from the Next app — configure `http://localhost:3000` in production-like staging).

## Rate limits

| Variable | Default | Applies to |
|----------|---------|------------|
| `RATE_LIMIT_DEMO_SESSIONS_PER_MINUTE` | 20 | `/demo/session` per IP |
| `RATE_LIMIT_AUTH_TOKEN_PER_MINUTE` | 30 | `POST /auth/token` per IP + api key prefix |
| `RATE_LIMIT_WS_CONNECTIONS_PER_MINUTE` | 0 (off) | WebSocket upgrade per IP |

Uses `IP_RATE_LIMITER` DO when bound, else `RATE_LIMIT_KV`.

## Audit script (manual)

1. Confirm `DEMO_ENABLED` is false on production until intentionally enabled.
2. Confirm demo API key is scoped to a throwaway project, not production tenant data.
3. Enable Turnstile + origins before linking `/demo` from marketing pages.
4. Monitor `rate_limit_exceeded` logs and demo room message volume.
5. Set `DEMO_READ_ONLY=true` for marketing embeds that should not accept writes.

## Related

- [Offline notify (Sent.dm)](./offline-notify-sent-dm.md)
- [`.dev.vars.example`](../../apps/worker/.dev.vars.example)
- [Research: free4chat abuse layers](../research/fluxychat-research-synthesis.md)

