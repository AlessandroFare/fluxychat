#!/usr/bin/env bash
# Smoke test for Fluxychat worker (core HTTP paths).
#
# Usage:
#   export TEST_API_KEY=fc_...          # Fluxy API key (X-Fluxy-Api-Key), not Stripe sk_
#   export TEST_PROJECT_ID=<uuid>      # Optional sanity check: JWT tid must match this project
#   ./scripts/smoke-test.sh [--local] [--key=fc_...] [--project=<uuid>]
#
# Notes:
#   - Step 1 uses header X-Fluxy-Api-Key + JSON body userId/roles (matches worker).
#   - Step 4 uses GET /api/messages?roomId=... (not GET /messages/:roomId).
#   - Step 5 passes if Stripe returns url OR worker returns 501 billing_not_configured.
#   - Step 6 passes on 402 quota_exceeded OR 201 if still under quota (normal for fresh tenant).
#   - Step 7 passes if health JSON has "ok":true (degradedFeatures is always an object, not []).

set -euo pipefail

WORKER_URL="${WORKER_URL:-https://api.fluxychat.com}"
TEST_API_KEY="${TEST_API_KEY:-}"
TEST_PROJECT_ID="${TEST_PROJECT_ID:-}"
SMOKE_USER_ID="${SMOKE_USER_ID:-smoke-ci-user}"

for arg in "$@"; do
  case $arg in
    --local) WORKER_URL="http://127.0.0.1:8787" ;;
    --key=*) TEST_API_KEY="${arg#*=}" ;;
    --project=*) TEST_PROJECT_ID="${arg#*=}" ;;
    *) echo "Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

if [[ -z "$TEST_API_KEY" ]]; then
  echo "ERROR: TEST_API_KEY not set (Fluxy API key, prefix fc_)." >&2
  echo "  export TEST_API_KEY=fc_..." >&2
  exit 1
fi

PASS=0 FAIL=0
ROOM_ID=""
MSG_ID=""
JWT=""

info() { echo "[INFO]  $*"; }
pass() { echo "[PASS]  $*"; ((PASS++)) || true; }
fail() { echo "[FAIL]  $*"; ((FAIL++)) || true; }

# POST JSON with Bearer JWT
auth_post_json() {
  local path="$1" body="$2"
  curl -sS -X POST \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "$body" \
    "$WORKER_URL$path"
}

# POST with JWT, append HTTP status line (body may be non-2xx)
auth_post_code() {
  local path="$1" body="$2"
  curl -sS -X POST \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "$body" \
    -w "\n%{http_code}" \
    "$WORKER_URL$path"
}

auth_get() {
  local path="$1"
  curl -sS -H "Authorization: Bearer $JWT" "$WORKER_URL$path"
}

# ── Step 1: POST /auth/token ───────────────────────────────────
info "Step 1: POST /auth/token (X-Fluxy-Api-Key + userId/roles)"
RESP=$(curl -sS -X POST \
  -H "Content-Type: application/json" \
  -H "X-Fluxy-Api-Key: $TEST_API_KEY" \
  -d "{\"userId\":\"$SMOKE_USER_ID\",\"roles\":[\"owner\",\"admin\"],\"ttlSeconds\":3600}" \
  "$WORKER_URL/auth/token")
if echo "$RESP" | grep -q '"token"'; then
  JWT=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null \
    || node -e "const d=JSON.parse(require('fs').readFileSync(0));console.log(d.token)" <<< "$RESP")
  if [[ -n "$JWT" && ${#JWT} -gt 20 ]]; then
    pass "POST /auth/token -> JWT received (${#JWT} chars)"
    if [[ -n "$TEST_PROJECT_ID" ]]; then
      TID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('claims',{}).get('tid',''))" 2>/dev/null \
        || node -e "const d=JSON.parse(require('fs').readFileSync(0));console.log((d.claims&&d.claims.tid)||'')" <<< "$RESP")
      if [[ "$TID" == "$TEST_PROJECT_ID" ]]; then
        pass "JWT tid matches TEST_PROJECT_ID"
      else
        fail "JWT tid mismatch: expected $TEST_PROJECT_ID got '$TID' (wrong API key?)"
      fi
    fi
  else
    fail "POST /auth/token -> token malformed: $RESP"
  fi
else
  fail "POST /auth/token -> no token: $RESP"
fi

# ── Step 2: POST /rooms ────────────────────────────────────────
info "Step 2: POST /rooms"
RESP=$(auth_post_json "/rooms" '{"name":"smoke-test-room","type":"group"}')
ROOM_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['room']['id'])" 2>/dev/null \
  || node -e "const d=JSON.parse(require('fs').readFileSync(0));console.log(d.room.id)" <<< "$RESP")
if [[ -n "$ROOM_ID" ]]; then
  pass "POST /rooms -> roomId=$ROOM_ID"
else
  fail "POST /rooms -> no room.id: $RESP"
fi

# ── Step 3: POST /messages ─────────────────────────────────────
info "Step 3: POST /messages"
RESP=$(auth_post_json "/messages" "{\"roomId\": \"$ROOM_ID\", \"content\": \"smoke-test message $(date +%s)\"}")
MSG_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['message']['id'])" 2>/dev/null \
  || node -e "const d=JSON.parse(require('fs').readFileSync(0));console.log(d.message.id)" <<< "$RESP")
