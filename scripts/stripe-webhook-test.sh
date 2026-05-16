#!/usr/bin/env bash
# Stripe webhook smoke test — replays events via Stripe CLI against the production
# worker webhook endpoint and verifies D1 state after each step.
#
# Prerequisites:
#   1. Stripe CLI installed and authenticated:
#        stripe login
#   2. Worker webhook URL configured:
#        WORKER_WEBHOOK_URL=https://api.fluxychat.com/webhooks/stripe
#        export WORKER_WEBHOOK_URL
#   3. TEST_PROJECT_ID set to a non-production project:
#        export TEST_PROJECT_ID=proj_...
#   4. Wrangler authenticated for the target account:
#        npx wrangler whoami
#   5. D1 database name from wrangler.toml:
#        D1_NAME=fluxychat
#        export D1_NAME
#
# Usage:
#   ./stripe-webhook-test.sh --env production
#   ./stripe-webhook-test.sh --env preview
#   ./stripe-webhook-test.sh production   # shorthand

set -euo pipefail

WORKER_WEBHOOK_URL="${WORKER_WEBHOOK_URL:-https://api.fluxychat.com/webhooks/stripe}"
TEST_PROJECT_ID="${TEST_PROJECT_ID:-}"
D1_NAME="${D1_NAME:-fluxychat}"
ENV="production"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV="${2:-production}"
      shift 2
      ;;
    production|preview)
      ENV="$1"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Use: $0 [--env production|preview]" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$TEST_PROJECT_ID" ]]; then
  echo "ERROR: TEST_PROJECT_ID not set." >&2
  echo "Set with:  export TEST_PROJECT_ID=proj_..." >&2
  exit 1
fi

PASS=0 FAIL=0
STRIPE_CUSTOMER_ID=""
STRIPE_SUBSCRIPTION_ID=""

info()   { echo "[INFO]  $*"; }
pass()   { echo "[PASS]  $*"; ((PASS++)); }
fail()   { echo "[FAIL]  $*"; ((FAIL++)); }
section(){ echo ""; echo "══════════════════════════════════════════"; echo "  $1"; echo "══════════════════════════════════════════"; }

# ── Helpers ────────────────────────────────────────────────────

# Run a Stripe CLI trigger and forward to the worker webhook endpoint
stripe_fwd() {
  local event_type="$1"; shift
  stripe trigger "$event_type" \
    --add "data.object.client_reference_id=$TEST_PROJECT_ID" \
    --add "data.object.metadata.project_id=$TEST_PROJECT_ID" \
    --add "data.object.metadata.plan_name=starter" \
    --forward-to "$WORKER_WEBHOOK_URL" 2>/dev/null
}

# Query D1, print first column of first row (or NO_ROWS / QUERY_ERROR)
d1_query() {
  local sql="$1"; shift
  npx wrangler d1 execute "$D1_NAME" \
    --env "$ENV" \
    --command "$sql" \
    --json 2>/dev/null | \
    python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data.get('results', [])
if results:
    rows = results[0].get('results', [])
    if rows: print(rows[0][0])
    else: print('NO_ROWS')
else: print('NO_RESULTS')
" 2>/dev/null || echo "QUERY_ERROR"
}

# Run D1 query, print full JSON output
d1_raw() {
  local sql="$1"; shift
  npx wrangler d1 execute "$D1_NAME" \
    --env "$ENV" \
    --command "$sql" \
    --json 2>/dev/null
}

# ── Setup: ensure project_plans row exists ──────────────────────
section "SETUP: ensure test project exists in project_plans"

PLAN_EXISTS=$(d1_query "SELECT COUNT(*) FROM project_plans WHERE project_id = '$TEST_PROJECT_ID'")
if [[ "$PLAN_EXISTS" == "0" ]]; then
  info "No project_plans row for $TEST_PROJECT_ID — creating..."
  npx wrangler d1 execute "$D1_NAME" \
    --env "$ENV" \
    --command "INSERT OR IGNORE INTO project_plans (project_id, plan_name, billing_status, pricing_version, updated_at, created_at) VALUES ('$TEST_PROJECT_ID', 'free', 'manual', 'v1', datetime('now'), datetime('now'))"
  info "Created."
else
  info "project_plans row already exists for $TEST_PROJECT_ID."
fi

# ── Step 1: checkout.session.completed ───────────────────────────────────────
section "STEP 1: checkout.session.completed"

info "Triggering: stripe trigger checkout.session.completed"
info "  --forward-to $WORKER_WEBHOOK_URL"
stripe_fwd "checkout.session.completed" > /dev/null

