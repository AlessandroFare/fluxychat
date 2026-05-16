# M6-A / M6-D — Checklist operativa (deploy, smoke, pilot, performance)

Questo documento **non sostituisce** `RUNBOOK_DEPLOY_ROLLBACK.md` e `docs/performance-benchmark.md`: li incrocia per chiudere **M6-A** (rollout) e la parte **M6-D** eseguibile senza inventare numeri (benchmark/SLO su env reale).

## Prerequisiti account (una tantum)

- [ ] **Workers Paid** attivo sull’account Cloudflare usato per il deploy.
- [ ] **D1** `fluxychat` (o nome scelto) creato; `database_id` in `apps/worker/wrangler.toml` allineato.
- [ ] **KV** per rate limit: creare namespace e incollare ID in `wrangler.toml` (sostituire `REPLACE_WITH_*`). Comandi: vedi `RUNBOOK_DEPLOY_ROLLBACK.md` §1.1.
- [ ] **R2** bucket allegati creato; binding `ATTACHMENTS` coerente con il bucket reale.
- [ ] **Segreti** Worker (`wrangler secret put …`) e variabili documentate in `apps/worker/.dev.vars.example` / runbook (Stripe, AI, ecc. solo se servono).

## Fase 1 — Migrazioni e deploy

Seguire **§2 Deploy** del runbook:

- [ ] `pnpm exec wrangler d1 migrations apply <database_name> --remote`
- [ ] `pnpm --filter @fluxychat/worker deploy`
- [ ] `pnpm --filter @fluxychat/ai-agent deploy` (se usate mention → AI agent)

## Fase 2 — Smoke automatico (subito dopo deploy)

Con **JWT admin** (claim `tid` = project id, ruoli `owner`/`admin`/`moderator`) del tenant di smoke:

```bash
cd apps/worker
pnpm run smoke:remote -- --base-url https://<worker-host> --admin-jwt "<JWT>"
```

Oppure:

```bash
set SMOKE_BASE_URL=https://<worker-host>
set SMOKE_ADMIN_JWT=<JWT>
pnpm run smoke:remote
```

Check impliciti:

- [ ] `GET /health` → `200`, `ok: true` (se `degraded`, verificare KV/R2 quando potete).
- [ ] `GET /stats/slo`, `/stats/costs`, `/stats/launch-kpis` → `200` senza `error` nel JSON.

Integrare con gli smoke curl del runbook **§3** (webhook deliveries, auth/token, messaggio di prova) per copertura completa.

**Alternativa bash:** dalla root del monorepo, `./scripts/smoke-test.sh` (vedi `RUNBOOK_DEPLOY_ROLLBACK.md` §3) con `TEST_API_KEY=fc_...` — esercita anche room/messages/GDPR senza JWT pre-mintato.

## Fase 3 — Pilot end-to-end (M6-A exit)

Definire **un tenant pilota** (anche interno) e completare:

- [ ] Dashboard → **Onboarding** (o API equivalente): progetto, API key, JWT member, room, primo messaggio, prima invoke agent (se in scope).
- [ ] Dashboard → **Billing** → load plan (verifica `project_plans` + usage).
- [ ] Dashboard → **Analytics**: sezione costi/guardrail e (se usata) performance signal.

Annotare `project_id`, data/ora, eventuali incidenti in `RUNBOOK` incident log se applicabile.

## Fase 4 — Performance / SLO (M6-D)

Dopo che esistono JWT **member** + **admin** e una `room-id` di test:

```bash
cd apps/worker
pnpm run perf:workload-check -- \
  --base-url https://<worker-host> \
  --member-token "<JWT_MEMBER>" \
  --admin-token "<JWT_ADMIN>" \
  --room-id <room> \
  --messages 120 \
  --concurrency 12 \
  --thresholds-file scripts/perf-thresholds.v1.json
```

Dettagli e interpretazione: `docs/performance-benchmark.md`.

- [ ] Eseguito su **env target** (non solo localhost), risultati archiviati (JSON export da Analytics se usate la card export).

## Fase 5 — Rollout controllato “esterni”

Gate minimi prima di aprire a utenti esterni:

- [ ] Smoke Fase 2 + 3 OK su ambiente **production** (o staging identico).
- [ ] Stripe (se monetizzazione attiva): checklist produzione in `docs/billing-stripe-runbook.md` sezione *Exit criteria produzione*.
- [ ] Canale supporto / raccolta issue (anche form interno) definito — vedi `docs/m6-pilot-gtm-playbook.md`.

## Collegamenti

- Deploy / rollback: `RUNBOOK_DEPLOY_ROLLBACK.md`
- Stripe E2E: `docs/billing-stripe-runbook.md`
- Benchmark: `docs/performance-benchmark.md`
- Pilot / feedback GTM: `docs/m6-pilot-gtm-playbook.md`

## Matrice SPEC — restano fuori da questo file (promemoria)

| Area | Azione tipica |
|------|----------------|
| §5 HTTP API | Mappa implementata: `docs/spec-implementation-map.md`. |
| §8 SDK/UI edge | Test/caso d’uso upload avanzati (drag-drop, errori rete). |
| §9 Dashboard | Stripe prod verificato + eventuale sito docs hosted. |
| §10 Pricing | Exit M6-B produzione. |
| §12 / §15 NFR | Dopo pilot: tuning `COST_*` / `PRICE_*` da traffico reale (`/stats/costs`). |
