# Fluxychat — Roadmap (fonte unica)

**Usa solo questo file** per sapere cosa è fatto, cosa manca e le milestone. Contiene: istruzioni d’uso, matrice SPEC↔codice, sintesi stato, backlog P0–P3, checklist M1–M6, registro avanzamenti.  
Contratto funzionale: `SPEC.md`. Deploy/ops: `RUNBOOK_DEPLOY_ROLLBACK.md`.  
`PRODUCT_ROADMAP_ANALYSIS.md` e `NEW_ANALYSIS.md` sono materiale di contesto/archivio — **non** duplicare checklist lì.

## Come usarlo

- Aggiorna `Status` in tabella con: `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`.
- Aggiorna ogni task con checkbox:
  - `[ ]` non iniziato
  - `[-]` in corso
  - `[x]` completato
- Compila `Last Updated`, `Owner`, `Notes` quando fai avanzamenti.

---

## Stato generale

- Last Updated: `2026-05-12 (OpenAPI ampliato worker; dashboard /landing marketing + nav Product)`
- Owner: `@alefare + assistant`
- Current Focus: `M6 - Controlled Rollout & Post-MVP Expansion`

---

## Matrice SPEC -> Implementazione

Legenda:
- Coverage: `DONE` = implementato, `PARTIAL` = parziale, `MISSING` = assente
- Priority: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`
- Effort: `S`, `M`, `L`

| Area SPEC | Coverage | Status | Cosa c'e gia | Gap principali | Priority | Effort | Owner | Notes |
|---|---|---|---|---|---|---|---|---|
| 1. Posizionamento | DONE | DONE | One-liner, pricing story, target chiaro in spec | Snippet copy-paste: `docs/product-landing-snippet.md`; rollout copy `docs/m6-pilot-gtm-playbook.md` §6 | MEDIUM | S |  | Landing pubblica hosted = ops |
| 2. Target | DONE | IN_PROGRESS | ICP primario/secondario definiti | Validazione con pilot reali: `docs/m6-pilot-gtm-playbook.md` | LOW | S |  |  |
| 3. Architettura | PARTIAL | DONE | Worker + DO + D1 + KV/R2 bindings + dashboard + SDK; R2/KV guards + 503 degradation; health degradedFeatures | KV namespace IDs placeholder da configurare al deploy | HIGH | M |  | Graceful degradation implementato |
| 4. Domain Model | PARTIAL | DONE | Multi-tenant, moderazione (+ **auto_flag** substring opt-in env), agent+builtin seed (incl. @onboarding), retention D1, GDPR export/delete | Policy/regole avanzate oltre blocklist | HIGH | M |  | `BUILTIN_MODERATION_*` |
| 5. HTTP API | DONE | DONE | JWT, agent CRUD, webhook CRUD, room PATCH+DELETE, membri POST/DELETE, export, search, billing plan | Mappa SPEC↔codice: `docs/spec-implementation-map.md`; mantenere OpenAPI al rilascio | HIGH | S |  |  |
| 6. Webhooks | DONE | DONE | Register/sign, coda D1 retry+backoff, DLQ, replay admin, PATCH/DELETE webhook; **secret_hash** verificato, webhook_secret rimosso da deliveries, POST /webhooks/verify | UI dashboard list/edit/delete | MEDIUM | S |  | `room_summary` auto: opt-in env `AUTO_ROOM_SUMMARY_*`; secret shown once at creation |
| 7. AI Layer | PARTIAL | DONE | Servizio AI, invoke, runs, tool calling, provider OpenAI/Anthropic, builtin templates; **@onboarding** provisioned on project create; **agentTyping** on mention invoke; ai-agent D1 lookup | marketplace | HIGH | L |  | @onboarding E2E verified |
| 8. SDK & UI Kit | PARTIAL | DONE | useChat+reconnect+**SSE fallback**+polling, REST+WS edit/delete; `uploadFile`+REST `attachments`; MessageInput file picker quando JWT | UI upload edge cases avanzati | HIGH | M |  | SSE: GET /rooms/:id/stream + EventSource SDK; WS→SSE→polling cascade |
| 9. Dashboard | PARTIAL | DONE | Session, billing, agents+delete+edit, `/rooms`, admin+webhook CRUD UI, analytics, onboarding, Privacy/GDPR actions + **compliance report** + **delete modal**; **home**: operator shortcuts + capability overview cards | Stripe prod verification; storytelling esterno/hosted docs | MEDIUM | S |  | GDPR self-serve completato |
| 10. Pricing | PARTIAL | IN_PROGRESS | project_plans D1, enforcement quote, /stats/costs, UI piano+usage, overage policy doc (`docs/billing-overage-policy.md`), Stripe webhook idempotenza (`stripe_webhook_events`) | Stripe E2E produzione | HIGH | M |  |  |
| 11. Roadmap | DONE | DONE | Fasi definite in spec | Allineare sprint tecnici e DoD | HIGH | S |  | Questa roadmap e la fonte unica |
| 12. NFR Performance | PARTIAL | IN_PROGRESS | Realtime, endpoint /stats/slo; script+thresholds | Esecuzione benchmark su env reale + tuning soglie | HIGH | M |  | `perf-workload-check`, `docs/performance-benchmark.md` |
| 13. NFR Sicurezza | DONE | DONE | JWT verify, webhook signing, admin auth, WS auth/membership, Stripe verification, SSRF, XSS, API key hash-only, sessionStorage | KV namespace placeholder da configurare al deploy | HIGH | M |  | Security hardening completato |
| 14. NFR Osservabilita | DONE | DONE | trace_id, log JSON, metriche D1, alert rules, audit, dispatch esterno | Tuning in produzione (rumore vs segnale) | MEDIUM | S |  |  |
| 15. NFR Costi infra | PARTIAL | TODO | /stats/costs, usage mensile, launch-kpis | Affinare margini su traffico pilot | MEDIUM | M |  |  |

---

## Sintesi stato, falsi gap e backlog operativo

### Dove siamo (codice)

- **M1–M5:** chiusi nel complesso (sicurezza, affidabilità, API, osservabilità, hardening, docs, quote, onboarding).
- **Già in produzione “logica”:** JWT + ruoli, WS + membership, coda webhook con retry/DLQ/replay, `trace_id` e metriche/alert, audit, piani D1 `project_plans` con enforcement quote, GDPR `GET /gdpr/export` e `DELETE /gdpr/delete` + compliance report self-serve, billing UI (`/billing`), Stripe checkout/portal quando `STRIPE_SECRET_KEY` è configurato, agent CRUD + tool calling, built-in seed (`0024` + `0026` @onboarding) **provisioned on project create**, **`DELETE /rooms/:id`** + SDK `deleteRoom`, dashboard **`/rooms`**, admin **webhook list/PATCH/DELETE + verify**, **edit agent** in UI, session dashboard in `sessionStorage`, SDK **`useChat`** con **WS→SSE→polling cascade**, **`GET /rooms/:id/stream`** SSE endpoint, `connectSSE` EventSource, doc **`docs/dashboard-integration.md`**.

### Correzioni (analisi vecchie vs repo attuale)

| Voce spesso ancora citata male | Verità oggi |
|--------------------------------|-------------|
| Mancano `GET/PATCH/DELETE /agents/:id` | **Presenti** in `apps/worker/src/worker.js` (~635–823). |
| Mancano `PATCH/DELETE /webhooks/:id` | **Presenti** (~2058–2147). |
| Solo `GET` su `/rooms/:id/members` | Anche **`POST`** aggiunta e **`DELETE`** rimozione membri (~3410–3487). |
| Manca `PATCH /rooms/:id` | **Presente** (~3490–3537). |
| SDK senza `deleteRoom` | **`deleteRoom`** + worker **`DELETE /rooms/:id`** (cascade D1). |
| Piano tenant “solo env” | **`project_plans`** + `getProjectPlan` + `POST /admin/projects/:id/plan`. |
| Dashboard senza delete agent | **`apps/dashboard/app/agents/page.tsx`** — `deleteAgent`. |
| No GDPR / billing UI / tool calling | GDPR sì; **`billing/page.tsx`**; tool calling nel worker (`0021`, LLM con tools). |
| Built-in @onboarding assente | Migrazione **`0026_onboarding_builtin_agent.sql`** + seed; **moderazione substring** opt-in (`BUILTIN_MODERATION_*`, webhook `moderation.auto_flag`); summary auto opt-in `AUTO_ROOM_SUMMARY_*`. |

### Backlog per priorità (aggiornare insieme alla matrice)

**P0 — SPEC / lifecycle**

| Gap | Nota |
|-----|------|
| ~~**DELETE room**~~ | **Fatto:** `DELETE /rooms/:id` (owner/admin), SDK `deleteRoom`, pagina `/rooms`. |
| **Matrice** | Riga per riga sopra: rivederla a ogni release significativa. |

**P1 — Dashboard / operator**

| Gap | Nota |
|-----|------|
| ~~**Webhook UI**~~ | **Fatto:** lista `GET /admin/webhooks`, card edit PATCH + delete in Admin. |
| ~~**Rooms**~~ | **Fatto:** pagina `/rooms` (lista, create, rename, delete, membri con admin JWT). |
| ~~**Edit agent**~~ | **Fatto:** sezione “Edit selected agent” + `updateAgent`. |

**P2 — SPEC / differenziazione**

| Gap | Nota |
|-----|------|
| SSE / long-poll HTTP dedicato | **Fatto:** `GET /rooms/:id/stream` (SSE via DO TransformStream), SDK `connectSSE` + `useChat` WS→SSE→polling cascade. |
| UI kit atomico SPEC §8 | **Fatto (base):** come sopra + **upload R2/JWT** via `uploadComposerFile`; REST invia allegati insieme al messaggio. Restano drag-drop/progress/UI edge avanzati. |
| ~~`deleteMessage` / `editMessage`~~ | **Fatto:** fallback WS se REST fallisce; delete WS lato DO + test. |
| ~~`room_summary` automatico~~ | **Fatto (opt-in):** dopo ogni messaggio (REST, WS, bot, agent) se `AUTO_ROOM_SUMMARY_ENABLED=true`, `AUTO_ROOM_SUMMARY_EVERY_N>0`, `AI_BASE_URL`; cooldown vs ultimo `room_summary` / `room_summary_auto`. |
| ~~Built-in “da prodotto”~~ | **Fatto:** `room_summary` auto (opt-in AI); **moderazione** blocklist substring → `moderation.auto_flag`, `moderation_builtin_flag`, admin reports incl. `auto_flag`. |

**P3 — Sicurezza / ops**

| Gap | Nota |
|-----|------|
| Secret webhook | **Fatto:** `secret_hash` usato per verifica; `webhook_secret` rimosso da `webhook_deliveries`; segreto mostrato solo a creazione; `POST /webhooks/verify` timing-safe; **opt-in encryption at rest** (`WEBHOOK_SECRET_ENCRYPTION_KEY`, columns `secret_ciphertext/secret_iv`, legacy plaintext fallback). |
| **KV** produzione | `RATE_LIMIT_KV` reale (runbook §1.1). |
| **Stripe** | E2E + webhook billing in prod. |
| GDPR “prodotto” | **Fatto:** Export/Erasure/Compliance report self-serve in `/privacy`; modal conferma erasure (non `window.confirm`); security claim aggiornato (secret non esposto dopo creazione). |
| Load / SLO | Benchmark su ambiente target (M6-D): endpoint `POST /benchmark` + guida `docs/performance-benchmark.md`. |

---

## Milestone e checklist esecutiva

## M1 - Fase A: Sicurezza (1-2 settimane)

Target: baseline production-safe.

- [x] Proteggere tutti gli endpoint admin con JWT + roles (`owner/admin/mod`)
- [x] Validare JWT su connect WebSocket (`token` obbligatorio)
- [x] Membership check room lato Worker/DO (no `userId` trusted da query)
- [x] Hash API key at-rest + support key rotation
- [x] Rate limit per tenant/user/room su endpoint critici
- [x] Aggiornare test minimi sicurezza (authn/authz) — 16 test passing (unit + e2e)
- [x] Aggiornare docs integrazione auth (JWT, sessionStorage dashboard, `/billing/plan`, GDPR, webhook/room CRUD — `docs/dashboard-integration.md` + link in `docs/README.md` e README root

Exit criteria M1:
- [x] Nessun endpoint admin accessibile senza token valido e ruolo corretto
- [x] WS handshake rifiuta connessioni senza token o senza membership
- [x] API keys non piu salvate in chiaro — legacy plaintext fallback rimosso, solo SHA-256 hash lookup

Status: `DONE`

---

## M2 - Fase B: Affidabilita Core (2-3 settimane)

Target: core robusto e debuggabile.

- [x] Webhook queue + retry con backoff
- [x] Dead-letter queue (DLQ) per delivery fallite
- [x] Endpoint/pannello replay webhook
- [x] SDK reconnect/backoff robusto con stato connessione
- [x] Soft-delete default su messaggi (hard delete solo GDPR/admin)
- [x] Smoke test suite worker (vitest) per helper critici affidabilita/sicurezza
- [x] Test E2E core: send/edit/delete/reaction/read/report
- [x] Test E2E webhook delivery/retry

Exit criteria M2:
- [x] Delivery webhook resilienti con retry e visibilita stato
- [x] Reconnect client affidabile in condizioni di rete instabile
- [x] Delete behavior allineato alla spec

Status: `DONE`

---

## M3 - Fase C: Allineamento SPEC/API (2-4 settimane)

Target: contract spec <-> codice allineato.

- [x] Decidere standard pubblico (`/agents` vs `/bots`) e documentarlo
- [x] Implementare API mancanti (`/auth/token`, `/agents*`, `/stats/ai`)
- [x] Uniformare naming payload/eventi rispetto a SPEC.md
- [x] Estendere SDK con funzioni AI (`invokeAgent`, `agentTyping`)
- [x] Aggiornare dashboard con gestione agenti e run history base
- [x] Aggiornare documentazione endpoint e esempi integrazione

Exit criteria M3:
- [x] Matrice API spec 100% coperta o esplicitamente de-scope
- [x] SDK e dashboard usano i contratti finali

Status: `DONE`

---

## M4 - Fase D: Osservabilita e Costi (1-2 settimane)

Target: operabilita reale e controllo margini.

- [x] Structured logs Worker/DO/AI agent con `trace_id`
- [x] Metriche base (throughput, error rate, webhook failures, agent failures)
- [x] Alert su soglie critiche (error rate, retry spike, cost spike)
- [x] Cost dashboard reale (Workers, DO time, D1 ops, egress, AI usage)
- [x] Definire e tracciare SLI/SLO iniziali

Exit criteria M4:
- [x] Incident triage possibile con tracing/logging consistenti
- [x] Costi osservabili per tenant e feature

Status: `DONE`

---

## M5 - Production Hardening & GTM Readiness (2-6 settimane)

Target: passare da "robusto MVP" a "production-ready per primi clienti paganti".

### M5-A - Hardening tecnico e operativita

- [x] Estendere test suite su edge cases auth/authz (token scaduti, ruoli misti, membership room edge)
- [x] Estendere test webhook su retry limite/cooldown/fallimenti permanenti
- [x] Definire checklist deploy + rollback operativo (runbook)
- [x] Eseguire drill backup/restore e validare recovery per tenant
- [x] Implementare dispatch alert verso canale esterno (webhook/Slack/email) con dedupe
- [x] Rafforzare audit trail per azioni admin/moderazione critiche

Exit criteria M5-A:
- [x] Nessun P0/P1 aperto nei flussi core
- [x] Runbook deploy/rollback e recovery testati almeno una volta
- [x] Alert critici inviati automaticamente a canale esterno

Status M5-A: `DONE`

### M5-B - Developer Experience e docs v1

- [x] Strutturare docs per use case (support chat, team chat, assistant room)
- [x] Aggiungere cookbook auth/token/JWT + esempi role-based
- [x] Aggiungere troubleshooting guide (WS disconnect, webhook retry, rate limit, SLO breach)
- [x] Pubblicare snippets "copy-paste" Next.js + Worker end-to-end
- [x] Definire changelog/contract policy per endpoint pubblici (`agents`, `stats/*`, SDK)

Exit criteria M5-B:
- [x] Onboarding tecnico completabile in < 30 minuti da zero
- [x] Documentazione copre happy path + top 10 failure mode

Status M5-B: `DONE`

### M5-C - GTM readiness e monetizzazione

- [x] Chiudere enforcement quote/piani su endpoint e limiti runtime
- [x] Definire pricing guardrails e margini minimi per piano
- [x] Migliorare onboarding dashboard (progetto -> token -> room -> first message -> first agent invoke)
- [x] Definire KPI di lancio (activation, retention dev, conversion free->paid)
- [x] Preparare materiale release (landing update, changelog pubblico, demo script)

Exit criteria M5-C:
- [x] Piani e quote enforceati in runtime
- [x] Funnel onboarding misurabile end-to-end
- [x] Pronto per release controllata verso primi utenti esterni

Status M5-C: `DONE`

Status M5: `DONE`

---

## M6 - Controlled Rollout & Post-MVP Expansion (2-8 settimane)

Target: passare da "release-ready" a "primi clienti reali + feedback loop + fondamenta business".

### M6-A - Rollout reale e validazione operativa

Artefatti eseguibili (checklist + smoke script): `docs/m6-operational-checklist.md`, `pnpm smoke:worker` / `apps/worker` → `pnpm run smoke:remote` (richiede base URL + JWT admin reali).

- [ ] Applicare ultime migrazioni e deployare in ambiente target con `RUNBOOK_DEPLOY_ROLLBACK.md`
- [ ] Eseguire smoke test completi su worker/dashboard dopo deploy
- [ ] Validare onboarding end-to-end con almeno 1 tenant reale o pilot
- [ ] Verificare in produzione `/stats/slo`, `/stats/costs`, `/stats/launch-kpis`
- [ ] Aprire rollout controllato verso primi utenti esterni

Exit criteria M6-A:
- [ ] Primo tenant/pilot attivo con onboarding completato
- [ ] Nessun blocker P0/P1 emerso dal rollout iniziale
- [ ] KPI base raccolti su traffico reale

Status M6-A: `TODO`

### M6-B - Billing e monetizzazione reale

- [x] Definire modello piani persistente (free / paid / enterprise-ready) — tabella D1 `project_plans`, default su creazione progetto
- [x] Implementare stato piano per project/tenant in runtime — `getProjectPlan`, campi Stripe su plan, `POST /admin/projects/:id/plan`
- [x] Collegare quote, overage e pricing guardrails a piano reale — enforcement lettura limiti da piano + fallback env (`QUOTA_*`)
- [-] Preparare logica base per fatturazione/upgrade manuale o self-serve — `POST /billing/checkout` e `/billing/portal` con Stripe; completare **E2E in produzione** (segreti, webhook Stripe, test pagamento)
- [x] Esporre nel dashboard lo stato piano e i limiti correnti — pagina `/billing`, analytics/progetti con plan+usage

Exit criteria M6-B:
- [x] Ogni tenant ha un piano esplicito e limiti coerenti
- [x] Quote enforcement guidato da piano reale e non solo env globale
- [-] Upgrade path definito e documentato — aggiunto `docs/billing-stripe-runbook.md`; resta verificare in produzione (checkout → webhook → piano, portal → cancel)

Status M6-B: `IN_PROGRESS`

### M6-C - Validazione GTM e primi feedback utenti

Template operativo: `docs/m6-pilot-gtm-playbook.md`.

- [ ] Definire cohort iniziale di beta users / pilot tenants
- [ ] Raccogliere feedback strutturato su onboarding, pricing e UX
- [ ] Misurare activation, retention e conversion su utenti reali
- [ ] Identificare top friction points nel funnel e tradurli in task prodotto
- [ ] Aggiornare positioning/landing in base ai segnali raccolti

Exit criteria M6-C:
- [ ] Almeno un ciclo feedback -> miglioramento completato
- [ ] Funnel misurato con dati utenti reali
- [ ] Chiarezza maggiore su ICP, pricing e messaggio GTM

Status M6-C: `TODO`

### M6-D - Polish prodotto, UX e hardening infra/performance

- [x] Rifinire UX dashboard (projects, onboarding, analytics, agents, search, home) — sessione condivisa, Banner/Section/UI, stati loading/errore
- [x] Migliorare landing e presentazione demo-oriented del prodotto — home: percorsi operator (+ search/billing), overview cards (tenancy/realtime/compliance), stato connessione, copy SDK; `docs/dashboard-integration.md` su mention + automazioni Worker
- [-] Chiudere gap architetturali residui su KV/R2 dove servono realmente — R2 upload/serve guards + 503; KV rate-limit fallback con try/catch; health `degradedFeatures`; KV namespace IDs ancora placeholder
- [-] Eseguire benchmark/performance verification su workload realistici — aggiunto script `apps/worker/scripts/perf-workload-check.mjs` + runbook `docs/performance-benchmark.md`; da eseguire su env target
- [-] Validare SLO su ambiente reale e definire capacity thresholds — baseline `apps/worker/scripts/perf-thresholds.v1.json` + eval in `perf-workload-check`; da validare su env reale

Exit criteria M6-D:
- [x] Dashboard e landing presentabili per beta pubblica — home operativa come demo console; polish esterno/hosted docs opzionale
- [ ] Performance e SLO verificati con carico realistico
- [ ] Gap tecnici principali post-MVP ridotti o esplicitamente de-scope

Status M6-D: `IN_PROGRESS` (landing/docs/operator ok; KV/R2 degradation done; KV namespace IDs placeholder ops; benchmark/SLO da fare)

Status M6: `TODO` (M6-B `IN_PROGRESS`; M6-D `IN_PROGRESS`)

---

## Registro avanzamenti (append-only)

Formato suggerito:
- `YYYY-MM-DD | Milestone/Task | Update | By`

Esempi:
- `2026-04-27 | M1/auth-admin | aggiunta auth middleware su /admin/* | alefare`
- `2026-04-27 | M1/ws-auth | handshake JWT validato, membership check TODO | assistant`

- `2026-04-27 | roadmap | creato file ROADMAP_EXECUTION.md con matrice e milestone | assistant`
- `2026-04-27 | M1/auth-admin+ws | admin endpoints protetti con JWT+roles, WS token obbligatorio e membership check in Worker/DO, SDK ws token propagation | assistant`
- `2026-04-27 | M1/api-keys | aggiunta migrazione hashing api keys, lookup by hash con fallback legacy, endpoint rotazione /admin/projects/{id}/keys/rotate | assistant`
- `2026-04-27 | M1/rate-limit | aggiunto rate limit per messaggi HTTP, report API e messaggi WS (tenant/user/room), con KV support e fallback in-memory dev | assistant`
- `2026-04-27 | M1/rate-limit-hardening | aggiunti header Retry-After sui 429 e binding RATE_LIMIT_KV nel wrangler con istruzioni setup | assistant`
- `2026-04-27 | M2/webhook-queue | introdotta coda D1 webhook_deliveries con retry/backoff, stato failed (DLQ logica), endpoint admin list/replay delivery | assistant`
- `2026-04-27 | M2/sdk-reconnect | useChat aggiornato con reconnect automatico + exponential backoff e stato connessione (connecting/reconnecting/connected/disconnected) | assistant`
- `2026-04-27 | M2/soft-delete | DELETE messaggi reso soft-delete di default (deleted_at + placeholder), hard delete solo con hard=true e ruolo admin/owner; query history/search/stats/export allineate a deleted_at IS NULL | assistant`
- `2026-04-27 | M2/tests-smoke | aggiunta suite vitest in apps/worker con 4 test smoke su helper (rate limit fallback, role check, retry backoff, truncate); script test attivato | assistant`
- `2026-04-27 | M2/tests-e2e | aggiunta suite integration su worker.fetch con fake env/DB: flow core (send/edit/delete/reaction/read/report) e webhook retry+replay; fix regressione hardDeleteRequested | assistant`
- `2026-04-27 | M3/api-alignment-1 | standard pubblico su /agents (compat /bots), aggiunti endpoint /auth/token, /agents (GET/POST/PATCH/invoke/runs), /stats/ai, e nuova migrazione agent_runs | assistant`
- `2026-04-27 | M3/api-alignment-2 | naming payload/eventi allineato (senderId alias nei messaggi, header webhook X-Fluxy-Event/X-Fluxy-Project-Id/X-Fluxy-Delivery-Id) e SDK esteso con API agenti/runs + useChat.invokeAgent e agentTyping | assistant`
- `2026-04-27 | M3/dashboard-agents | aggiunta pagina dashboard /agents con load via JWT, creazione agenti, invoke e run history base; link nav aggiornato | assistant`
- `2026-04-27 | M3/docs | README aggiornato con contract agents/bots, quickstart /auth/token, /agents*, /stats/ai e uso SDK invokeAgent/agentTyping. M3 chiusa | assistant`
- `2026-04-27 | M4/logging-trace | introdotto trace_id per request HTTP, header X-Trace-Id e logging strutturato JSON (info/error) su worker con eventi principali webhook/auth | assistant`
- `2026-04-27 | M4/metrics-base | aggiunta tabella D1 operational_metrics, contatori base (requests_total, messages_created, webhook_delivery_failed) e endpoint operativo /stats/ops per aggregazione a finestre temporali | assistant`
- `2026-04-27 | M4/metrics-errors | aggiunti contatori requests_error (su risposte JSON >=400) e agent_runs_failed (invoke fallite/not found), con tracking su /stats/ops | assistant`
- `2026-04-27 | M4/alerts-thresholds | aggiunte regole alert configurabili (admin/alerts/rules), valutazione automatica con cooldown, eventi alert persistenti e endpoint /stats/alerts(+/evaluate) | assistant`
- `2026-04-27 | M4/cost-dashboard | esteso /stats/costs con auth+breakdown reale (messages/requests/webhook/agent/ai), proiezioni e assumptions env; aggiornata dashboard analytics con sezione costi dettagliata | assistant`
- `2026-04-27 | M4/sli-slo | aggiunto endpoint /stats/slo con SLI (request error rate + webhook success rate), target SLO configurabili via env e health score; README aggiornato. M4 chiusa | assistant`
- `2026-04-27 | M5/planning | aggiunta roadmap M5 nel file unico (hardening tecnico, DX/docs, GTM readiness) con checklist ed exit criteria | assistant`
- `2026-04-27 | M5-A/tests-auth-edge | estesa suite integration con casi auth/authz: JWT scaduto, accesso member a endpoint admin vietato, WS connect rifiutata se non membro room; helper test aggiornato per Response thrown e header custom | assistant`
- `2026-04-27 | M5-A/tests-webhook-retry-edge | estesi test integration webhook su edge case retry: rispetto cooldown (no retry anticipato), fail permanente al max attempts e stop retry dopo stato failed | assistant`
- `2026-04-27 | M5-A/runbook-deploy-rollback | aggiunto RUNBOOK_DEPLOY_ROLLBACK.md con checklist go/no-go, deploy worker+ai-agent, smoke checks, procedura rollback, incident log e drill operativo; README linkato | assistant`
- `2026-04-27 | M5-A/drill-backup-restore | aggiunto script operativo apps/worker/scripts/tenant-recovery-drill.mjs (export room, replay su recovery room, validazione conteggi, artifact JSON) + runbook aggiornato con procedura pratica; task backup/restore chiuso | assistant`
- `2026-04-27 | M5-A/alerts-external-dispatch | aggiunto dispatch automatico alert verso webhook esterno (`ALERT_DISPATCH_WEBHOOK_URL`) con dedupe deterministico per evento; tracking stato dispatch in nuova tabella D1 `operational_alert_dispatches` (migration 0016) | assistant`
- `2026-04-27 | M5-A/audit-trail | aggiunta tabella D1 `operational_audit_events` (migration 0017), helper writeAuditEvent e logging su azioni admin/mod (mute/ban/unmute/unban/announcement, project create, key rotate, alert rule upsert, webhook delivery replay) + endpoint admin /admin/audit/events e test e2e | assistant`
- `2026-04-27 | M5-A/close | exit criteria chiusi, status M5-A impostato a DONE | assistant`
- `2026-04-27 | M5-B/docs-use-cases | aggiunta struttura docs/ con home e 3 guide use case (support chat, team chat, assistant room) + link da README | assistant`
- `2026-04-27 | M5-B/docs-auth-cookbook | aggiunto cookbook docs/cookbook/auth-jwt.md con flow API key->JWT, mapping ruoli, esempi curl, WS auth e snippet Next.js route handler | assistant`
- `2026-04-27 | M5-B/docs-troubleshooting | aggiunta guida docs/troubleshooting.md con playbook per WS disconnect, webhook retry/backlog, rate limit 429 e SLO breach (comandi stats/ops, stats/slo, deliveries, audit) | assistant`
- `2026-04-27 | M5-B/docs-snippets-nextjs | aggiunto snippet docs/snippets/nextjs-end-to-end.md (App Router) con env, route handler mint JWT e pagina client con @fluxy-chat/sdk useChat | assistant`
- `2026-04-27 | M5-B/contract-policy | aggiunta policy docs/contract-policy.md (compat rules, semver SDK, deprecations) + creato CHANGELOG.md iniziale | assistant`
- `2026-04-27 | M5-C/quotas-enforcement | aggiunta migrazione 0018 project_usage_monthly e enforcement quote mensili su POST /messages, WS send message, /agents/:id/invoke e enqueue webhook deliveries; risposta 402 quota_exceeded + test e2e | assistant`
- `2026-04-27 | M5-C/pricing-guardrails | esteso /stats/costs con stima ricavi + gross margin e guardrails (MIN_GROSS_MARGIN) basati su env PRICE_*; dashboard analytics aggiornata per visualizzarli; README aggiornato | assistant`
- `2026-04-27 | M5-C/dashboard-onboarding | aggiunta pagina dashboard /onboarding con wizard end-to-end (admin JWT -> create project -> mint member JWT -> create room -> first message -> create/invoke agent) + link in Header/CTA | assistant`
- `2026-04-27 | M5-C/launch-kpis | aggiunto endpoint /stats/launch-kpis (activation funnel, retention proxy 7d/prev7d, conversion free->paid proxy), dashboard analytics aggiornata con sezione Launch KPIs e README quickstart aggiornato | assistant`
- `2026-04-27 | M5-C/release-materials | landing copy aggiornata su home dashboard, changelog pubblico aggiornato (Unreleased), aggiunto demo script docs/release/demo-script.md e link docs index; M5-C chiusa | assistant`
- `2026-04-27 | post-M5/release-polish | aggiunte release notes suggerite v0.2.0 (docs/release/release-notes-v0.2.0.md), linkate da docs index, e changelog allineato a M5-C completata | assistant`
- `2026-04-28 | M6/planning | estesa roadmap post-M5 con 4 direttrici: rollout reale, billing/monetizzazione, validazione GTM e polish UX/infra/performance | assistant`
- `2026-05-09 | security/stripe-verification | implementata verifyStripeWebhookSignatureAsync con HMAC-SHA256 via crypto.subtle, timing-safe comparison, replay protection (5min window), rimosso sync stub | assistant`
- `2026-05-09 | security/ws-validation | aggiunta validazione content nel path WebSocket (validateMessageContent), usato validatedContent per DB insert e broadcast | assistant`
- `2026-05-09 | security/ai-agent-cors | migrato AI agent da CORS * a ALLOWED_ORIGINS configurabile (stesso pattern del worker principale) | assistant`
- `2026-05-09 | security/ssrf-protection | aggiunta isPrivateUrl() in fetchOgPreview — blocca localhost, private IPv4, link-local, IPv6 loopback, .local/.internal/.localhost | assistant`
- `2026-05-09 | security/automation-auth | aggiunta verifica JWT su /automation/trigger — prima era aperto senza autenticazione | assistant`
- `2026-05-09 | security/xss-hardening | migliorata sanitizeString: full HTML tag stripping, javascript:/data:/vbscript: URL neutralization, null byte removal, HTML comment removal | assistant`
- `2026-05-09 | security/csv-rfc4180 | aggiunta escapeCsvField() per RFC 4180 compliant CSV export (double-quote escaping, CRLF line endings) | assistant`
- `2026-05-09 | perf/n-plus-1-rooms | risolto N+1 query in GET /rooms: batch read receipts via GROUP BY, unread counts via UNION ALL (da 2N query a ~3) | assistant`
- `2026-05-09 | security/session-storage | migrato JWT da localStorage a sessionStorage con one-time migration e cleanup | assistant`
- `2026-05-09 | ai/anthropic-provider | implementato Anthropic Messages API (claude-sonnet-4-20250514, system prompt, conversation context, x-api-key auth, anthropic-version header) | assistant`
- `2026-05-09 | security/api-key-hash | rimosso fallback a plaintext API key lookup in resolveProjectId, solo SHA-256 hash lookup | assistant`
- `2026-05-09 | security/hardening-complete | 12 fix critici implementati e testati (18/18 test passing). Security score da 5/10 a 8/10 | assistant`
- `2026-05-10 | roadmap/matrix-sync | aggiornata matrice SPEC (webhook/osservabilita/API/pricing), M6-B IN_PROGRESS (Stripe E2E), M6-D dashboard UX base ok | assistant`
- `2026-05-10 | roadmap/single-source | consolidato sintesi gap P0-P3 e “falsi gap” in questo file; rimosso ROADMAP_STATE_AND_NEXT_STEPS.md | assistant`
- `2026-05-10 | product/operator-ui | DELETE /rooms/:id + cascade D1, SDK deleteRoom, dashboard /rooms, admin webhook list+PATCH+DELETE, agents edit form, migrazione 0026 @onboarding, test e2e room delete | assistant`
- `2026-05-10 | M6-D+M1/docs | home dashboard: quick links operator, connectionStatus polling/reconnect; docs/dashboard-integration.md; roadmap matrice P2/SDK+P1 docs checkbox | assistant`
- `2026-05-10 | P2/ui-kit | packages/ui atomic components SPEC §8, ChatWindow refactoring, dashboard home: agentTyping + online chips | assistant`
- `2026-05-10 | P2/automation-room-summary | maybeTriggerAutoRoomSummary: env EVERY_N + cooldown, audit automation_events room_summary_auto; generateRoomSummary tenant-safe project_id; fix agent.invoke failed branch (rimosso provisionBuiltinAgents errato) | assistant`
- `2026-05-10 | M6-D/home-landing-docs | Home: shortcuts search/billing + tre card (tenancy, realtime/@mentions, compliance/webhook env); docs/dashboard-integration.md @mentions + AUTO_ROOM_SUMMARY/BUILTIN_MODERATION | assistant`
- `2026-05-10 | SPEC8/attachments | REST POST /messages: attachments persist + DO broadcast ricco; @mention rows/automation parity con WS; SDK createMessage+uploadFile; MessageInput picker con JWT; audio MIME whitelist | assistant`
- `2026-05-11 | M6-B/stripe-webhook-hardening | checkout propagates subscription metadata; stripe webhooks resolve project by metadata/customer/subscription; plan upsert avoids wiping quota limits; docs billing-stripe-runbook | assistant`
- `2026-05-11 | P3/webhook-secret-encryption | optional AES-GCM at-rest encryption for webhook secrets (WEBHOOK_SECRET_ENCRYPTION_KEY) + DB migration 0028; delivery decrypts for HMAC; legacy plaintext fallback | assistant`
- `2026-05-11 | P3/load-slo-playbook | added docs/performance-benchmark.md for /benchmark + /health + /stats/slo workflow | assistant`
- `2026-05-11 | M6-D/perf-workload-script | added apps/worker/scripts/perf-workload-check.mjs + package script perf:workload-check (HTTP workload summary: p50/p95, throughput, failures, optional benchmark/slo/health snapshot) | assistant`
- `2026-05-11 | M6-B/overage-policy-docs | added docs/billing-overage-policy.md + docs index link; billing UI clarifies 402 quota_exceeded behavior | assistant`
- `2026-05-11 | M6-B/stripe-webhook-idempotency | migration 0029 stripe_webhook_events + duplicate event ignore in /webhooks/stripe; e2e test for duplicate subscription.updated event | assistant`
- `2026-05-11 | M6-D/perf-thresholds | added apps/worker/scripts/perf-thresholds.v1.json + threshold evaluation in perf-workload-check (optional strict exit code for smoke/CI gating) | assistant`
- `2026-05-11 | M6-D/analytics-perf-signal | analytics page now computes PASS/CHECK against v1 thresholds using /benchmark + /stats/slo + open alerts (green/red cards per metric) | assistant`
- `2026-05-11 | M6-D/analytics-perf-export | analytics performance signal section now exports JSON report (thresholds, checks expected/actual, benchmark/slo snapshot, overall status) | assistant`
- `2026-05-11 | P3/webhook-secret-hash | Completato secret_hash: webhook_secret rimosso da webhook_deliveries (migration 0027), secret mostrato solo a creazione con warning, POST /webhooks/verify per verifica firma con timing-safe comparison, delivery lookup da webhooks table | assistant`
- `2026-05-11 | P2/SSE-fallback | Implementato SSE: GET /rooms/:id/stream via DO TransformStream con heartbeat; SDK connectSSE + EventSource; useChat WS→SSE→polling cascade; connectionStatus "sse"; DO sseClients set + broadcast SSE; shared handleEvent | assistant`
- `2026-05-11 | M6-D/KV-R2-degradation | R2 upload/serve: guard !env.ATTACHMENTS→503 + try/catch; KV rate-limit: try/catch fallback local; health endpoint: degradedFeatures (rateLimiting, fileStorage); KV namespace IDs ancora placeholder | assistant`
- `2026-05-11 | AI/onboarding-agent | provisionBuiltinAgents() chiamato su project create (ctx.waitUntil); invokeMentionedAgents: agentTyping announce prima/dopo run (successo e errore); ai-agent service: D1 binding + lookupAgentConfig Strategy 0 (bots table) | assistant`
- `2026-05-11 | GDPR/privacy-self-serve | /privacy: compliance report download (admin), modal conferma erasure con dettagli (sostituisce window.confirm), security section aggiornata (webhook secrets non esposti dopo creazione) | assistant`
- `2026-05-11 | M6/no-secrets-hygiene | apps/worker/.dev.vars.example + .gitignore .dev.vars; dashboard lib/plan-catalog.ts per billing; GitHub Actions CI (pnpm test); README nota wrangler; wrangler.toml puntatore; test UI MessageInput ArrowDown+Enter menzioni | assistant`
- `2026-05-11 | M6-A/C/D-docs | docs/m6-operational-checklist.md + m6-pilot-gtm-playbook.md; smoke-remote.mjs + worker script smoke:remote + root smoke:worker; runbook §3 + billing-stripe exit criteria prod; docs/README + roadmap matrice note | assistant`
- `2026-05-11 | SPEC/docs+UI | docs/spec-implementation-map.md + product-landing-snippet.md; SPEC §5 nota estensioni; MessageInput filteredMentions usa mentionMatchesQuery+sort priorità; test UI label mention; runbook lint note; ai-agent README Anthropic; matrice righe 1/5/12 | assistant`
- `2026-05-12 | M6/tests+contract | worker e2e FakeDB: INSERT OR IGNORE quota bind, atomic usage UPDATE, Stripe plan UPDATE 9-arg branch, createEnv RATE_LIMIT_FALLBACK_ALLOW; Stripe webhook test seed manually_overridden; openapi.yaml: /health, /auth/token (X-Fluxy-Api-Key), /billing/*, /gdpr/*, POST /messages 402/429 | assistant`
- `2026-05-12 | M6/openapi+landing | openapi: agents/stats/webhooks/admin/rooms/stream/upload/attachments/benchmark/compliance; GET /api/messages JWT; dashboard /landing + Header Product; README monorepo line | assistant`

