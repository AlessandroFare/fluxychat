#!/usr/bin/env bash
# Voice load-test helper — PG competitive strategy (Level B).
# Requires: livekit-cli (lk), curl, jq
# @see https://docs.livekit.io/home/cli/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPORT="${ROOT}/docs/VOICE-LOAD-TEST-REPORT.md"
ENV_FILE="${LK_ENV:-examples/livekit/.env}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

LK_URL="${LIVEKIT_URL:-${LK_URL:-ws://127.0.0.1:7880}}"
LK_KEY="${LIVEKIT_API_KEY:-devkey}"
LK_SECRET="${LIVEKIT_API_SECRET:-secret_that_is_at_least_32_characters_long}"
WORKER_URL="${FLUXY_WORKER_URL:-http://127.0.0.1:8787}"
MEMBER_JWT="${FLUXY_MEMBER_JWT:-}"

ROOM="fluxy-loadtest-$(date +%s)"
PUBLISHERS="${PUBLISHERS:-5}"
SUBSCRIBERS="${SUBSCRIBERS:-20}"
DURATION="${DURATION:-2m}"

echo "== FluxyChat voice load test =="
echo "LiveKit: $LK_URL"
echo "Room: $ROOM"
echo "Publishers: $PUBLISHERS Subscribers: $SUBSCRIBERS Duration: $DURATION"

if command -v lk >/dev/null 2>&1; then
  echo "Running lk load-test..."
  lk load-test \
    --url "$LK_URL" \
    --api-key "$LK_KEY" \
    --api-secret "$LK_SECRET" \
    --room "$ROOM" \
    --publishers "$PUBLISHERS" \
    --subscribers "$SUBSCRIBERS" \
    --duration "$DURATION" \
    2>&1 | tee /tmp/fluxy-lk-loadtest.log || true
else
  echo "WARN: livekit-cli (lk) not installed — skip SFU load test"
  echo "Install: https://docs.livekit.io/home/cli/cli-setup/"
fi

TOKEN_LATENCY=""
if [[ -n "$MEMBER_JWT" ]]; then
  echo "Measuring Worker token mint latency..."
  START=$(date +%s%3N)
  curl -sfS -X POST "${WORKER_URL}/admin/calls/token" \
    -H "Authorization: Bearer ${MEMBER_JWT}" \
    -H "Content-Type: application/json" \
    -d "{\"provider\":\"livekit\",\"roomId\":\"${ROOM}\",\"displayName\":\"loadtest\"}" \
    -o /tmp/fluxy-token.json
  END=$(date +%s%3N)
  TOKEN_LATENCY=$((END - START))
  echo "Token mint: ${TOKEN_LATENCY}ms"
fi

mkdir -p "$(dirname "$REPORT")"
cat > "$REPORT" <<EOF
# FluxyChat voice load-test report

Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

## Setup

| Parameter | Value |
|-----------|--------|
| LiveKit URL | \`$LK_URL\` |
| Room | \`$ROOM\` |
| Publishers | $PUBLISHERS |
| Subscribers | $SUBSCRIBERS |
| Duration | $DURATION |
| Worker URL | \`$WORKER_URL\` |

## Results

| Metric | Value |
|--------|--------|
| Worker token mint (P0 sample) | ${TOKEN_LATENCY:-n/a} ms |
| lk load-test log | \`/tmp/fluxy-lk-loadtest.log\` |

## Reproduce

\`\`\`bash
./scripts/voice-load-test.sh
\`\`\`

## Methodology

1. **Text pipeline** — \`useVoice\` simulation on \`/voice-ai\` (dashboard)
2. **SFU capacity** — \`lk load-test\` (official LiveKit CLI)
3. **Signaling at scale** — optional k6 + xk6-browser (see \`scripts/voice-signaling-k6.js\`)

Publish P90/P95 after filling load-test output. Target: document verifiable numbers, not marketing claims.

EOF

echo "Report written: $REPORT"