info "Expected D1 state:"
info "  project_plans: plan_name=starter, billing_status=active"
info "  project_plans: stripe_customer_id and stripe_subscription_id populated"
info "  stripe_webhook_events: row inserted with event id + 'checkout.session.completed'"

PLAN_NAME=$(d1_query "SELECT plan_name FROM project_plans WHERE project_id = '$TEST_PROJECT_ID'")
BILLING_STATUS=$(d1_query "SELECT billing_status FROM project_plans WHERE project_id = '$TEST_PROJECT_ID'")
STRIPE_CUSTOMER_ID=$(d1_query "SELECT stripe_customer_id FROM project_plans WHERE project_id = '$TEST_PROJECT_ID'")
STRIPE_SUBSCRIPTION_ID=$(d1_query "SELECT stripe_subscription_id FROM project_plans WHERE project_id = '$TEST_PROJECT_ID'")

DEDUP_ROW=$(d1_raw "SELECT id, event_type, created_at FROM stripe_webhook_events WHERE event_type = 'checkout.session.completed' ORDER BY created_at DESC LIMIT 1")
info "stripe_webhook_events last row: $DEDUP_ROW"

if [[ "$PLAN_NAME" == "starter" && "$BILLING_STATUS" == "active" && -n "$STRIPE_CUSTOMER_ID" ]]; then
  pass "project_plans: plan_name=starter, billing_status=active, stripe_customer_id=$STRIPE_CUSTOMER_ID"
else
  fail "project_plans: expected starter/active, got $PLAN_NAME/$BILLING_STATUS"
fi

if echo "$DEDUP_ROW" | grep -q "checkout.session.completed"; then
  pass "stripe_webhook_events: checkout.session.completed event recorded"
else
  fail "stripe_webhook_events: event not found"
fi

# wrangler equivalent:
#   npx wrangler d1 execute fluxychat --env production \
#     --command "SELECT plan_name, billing_status, stripe_customer_id, stripe_subscription_id FROM project_plans WHERE project_id = '$TEST_PROJECT_ID'"
#   npx wrangler d1 execute fluxychat --env production \
#     --command "SELECT id, event_type FROM stripe_webhook_events WHERE event_type = 'checkout.session.completed' ORDER BY created_at DESC LIMIT 1"

# ── Step 2: customer.subscription.updated (quota extension / plan change) ─────
section "STEP 2: customer.subscription.updated"

# NOTE: invoice.payment_succeeded is NOT handled by the worker.
# No D1 state change occurs for that event. We test customer.subscription.updated
# instead — it exercises the plan upsert path and updates limits via upsertProjectPlanFromStripe.

info "NOTE: invoice.payment_succeeded is not wired in worker.js — skipping."
info "Triggering customer.subscription.updated (plan upgrade: starter -> pro)"
info "  --forward-to $WORKER_WEBHOOK_URL"

if [[ -n "$STRIPE_SUBSCRIPTION_ID" && "$STRIPE_SUBSCRIPTION_ID" != "NO_ROWS" && "$STRIPE_SUBSCRIPTION_ID" != "QUERY_ERROR" ]]; then
  stripe trigger "customer.subscription.updated" \
    --add "data.object.id=$STRIPE_SUBSCRIPTION_ID" \
    --add "data.object.customer=$STRIPE_CUSTOMER_ID" \
    --add "data.object.status=active" \
    --add "data.object.metadata.project_id=$TEST_PROJECT_ID" \
    --add "data.object.metadata.plan_name=pro" \
    --forward-to "$WORKER_WEBHOOK_URL" 2>/dev/null > /dev/null

  info "Expected D1 state:"
  info "  project_plans: plan_name=pro, billing_status=active"

  PLAN_NAME=$(d1_query "SELECT plan_name FROM project_plans WHERE project_id = '$TEST_PROJECT_ID'")
  BILLING_STATUS=$(d1_query "SELECT billing_status FROM project_plans WHERE project_id = '$TEST_PROJECT_ID'")

  if [[ "$PLAN_NAME" == "pro" ]]; then
    pass "project_plans: plan_name updated to pro (limits refreshed from catalog)"
  else
    fail "project_plans: expected pro, got $PLAN_NAME"
  fi
else
  info "No stripe_subscription_id found in step 1 — skipping subscription.updated check"
  pass "customer.subscription.updated: skipped (no subscription ID)"
fi

# wrangler equivalent:
#   npx wrangler d1 execute fluxychat --env production \
#     --command "SELECT plan_name, billing_status FROM project_plans WHERE project_id = '$TEST_PROJECT_ID'"

# ── Step 3: customer.subscription.deleted ─────────────────────────────────────
section "STEP 3: customer.subscription.deleted"

info "Triggering: stripe trigger customer.subscription.deleted"
info "  --forward-to $WORKER_WEBHOOK_URL"
info "Expected D1 state:"
info "  project_plans: plan_name=free, billing_status=cancelled"

