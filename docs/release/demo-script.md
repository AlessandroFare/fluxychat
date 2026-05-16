# Fluxychat Demo Script (10-12 min)

Obiettivo: mostrare in modo concreto "time-to-value + controllo costi + readiness produzione".

## Setup (prima della demo)

- Worker e dashboard avviati
- JWT admin pronto per demo dashboard
- Browser aperto su:
  - `/onboarding`
  - `/analytics`
  - `/` (chat live)

## Agenda (narrativa)

1. Problema (1 min)
2. Onboarding in tempo reale (4 min)
3. AI agent invoke (2 min)
4. Observability + cost/guardrails + KPI (3 min)
5. Chiusura (1-2 min)

## Script operativo

### 1) Problema

- "Integrare chat realtime è ancora costoso/complesso."
- "Fluxychat punta su setup rapido e pricing trasparente."

### 2) Onboarding end-to-end

Vai su `/onboarding`:

- Step 1: crea progetto (mostra API key)
- Step 2: minta JWT member
- Step 3: crea room
- Step 4: invia primo messaggio (chat live)
- Sottolinea: "da zero a prima chat funzionante"

### 3) Primo AI agent invoke

Sempre su `/onboarding`:

- crea agent
- invoke nella room
- mostra risposta in chat

### 4) Operatività reale

Vai su `/analytics`:

- cost breakdown (`/stats/costs`)
- pricing guardrails (margine minimo)
- launch KPIs (`/stats/launch-kpis`)
- opzionale: mostra `/stats/slo` da curl

### 5) Chiusura

- "Core già production-hardened: auth, rate limit, webhook retry/replay, alerting, audit, quote runtime."
- "Pronto per rollout controllato ai primi utenti esterni."

## FAQ rapide (backup)

- **Come proteggete abuso?**
  - JWT roles, membership check WS, rate limiting, quote enforcement.
- **Come fate debug incidenti?**
  - trace_id, metriche ops, alerting rules, audit events.
- **Come contenete i costi?**
  - cost dashboard + guardrails di margine + quote per tenant.

