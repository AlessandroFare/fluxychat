# FluxyChat voice load-test report

> Run `./scripts/voice-load-test.sh` to regenerate this file with live numbers.

## Status

**Pending first run** — configure LiveKit (see [PRODUCTION-SETUP.md](../PRODUCTION-SETUP.md)) then execute the script.

## Target methodology

1. **Worker token mint** — `POST /admin/calls/token` latency (sample)
2. **SFU capacity** — `lk load-test` (official LiveKit CLI)
3. **Signaling** — optional `k6 run scripts/voice-signaling-k6.js`

## Reproduce

```bash
cp examples/livekit/.env.example examples/livekit/.env
docker compose -f examples/livekit/docker-compose.yml up -d
export FLUXY_MEMBER_JWT=your-jwt
export FLUXY_WORKER_URL=https://your-worker
./scripts/voice-load-test.sh
```

Publish P90/P95 here after load test — verifiable numbers beat marketing claims.
