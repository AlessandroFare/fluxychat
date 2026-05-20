# Troubleshooting guide

Common failure modes in production and local development.

## Quick tools

- **Health**: `GET /health`
- **Ops counters**: `GET /stats/ops?minutes=60` (JWT)
- **SLO snapshot**: `GET /stats/slo?minutes=60` (JWT)
- **Webhook deliveries**: `GET /admin/webhooks/deliveries?limit=100` (JWT admin/mod)
- **Audit trail**: `GET /admin/audit/events?limit=100` (JWT owner/admin)
- **Trace**: send header `X-Trace-Id` on requests to correlate logs

## 1) WebSocket disconnect / reconnect loop

### Symptoms

- Client cycles `connected → reconnecting → disconnected`
- Missing realtime updates in a room
- WebSocket handshake rejected

### Diagnosis

- **Token**: confirm the WS URL includes `token=<JWT>` and the token is not expired (`exp`)
- **Membership**: WS is rejected if the user is not a room member
- **Rate limit**: aggressive clients may see HTTP 429 and/or rejected WS messages

Useful commands:

```bash
curl -sS "$FLUXY_BASE_URL/health"
curl -sS -H "Authorization: Bearer <JWT>" "$FLUXY_BASE_URL/stats/slo?minutes=15"
```

### Fix

- Regenerate the JWT if expired (`POST /auth/token`)
- Ensure the room has correct membership (`POST /rooms` with `members`)
- Use exponential backoff on the client; avoid tight retry loops

## 2) Webhook retry / backlog / failed deliveries

### Symptoms

- External integration does not receive events
- Rising `webhook_delivery_failed` metrics
- Deliveries stuck in `pending` or `failed`

### Diagnosis

Inspect deliveries:

```bash
curl -sS -H "Authorization: Bearer <ADMIN_JWT>" \
  "$FLUXY_BASE_URL/admin/webhooks/deliveries?limit=50"
```

Check:

- `status`: `pending | delivered | failed`
- `attempt_count`
- `next_attempt_at`
- `last_http_status`, `last_error`

### Fix

- If the downstream endpoint is temporarily down: wait for backoff or replay
- Manual replay:

```bash
curl -sS -X POST -H "Authorization: Bearer <ADMIN_JWT>" \
  "$FLUXY_BASE_URL/admin/webhooks/deliveries/<deliveryId>/replay"
```

- If `failed` after max attempts: fix downstream, then replay (replay resets to pending and retries)

## 3) Rate limit (HTTP 429)

### Symptoms

- `429 Too Many Requests` responses
- `Retry-After` header present
- Client errors while sending messages or reports

### Diagnosis

- Identify endpoint and logical key (tenant/user/room)
- Check whether `RATE_LIMIT_KV` is configured or you are on in-memory fallback

### Fix

- Respect `Retry-After` on the client
- Reduce burst traffic (debounce input, batch events)
- If needed, tune env vars such as `RATE_LIMIT_MESSAGES_PER_MINUTE` (and other limits in the worker)

## 4) SLO breach / rising error rate

### Symptoms

- `GET /stats/slo` shows a low health score
- Increased `requests_error`
- Spikes in webhook or agent failures

### Diagnosis

```bash
curl -sS -H "Authorization: Bearer <JWT>" \
  "$FLUXY_BASE_URL/stats/ops?minutes=60"

curl -sS -H "Authorization: Bearer <JWT>" \
  "$FLUXY_BASE_URL/stats/slo?minutes=60"
```

Actions:

- Correlate the time window with a recent deploy (see runbook)
- Inspect alert events: `GET /stats/alerts` (JWT)
- For admin/mod impact: review the audit trail

### Fix

- Clear regression after deploy: roll back (see `RUNBOOK_DEPLOY_ROLLBACK.md`)
- Webhook spike: stabilize downstream + selective replay
- Auth errors: regenerate JWTs and verify tenant secrets
