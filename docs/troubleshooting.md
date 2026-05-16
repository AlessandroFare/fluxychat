# Troubleshooting guide

Questa guida copre i failure mode piu comuni in produzione e in dev.

## Strumenti rapidi

- **Health**: `GET /health`
- **Ops counters**: `GET /stats/ops?minutes=60` (JWT)
- **SLO snapshot**: `GET /stats/slo?minutes=60` (JWT)
- **Webhook deliveries**: `GET /admin/webhooks/deliveries?limit=100` (JWT admin/mod)
- **Audit trail**: `GET /admin/audit/events?limit=100` (JWT owner/admin)
- **Trace**: usa header `X-Trace-Id` nelle chiamate per correlare log

## 1) WebSocket disconnect / reconnect loop

### Sintomi

- client passa `connected -> reconnecting -> disconnected` ripetutamente
- mancato aggiornamento realtime in room
- WS handshake rifiutato

### Diagnosi

- **Token**: verifica che il WS URL contenga `token=<JWT>` e che non sia scaduto (`exp`)
- **Membership**: connessione WS rifiutata se l’utente non e membro della room
- **Rate limit**: se il client spamma, potresti vedere 429 su REST e/o messaggi WS rifiutati

Comandi utili:

```bash
curl -sS "$FLUXY_BASE_URL/health"
curl -sS -H "Authorization: Bearer <JWT>" "$FLUXY_BASE_URL/stats/slo?minutes=15"
```

### Fix

- rigenera JWT se scaduto (usa `POST /auth/token`)
- assicurati che la room abbia membership corretta (`POST /rooms` con `members`)
- riduci retry aggressivi lato client (backoff esponenziale)

## 2) Webhook retry / backlog / delivery fallite

### Sintomi

- integrazione esterna non riceve eventi
- aumento `webhook_delivery_failed`
- deliveries in `pending` a lungo o `failed`

### Diagnosi

Ispeziona deliveries:

```bash
curl -sS -H "Authorization: Bearer <ADMIN_JWT>" \
  "$FLUXY_BASE_URL/admin/webhooks/deliveries?limit=50"
```

Cosa guardare:

- `status`: `pending | delivered | failed`
- `attempt_count`
- `next_attempt_at`
- `last_http_status`, `last_error`

### Fix

- se endpoint downstream e temporaneamente giu: attendi il backoff o fai replay
- replay manuale:

```bash
curl -sS -X POST -H "Authorization: Bearer <ADMIN_JWT>" \
  "$FLUXY_BASE_URL/admin/webhooks/deliveries/<deliveryId>/replay"
```

- se `failed` dopo max attempts: correggi downstream e poi replay (il replay resetta a pending e riprova)

## 3) Rate limit (HTTP 429)

### Sintomi

- risposte `429 Too Many Requests`
- header `Retry-After`
- errori lato client durante invio messaggi/reports

### Diagnosi

- identifica endpoint e chiave logica (tenant/user/room)
- verifica se KV `RATE_LIMIT_KV` e configurato o stai usando fallback in-memory

### Fix

- rispetta `Retry-After` lato client
- riduci burst (debounce su input, batching eventi)
- se necessario, aumenta env:
  - `RATE_LIMIT_MESSAGES_PER_MINUTE`
  - (eventuali altri limiti configurati nel worker)

## 4) SLO breach / aumento error rate

### Sintomi

- `GET /stats/slo` segnala health score basso
- incremento `requests_error`
- spike in webhook failures o agent failures

### Diagnosi

```bash
curl -sS -H "Authorization: Bearer <JWT>" \
  "$FLUXY_BASE_URL/stats/ops?minutes=60"

curl -sS -H "Authorization: Bearer <JWT>" \
  "$FLUXY_BASE_URL/stats/slo?minutes=60"
```

Azioni:

- correlare finestra temporale con deploy recente (usa runbook)
- ispezionare alert events: `GET /stats/alerts` (JWT)
- se impatta azioni admin/mod: vedere audit trail

### Fix

- se regressione chiara post-deploy: eseguire rollback (vedi `RUNBOOK_DEPLOY_ROLLBACK.md`)
- se spike webhook: mitigare downstream + replay selettivo
- se errori auth: rigenerare JWT e verificare secrets tenant