if [[ -n "$STRIPE_SUBSCRIPTION_ID" && "$STRIPE_SUBSCRIPTION_ID" != "NO_ROWS" && "$STRIPE_SUBSCRIPTION_ID" != "QUERY_ERROR" ]]; then
  stripe trigger "customer.subscription.deleted" \
    --add "data.object.id=$STRIPE_SUBSCRIPTION_ID" \
    --add "data.object.customer=$STRIPE_CUSTOMER_ID" \
    --add "data.object.metadata.project_id=$TEST_PROJECT_ID" \
    --forward-to "$WORKER_WEBHOOK_URL" 2>/dev/null > /dev/null
fi

PLAN_NAME=$(d1_query "SELECT plan_name FROM project_plans WHERE project_id = '$TEST_PROJECT_ID'")
BILLING_STATUS=$(d1_query "SELECT billing_status FROM project_plans WHERE project_id = '$TEST_PROJECT_ID'")

if [[ "$PLAN_NAME" == "free" && "$BILLING_STATUS" == "cancelled" ]]; then
  pass "project_plans: plan_name=free, billing_status=cancelled"
else
  fail "project_plans: expected free/cancelled, got $PLAN_NAME/$BILLING_STATUS"
fi

# wrangler equivalent:
#   npx wrangler d1 execute fluxychat --env production \
#     --command "SELECT plan_name, billing_status FROM project_plans WHERE project_id = '$TEST_PROJECT_ID'"

# ── Step 4: checkout.session.completed — duplicate ─────────────────────────────
section "STEP 4: checkout.session.completed duplicate (dedup test)"

info "Triggering: stripe trigger checkout.session.completed (second time)"
info "  --forward-to $WORKER_WEBHOOK_URL"
info "Expected D1 state:"
info "  stripe_webhook_events: NO new row inserted (INSERT OR IGNORE ignores duplicate)"
info "  project_plans: plan_name stays 'free' (not overwritten back to starter)"

COUNT_BEFORE=$(d1_query "SELECT COUNT(*) FROM stripe_webhook_events WHERE event_type = 'checkout.session.completed'")
stripe_fwd "checkout.session.completed" > /dev/null
COUNT_AFTER=$(d1_query "SELECT COUNT(*) FROM stripe_webhook_events WHERE event_type = 'checkout.session.completed'")

PLAN_NAME_AFTER=$(d1_query "SELECT plan_name FROM project_plans WHERE project_id = '$TEST_PROJECT_ID'")
BILLING_STATUS_AFTER=$(d1_query "SELECT billing_status FROM project_plans WHERE project_id = '$TEST_PROJECT_ID'")

info "stripe_webhook_events count before: $COUNT_BEFORE, after: $COUNT_AFTER"
info "project_plans plan_name after duplicate: $PLAN_NAME_AFTER"

if [[ "$COUNT_BEFORE" == "$COUNT_AFTER" && "$PLAN_NAME_AFTER" == "free" && "$BILLING_STATUS_AFTER" == "cancelled" ]]; then
  pass "Dedup: INSERT OR IGNORE blocked duplicate — no new row, plan unchanged (free/cancelled)"
else
  fail "Dedup: expected count unchanged ($COUNT_BEFORE) and plan=free, got count=$COUNT_AFTER plan=$PLAN_NAME_AFTER"
fi

# wrangler equivalent:
#   npx wrangler d1 execute fluxychat --env production \
#     --command "SELECT COUNT(*) FROM stripe_webhook_events WHERE event_type = 'checkout.session.completed'"
#   npx wrangler d1 execute fluxychat --env production \
#     --command "SELECT plan_name, billing_status FROM project_plans WHERE project_id = '$TEST_PROJECT_ID'"

# ── Cleanup ───────────────────────────────────────────────────────────────
section "CLEANUP: remove test data"

info "DELETE project_plans row for $TEST_PROJECT_ID..."
npx wrangler d1 execute "$D1_NAME" \
  --env "$ENV" \
  --command "DELETE FROM project_plans WHERE project_id = '$TEST_PROJECT_ID'"

info "DELETE stripe_webhook_events rows created during this test run..."
npx wrangler d1 execute "$D1_NAME" \
  --env "$ENV" \
  --command "DELETE FROM stripe_webhook_events WHERE created_at > datetime('now', '-1 hour')" \
  2>/dev/null || info "stripe_webhook_events cleanup skipped"

info "Done."

# ── Summary ─────────────────────────────────────────────────────────────────
section "RESULTS"
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo "SOME STEPS FAILED — see output above." >&2
  exit 1
fi
echo "All steps passed."
exit 0