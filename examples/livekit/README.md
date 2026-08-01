# LiveKit self-hosted (free)

Run the WebRTC SFU for FluxyChat voice rooms. Workers mint JWTs; media stays on LiveKit.

## Quick start (local)

```bash
cp .env.example .env
# Edit LIVEKIT_API_KEY / LIVEKIT_API_SECRET (use generate-keys output)
docker compose up -d
```

Set on Worker (`.dev.vars` or Wrangler secrets):

```
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=...
LIVEKIT_URL=ws://127.0.0.1:7880
```

Test token mint:

```bash
curl -X POST "$WORKER_URL/admin/calls/token" \
  -H "Authorization: Bearer $MEMBER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"provider":"livekit","roomId":"demo-room","displayName":"You"}'
```

## Production

- Put LiveKit behind TLS (`wss://`) — Caddy, nginx, or Cloudflare Tunnel
- Open UDP 50000–50100 (or configure TURN)
- Prefer [LiveKit Cloud free tier](https://cloud.livekit.io) if you skip VPS ops

See `docs/integrations/livekit.md` and `docs/PRODUCTION-SETUP.md`.
