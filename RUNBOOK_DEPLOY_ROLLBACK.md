# Fluxychat Deploy & Rollback Runbook

Runbook operativo per rilasci in produzione del backend edge (`apps/worker`) e servizio AI (`apps/ai-agent`).

## 1) Pre-deploy checklist (go/no-go)

- [ ] Nessun incidente P0/P1 aperto sui flussi core (messaggi, webhook, auth, agent invoke).
- [ ] Tutti i test passano in CI o localmente:
  - `pnpm test` (root: tutti i workspace con script `test`)
  - `pnpm -r lint` (dashboard, `packages/sdk`, `packages/ui`; i workspace senza script `lint` vengono saltati)
- [ ] Variabili ambiente production verificate:
  - `JWT_SECRET` / segreti auth tenant
  - binding `DB` valido
  - binding `RATE_LIMIT_KV` valorizzato (non placeholder)
  - variabili AI provider (se usate)
- [ ] Migrazioni D1 presenti e validate in staging.
- [ ] Finestra di deploy comunicata.
- [ ] Rollback owner assegnato.

## 1.1) Config checklist (real environment)

### Worker (`apps/worker`)

- [ ] `DB` binding punta al database D1 corretto.
- [ ] `ROOM` Durable Object migrato e attivo.
- [ ] `RATE_LIMIT_KV` valorizzato con namespace reale.
- [ ] `REQUIRE_ADMIN_AUTH=true`.
- [ ] `QUOTAS_ENABLED=true`.
- [ ] `DEFAULT_PROJECT_ID` impostato solo per bootstrap/dev, non per traffic reale.
- [ ] Segreti per tenant configurati in `project_secrets` (`jwt_secret`) o tramite flow admin previsto.
- [ ] Pricing/plan defaults verificati:
  - `QUOTA_MESSAGES_PER_MONTH`
  - `QUOTA_AGENT_INVOKES_PER_MONTH`
  - `QUOTA_WEBHOOK_DELIVERIES_PER_MONTH`
  - `DEFAULT_PRICING_VERSION`

### AI agent (`apps/ai-agent`)

- [ ] `FLUXY_BASE_URL` punta al worker deployato.
- [ ] `REQUIRE_WEBHOOK_SIGNATURE=true`.
- [ ] `WEBHOOK_SECRET` oppure `WEBHOOK_SECRET_<projectId>` configurato.
- [ ] `JWT_SECRET` oppure `JWT_SECRET_<projectId>` configurato, senza fallback placeholder.
- [ ] Provider secrets presenti (`OPENAI_API_KEY` o equivalenti per agent config).

### Dashboard (`apps/dashboard`)

- [ ] `NEXT_PUBLIC_FLUXYCHAT_WORKER_URL` punta al worker corretto.
- [ ] Sessione admin disponibile per pagine `Projects`, `Admin`, `Analytics`, `Agents`.
- [ ] Onboarding validato con:
  - project create
  - member JWT mint
  - room create
  - first message
  - first agent invoke

## 2) Deploy procedure (production)

Eseguire dalla root del monorepo.

### Step A - Sanity check locale

```bash
pnpm install
pnpm --filter @fluxychat/ai-agent test
pnpm --filter @fluxychat/dashboard test
pnpm --filter @fluxychat/worker test
pnpm --filter @fluxychat/dashboard build
```

### Step B - Apply migrazioni D1

```bash
cd apps/worker
pnpm exec wrangler d1 migrations apply fluxychat --remote
```

Se il deploy non introduce nuove migrazioni, questo comando deve risultare no-op.

### Step C - Deploy Worker API realtime

```bash
pnpm --filter @fluxychat/worker deploy
```

**Nota `wrangler deploy --env production`:** funziona solo se in `apps/worker/wrangler.toml` esiste una sezione `[env.production]` (o l’ambiente richiesto) con binding/variabili coerenti. Finché usate solo il blocco top-level del file, il comando standard è `pnpm --filter @fluxychat/worker deploy` (equivalente a `wrangler deploy` nella cartella worker **senza** `--env`).

### Step D - Deploy AI Agent service

```bash
pnpm --filter @fluxychat/ai-agent deploy
```

## 3) Post-deploy smoke checks (entro 10 minuti)

Eseguire con token admin valido (JWT con ruoli `owner`/`admin`/`moderator`).

**Smoke end-to-end (bash, dalla root repo):** con `TEST_API_KEY` (prefisso `fc_`) e opzionale `TEST_PROJECT_ID` / `WORKER_URL`:

```bash
export TEST_API_KEY=fc_...
export TEST_PROJECT_ID=<uuid-opzionale-per-verifica-tid>
./scripts/smoke-test.sh
# oppure: ./scripts/smoke-test.sh --local
```