if [[ -n "$MSG_ID" ]]; then
  pass "POST /messages -> messageId=$MSG_ID"
else
  fail "POST /messages -> no message.id: $RESP"
fi

# ── Step 4: GET /api/messages ───────────────────────────────────
info "Step 4: GET /api/messages?roomId=...&limit=20"
RESP=$(auth_get "/api/messages?roomId=${ROOM_ID}&limit=20")
if echo "$RESP" | grep -q "$MSG_ID"; then
  pass "GET /api/messages -> message $MSG_ID in history"
else
  fail "GET /api/messages -> message $MSG_ID not found: ${RESP:0:400}"
fi

# ── Step 5: POST /billing/checkout ─────────────────────────────
info "Step 5: POST /billing/checkout"
RAW=$(auth_post_code "/billing/checkout" '{"planName":"starter"}')
CODE=$(echo "$RAW" | tail -n 1)
BODY=$(echo "$RAW" | sed '$d')
if [[ "$CODE" == "200" ]] && echo "$BODY" | grep -qE '"url"'; then
  pass "POST /billing/checkout -> 200 with Stripe url (Stripe configured)"
elif [[ "$CODE" == "501" ]] && echo "$BODY" | grep -q 'billing_not_configured'; then
  pass "POST /billing/checkout -> 501 billing_not_configured (Stripe not set — ok for non-prod smoke)"
else
  fail "POST /billing/checkout -> unexpected HTTP $CODE body: ${BODY:0:300}"
fi

# ── Step 6: POST /messages quota (402 optional) ─────────────────
info "Step 6: POST /messages (quota or under-limit)"
RAW=$(auth_post_code "/messages" "{\"roomId\": \"$ROOM_ID\", \"content\": \"quota probe $(date +%s)\"}")
CODE=$(echo "$RAW" | tail -n 1)
BODY=$(echo "$RAW" | sed '$d')
if [[ "$CODE" == "402" ]] && echo "$BODY" | grep -q 'resetsAt'; then
  pass "POST /messages -> 402 quota_exceeded with resetsAt"
elif [[ "$CODE" == "200" ]] || [[ "$CODE" == "201" ]]; then
  pass "POST /messages -> $CODE (under monthly quota — expected for fresh project)"
else
  fail "POST /messages -> unexpected HTTP $CODE: ${BODY:0:300}"
fi

# ── Step 7: GET /health ────────────────────────────────────────
info "Step 7: GET /health"
RESP=$(curl -sS "$WORKER_URL/health")
if echo "$RESP" | grep -qE '"ok"[[:space:]]*:[[:space:]]*true'; then
  pass "GET /health -> ok true"
  if echo "$RESP" | grep -q '"degraded"[[:space:]]*:[[:space:]]*true'; then
    info "  (note: health.degraded=true — check KV/R2 bindings)"
  fi
else
  fail "GET /health -> missing ok:true: ${RESP:0:400}"
fi

# ── Step 8: DELETE /gdpr/delete (owner/admin JWT) ──────────────
info "Step 8: DELETE /gdpr/delete"
RESP=$(curl -sS -X DELETE -H "Authorization: Bearer $JWT" "$WORKER_URL/gdpr/delete")
if echo "$RESP" | grep -qE '"ok"[[:space:]]*:[[:space:]]*true'; then
  pass "DELETE /gdpr/delete -> ok true"
else
  fail "DELETE /gdpr/delete -> unexpected: ${RESP:0:400}"
fi

echo ""
echo "------------------------------"
echo "Results: $PASS passed, $FAIL failed"
echo "------------------------------"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
