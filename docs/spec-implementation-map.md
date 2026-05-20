# SPEC §5 HTTP API — implementation map (Worker)

Code reference: `apps/worker/src/worker.js` (main routing).  
OpenAPI: `apps/worker/openapi.yaml` (REST surface aligned with the worker: health, auth, billing, GDPR, upload/attachments, agents, stats, webhooks, admin, room patch/delete, SSE stream; see file for details).

Legend: **✓** = present as in SPEC; **+** = extension beyond SPEC v3 table.

| SPEC §5 | Method | Implementation | Notes |
|---------|--------|----------------|------|
| `/messages` | POST | ✓ | Body also supports `attachments` (+). |
| `/messages/{id}` | PATCH | ✓ | |
| `/messages/{id}` | DELETE | ✓ | Soft-delete by default. |
| `/messages/{id}/reactions` | POST/DELETE | ✓ | |
| `/rooms` | GET | ✓ | |
| `/rooms` | POST | ✓ | |
| `/rooms/dm` | POST | ✓ | |
| `/rooms/{id}/members` | GET | ✓ | |
| `/rooms/{id}/members` | POST/DELETE | + | Add membership. |
| `/rooms/{id}/read` | POST | ✓ | |
| `/rooms/{id}/unread` | GET | ✓ | |
| `/rooms/{id}` | PATCH | + | Rename / metadata. |
| `/rooms/{id}` | DELETE | + | D1 cascade. |
| `/rooms/{id}/stream` | GET | + | SSE fallback (`EventSource`). |
| `/api/messages` | GET | ✓ | Paginated history. |
| `/search/messages` | GET | ✓ | |
| `/search/conversations` | GET | ✓ | |
| `/export/messages.json` | GET | ✓ | |
| `/export/messages.csv` | GET | ✓ | RFC4180 escape (+). |
| `/reports` | POST | ✓ | |
| `/admin/mute` … `/admin/announcement` | POST | ✓ | |
| `/admin/reports` | GET | ✓ | |
| `/admin/webhooks` | GET | ✓ | |
| `/admin/webhooks/deliveries` | GET | + | Queue + delivery state. |
| `/admin/projects` | GET/POST | ✓ | Key rotation, etc. |
| `/stats/rooms/{id}` | GET | ✓ | |
| `/stats/costs` | GET | + | Breakdown + pricing guardrails. |
| WebSocket `GET /ws/room/{roomId}` | GET | ✓ | Token required (+ hardening). |

## SPEC §6 Webhook — registration

| SPEC doc | Worker | Notes |
|----------|--------|------|
| `POST /webhooks/register` (SPEC example) | `POST /webhooks/register` | Aligned. |
| — | `PATCH` / `DELETE` `/webhooks/:id` | Lifecycle management. |
| — | `POST /webhooks/verify` | Server-side HMAC verification. |
| — | `POST /webhooks/stripe` | Stripe billing. |

## Additional public endpoints (not in SPEC §5 table)

| Area | Paths (examples) |
|------|------------------|
| Auth | `POST /auth/token` (API key → JWT) |
| Agents | `GET/POST/PATCH/DELETE /agents`, `POST /agents/:id/invoke`, run history |
| Compat | legacy `/bots` |
| Files | `POST /upload` |
| AI stats | `GET /stats/ai` |
| Ops | `GET /stats/ops`, `/stats/slo`, `/stats/alerts`, `POST /stats/alerts/evaluate`, `/stats/launch-kpis` |
| GDPR | `GET /gdpr/export`, `DELETE /gdpr/delete`, `GET /compliance/report` |
| Billing | `GET /billing/plan`, `POST /billing/checkout`, `POST /billing/portal` |
| Benchmark | `POST /benchmark` (admin) |
| Audit | `GET /admin/audit/events` |
| Alert rules | `GET/POST /admin/alerts/rules` |
| Automation | `POST /automation/trigger` (JWT) |
| Bot injection | `POST /rooms/:id/messages/from-bot` (admin) |

## Maintenance

When adding a new public endpoint: update this table and, when possible, `openapi.yaml`.