Copre: `/auth/token`, `/rooms`, `/messages`, `/api/messages`, `/billing/checkout` (accetta anche `501` se Stripe assente), probe quota, `/health`, `DELETE /gdpr/delete`.

**Opzione rapida (solo stats):** dalla cartella `apps/worker`, dopo aver esportato o passato base URL e JWT:

```bash
pnpm run smoke:remote -- --base-url https://<worker-domain> --admin-jwt "<JWT_ADMIN>"
```

Verifica automaticamente `/health`, `/stats/slo`, `/stats/costs`, `/stats/launch-kpis`. Poi completare i curl sotto per ops e webhook.

```bash
curl -sS https://<worker-domain>/health
curl -sS -H "Authorization: Bearer <JWT>" https://<worker-domain>/stats/ops?minutes=15
curl -sS -H "Authorization: Bearer <JWT>" https://<worker-domain>/stats/slo?minutes=15
curl -sS -H "Authorization: Bearer <JWT>" https://<worker-domain>/admin/webhooks/deliveries?limit=20
```

Validazioni minime:

- [ ] `/health` risponde `ok: true`.
- [ ] Error rate non in spike anomalo.
- [ ] Nessun aumento rapido di webhook `failed`.
- [ ] Endpoint auth/token e send message testati su tenant smoke.
- [ ] `/stats/costs` espone `plan` e `usage` coerenti col tenant smoke.
- [ ] AI agent mention webhook rifiuta richieste senza signature.

## 4) Rollback procedure (fast path)

Trigger rollback se:

- incremento error rate persistente > SLO target per oltre 5-10 minuti;
- regressione auth/authz;
- fallimento delivery webhook diffuso;
- incidenti su message send/read in tenant pilota.

### Step A - Stop escalation

- Congelare nuovi deploy.
- Aprire incidente con `trace_id` e finestra temporale.

### Step B - Ripristinare versione precedente

Usare Cloudflare dashboard o CLI con versione precedente nota.
Se serve rollback DB, evitare downgrade distruttivi: preferire fix forward o feature flag disable.

### Step C - Mitigazione immediata

- Disabilitare temporaneamente feature impattante (es. invoke agent, webhook custom) se possibile.
- Confermare recovery con smoke checks sezione 3.

## 5) Incident log minimo (obbligatorio)

Per ogni rollback registrare:

- timestamp start/end;
- owner on-call;
- impatto utenti/tenant;
- metrica trigger (es. `requests_error`, `webhook_delivery_failed`);
- azione eseguita;
- stato finale.

## 6) Drill operativo mensile

Frequenza consigliata: 1 volta al mese.

- Drill A: deploy completo + smoke checks.
- Drill B: rollback simulato con recovery in <= 15 minuti.
- Drill C: restore tenant test da backup validato.

### Drill C - Procedura pratica (tenant backup/restore)

Prerequisiti:

- tenant con room sorgente popolata (`DRILL_SOURCE_ROOM_ID`);
- API key valida del tenant;
- worker raggiungibile (`FLUXY_BASE_URL`).

Comando:

```bash
cd apps/worker
FLUXY_BASE_URL="https://<worker-domain>" \
FLUXY_API_KEY="fc_..." \
DRILL_SOURCE_ROOM_ID="room_prod_like_1" \
DRILL_MESSAGE_LIMIT="20" \
pnpm run drill:tenant-recovery
```

Cosa verifica lo script:

- export backup JSON dalla room sorgente (`/export/messages.json`);
- creazione room di recovery dedicata;
- replay controllato dei messaggi di backup;
- re-export della room recovery e confronto conteggi.

Output:

- artifact JSON in `apps/worker/drills/tenant-recovery-<timestamp>.json`;
- `isRecoveryValid: true` quando il recovery check e superato.

Output atteso:

- runbook aggiornato;
- gap operativi trasformati in task roadmap;
- evidenza del tempo medio di recovery.

## 7) End-to-end validation sequence

Eseguire in quest’ordine prima di ogni rollout chiuso:

1. `pnpm --filter @fluxychat/worker test`
2. `pnpm --filter @fluxychat/ai-agent test`
3. `pnpm --filter @fluxychat/dashboard test`
4. `pnpm --filter @fluxychat/dashboard build`
5. `pnpm --filter @fluxychat/worker deploy`
6. `pnpm --filter @fluxychat/ai-agent deploy`
7. Onboarding reale da dashboard
8. Invio primo messaggio
9. Primo agent invoke
10. Verifica `stats/ops`, `stats/slo`, `stats/costs`, `stats/launch-kpis`

