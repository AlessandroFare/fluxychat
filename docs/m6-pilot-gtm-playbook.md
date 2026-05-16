# M6-C — Pilot, feedback e GTM (template operativo)

Obiettivo: rendere **misurabile** il primo contatto con utenti reali senza dipendere da feature nuove nel codice.

## 1. Cohorte pilota (chi entra per primo)

Definire in anticipo (anche in una nota interna):

| Campo | Esempio |
|--------|---------|
| Numero massimo tenant | 3–10 |
| Criteri inclusione | es. integratori B2B, un solo tenant “friend” |
| Cosa è in scope | messaggi + WS + webhook; AI opzionale |
| Cosa è fuori scope | SLA legali, overage automatico (vedi `billing-overage-policy.md`) |

## 2. Onboarding pilota (checklist da inviare)

1. Ricezione link dashboard + URL worker pubblico.  
2. Creazione progetto + API key.  
3. Mint JWT (ruoli documentati in `docs/cookbook/auth-jwt.md`).  
4. Prima room + primo messaggio (HTTP o SDK).  
5. (Opzionale) Webhook di test o agent invoke.  
6. Pagina **Analytics** → screenshot o export KPI/costi una volta a settimana.

## 3. Raccolta feedback strutturata (5 domande)

Chiedere dopo 3–7 giorni d’uso:

1. Quanto tempo ha richiesto l’onboarding dal link alla prima messaggio inviata?  
2. Dove vi siete bloccati per primo (auth, CORS, WS, webhook, altro)?  
3. Cosa vorreste vedere in dashboard che oggi manca?  
4. Il modello **Free / Starter / Pro** è comprensibile rispetto al vostro volume?  
5. Soddisfazione 1–5 e se consigliereste il prodotto in stato attuale.

## 4. Metriche da leggere senza strumenti esterni

Con JWT admin sul tenant pilota:

- `GET /stats/launch-kpis` — funnel activation / retention proxy / conversion proxy.  
- `GET /stats/costs` — costi stimati e guardrail pricing.  
- `GET /stats/slo` — error rate richieste e success rate webhook.

Dashboard **Analytics** riassume parte di questo; usate gli endpoint per log o report mensile.

## 5. Friction → task prodotto

Per ogni risposta “bloccato su X”, aprire un task unico (bug vs doc vs prodotto).  
Priorità suggerita: **P0** sicurezza/perdita dati, **P1** onboarding, **P2** polish.

## 6. Positioning / landing

Testo di partenza (SPEC): `docs/product-landing-snippet.md`.

Dopo almeno un ciclo feedback:

- Aggiornare copy **dashboard home** e/o sito pubblico con linguaggio allineato ai termini usati dai pilot (es. “webhook” vs “automazioni”).  
- Allineare tabella prezzi a `apps/dashboard/lib/plan-catalog.ts` se cambiano limiti o prezzi.

## Riferimenti

- Demo script: `docs/release/demo-script.md`  
- Integrazione dashboard: `docs/dashboard-integration.md`  
- Checklist deploy/smoke: `docs/m6-operational-checklist.md`
