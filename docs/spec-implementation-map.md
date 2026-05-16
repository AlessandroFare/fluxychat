# SPEC §5 HTTP API — mappa implementazione (Worker)

Riferimento codice: `apps/worker/src/worker.js` (routing principale).  
OpenAPI in `apps/worker/openapi.yaml` (REST surface allineata al worker: health, auth, billing, GDPR, upload/attachments, agents, stats, webhooks, admin, room patch/delete, SSE stream; vedi file per dettagli).

Legenda: **✓** = presente come in SPEC; **+** = estensione oltre SPEC v3 tabella.

| SPEC §5 | Metodo | Implementazione | Note |
|---------|--------|-----------------|------|
| `/messages` | POST | ✓ | Body supporta anche `attachments` (+). |
| `/messages/{id}` | PATCH | ✓ | |
| `/messages/{id}` | DELETE | ✓ | Soft-delete default. |
| `/messages/{id}/reactions` | POST/DELETE | ✓ | |
| `/rooms` | GET | ✓ | |
| `/rooms` | POST | ✓ | |
| `/rooms/dm` | POST | ✓ | |
| `/rooms/{id}/members` | GET | ✓ | |
| `/rooms/{id}/members` | POST/DELETE | + | Aggiunta membership. |
| `/rooms/{id}/read` | POST | ✓ | |
| `/rooms/{id}/unread` | GET | ✓ | |
| `/rooms/{id}` | PATCH | + | Rename / metadata. |
| `/rooms/{id}` | DELETE | + | Cascade D1. |
| `/rooms/{id}/stream` | GET | + | SSE fallback (`EventSource`). |
| `/api/messages` | GET | ✓ | History paginata. |
| `/search/messages` | GET | ✓ | |
| `/search/conversations` | GET | ✓ | |
| `/export/messages.json` | GET | ✓ | |
| `/export/messages.csv` | GET | ✓ | RFC4180 escape (+). |
| `/reports` | POST | ✓ | |
| `/admin/mute` … `/admin/announcement` | POST | ✓ | |
| `/admin/reports` | GET | ✓ | |
| `/admin/webhooks` | GET | ✓ | |
| `/admin/webhooks/deliveries` | GET | + | Coda + stato delivery. |
| `/admin/projects` | GET/POST | ✓ | Rotazione key, ecc. |
| `/stats/rooms/{id}` | GET | ✓ | |
| `/stats/costs` | GET | + | Breakdown + guardrail pricing. |
| WebSocket `GET /ws/room/{roomId}` | GET | ✓ | Token obbligatorio (+ hardening). |

## SPEC §6 Webhook — registrazione

| Documento SPEC | Worker | Note |
|----------------|--------|------|
| `POST /webhooks/register` (esempio SPEC) | `POST /webhooks/register` | Allineato. |
| — | `PATCH` / `DELETE` `/webhooks/:id` | Gestione ciclo vita. |
| — | `POST /webhooks/verify` | Verifica firma HMAC lato server. |
| — | `POST /webhooks/stripe` | Billing Stripe. |

## Endpoint pubblici aggiuntivi (non nella tabella SPEC §5)

| Area | Path (esempi) |
|------|-----------------|
| Auth | `POST /auth/token` (API key → JWT) |
| Agenti | `GET/POST/PATCH/DELETE /agents`, `POST /agents/:id/invoke`, run history |
| Compat | `/bots` legacy |
| File | `POST /upload` |
| AI stats | `GET /stats/ai` |
| Ops | `GET /stats/ops`, `/stats/slo`, `/stats/alerts`, `POST /stats/alerts/evaluate`, `/stats/launch-kpis` |
| GDPR | `GET /gdpr/export`, `DELETE /gdpr/delete`, `GET /compliance/report` |
| Billing | `GET /billing/plan`, `POST /billing/checkout`, `POST /billing/portal` |
| Benchmark | `POST /benchmark` (admin) |
| Audit | `GET /admin/audit/events` |
| Alert rules | `GET/POST /admin/alerts/rules` |
| Automazione | `POST /automation/trigger` (JWT) |
| Bot injection | `POST /rooms/:id/messages/from-bot` (admin) |

## Manutenzione

Ad ogni nuovo endpoint pubblico: aggiornare questa tabella e, quando possibile, `openapi.yaml`.
