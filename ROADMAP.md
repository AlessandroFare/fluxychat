# FluxyChat Roadmap 2026-2027

Roadmap completa con best practice, architetture, tool gratuiti/open-source e riferimenti al codice già pronto.

**Cloudflare Agents SDK (agents-main, Aug 2026) — threat + steal list + CF-A-001–044:** [docs/CLOUDFLARE-AGENTS-VS-FLUXYCHAT-ROADMAP.md](docs/CLOUDFLARE-AGENTS-VS-FLUXYCHAT-ROADMAP.md)

**Technical implementation guide (code-mapped, 🔴/🟡/🟢 priorities):** [docs/FEATURE_ROADMAP.md](docs/FEATURE_ROADMAP.md)

**Competitor parity (Sendbird/Stream/PubNub/CometChat/Vercel — CP-001–CP-083):** [docs/COMPETITOR-PARITY-ROADMAP-2026.md](docs/COMPETITOR-PARITY-ROADMAP-2026.md)

**Next wave (Aug 2026 research — NW-100–NW-206):** [docs/NEXT-WAVE-ROADMAP-2026.md](docs/NEXT-WAVE-ROADMAP-2026.md) · [Docs tracker](/docs/operations/next-wave-roadmap)

**Research round 3 (Aug 2026) — moonshot + enterprise parity:** [docs/FEATURE_ROADMAP.md#research-round-3--new-features--enterprise-parity-aug-2026](docs/FEATURE_ROADMAP.md) · Technical specs: [Cross-Org Agent Rooms](docs/FLUXYCHAT-CROSS-ORG-AGENT-ROOMS-E-NUOVE-FEATURE.md) · [Counterfactual/Debate/Empathy](docs/FLUXYCHAT-COUNTERFACTUAL-DEBATE-EMPATHY.md) · [Firmware/Merge/Speculative](docs/FLUXYCHAT-ROOM-FIRMWARE-MERGE-SPECULATIVE.md) · [Truth Market/Quorum/Cartography](docs/FLUXYCHAT-TRUTHMARKET-REHEARSAL-QUORUM-CARTOGRAPHY.md)

### Research Round 3 — sintesi priorità

| Priorità | ID | Feature | Effort |
|----------|-----|---------|--------|
| 🔴 Now | **52** | ✅ Async Decision Quorum — decisioni vincolanti con quorum per ruolo | MVP shipped |
| 🔴 Now | **33** | ✅ Smart catch-up digest — "cosa mi sono perso" rilevanza-based | MVP shipped |
| 🔴 Now | **34** | ✅ Room sentiment dashboard — mood da reazioni + AI | MVP shipped |
| 🔴 Now | **36** | ✅ Passkeys / WebAuthn — login senza password | MVP shipped |
| 🔴 Now | **54** | ✅ SSO/SAML + SCIM per console operatore | MVP shipped |
| 🔴 Now | **58** | ✅ Anti-spam guest/embed — Turnstile + rate limit + `GET /public/guest-hardening` | MVP shipped |
| 🔴 Now | **62** | ✅ Status page Upptime — CI config + `/settings/status`; deploy repo + DNS | MVP shipped |
| 🟡 Moonshot | **32** | ✅ Cross-Org Agent Rooms — negoziazione agenti cross-azienda | MVP pilot |
| 🟡 Next | **44** | ✅ Counterfactual Replay — "cosa sarebbe successo se..." | MVP shipped |
| 🟡 Next | **45** | ✅ Multi-Agent Debate UX — ragionamento visibile in room | MVP shipped |
| 🟡 Next | **48** | ✅ Merge-Conflict UI — risoluzione conflitti CRDT/federazione | MVP shipped |
| 🟡 Next | **49** | ✅ Speculative agent warmup su typing | MVP shipped |
| 🟡 Next | **51** | ✅ Rehearsal Rooms — simulazione controparte | MVP shipped |
| 🟡 Next | **53** | ✅ Chat Cartography — mappa cluster room | MVP shipped |
| 🟡 Next | **38** | ✅ Ambient agents — agenti proattivi event-driven | MVP shipped |
| 🟡 Next | **57** | ✅ Console moderazione completa (coda report) | MVP shipped |
| 🟡 Next | **56** | ✅ Pipeline media (AV + thumbnail + limiti tenant) | MVP shipped |
| 🟡 Next | **59** | ✅ Scheduled send — composer + cron dispatch | MVP shipped |
| 🟡 Next | **60** | ✅ Slash commands — /poll, /remind, /assign + admin registry | MVP shipped |
| 🟡 Next | **61** | ✅ Dashboard utilizzo/costi tenant | MVP shipped |
| 🟢 Later | **50** | ✅ Truth Market — stake su affermazioni verificabili | MVP shipped |
| 🟢 Later | **46** | ✅ Empathy Layer voice — prosody + silent agent adapt | MVP shipped |
| 🟢 Later | **47** | ✅ Room Firmware — builtin hooks + audit (WASM reserved) | MVP shipped |
| 🟢 Later | **55** | ✅ Mobile SDK (wrapper React Native) | MVP shipped |
| ⚠️ Monitor | **28** | WebTransport — non implementare in prod 2026 | — |
| 🟢 Research | **37** | ✅ Local-first eval (ElectricSQL/PowerSync) — stay on Yjs | Research closed |
| 🟢 Research | **25** | AP2/UCP pagamenti agentici | monitoraggio |

### Research Round 4 — Next Wave (NW-100–NW-206)

| Priorità | ID | Feature | Effort |
|----------|-----|---------|--------|
| 🔴 Sprint F | **NW-101** | Live translation toggle UX | S |
| 🔴 Sprint F | **NW-104** | Polls UI end-to-end | S |
| 🔴 Sprint G | **NW-106** | Threads first-class view | M |
| 🔴 Sprint G | **NW-105** | Room info panel | M |
| 🔴 Sprint G | **NW-102** | Message drafts cross-device | M |
| 🔴 Sprint G | **NW-103** | Enhanced mentions | M |
| 🟡 Sprint H | **NW-100** | Offline-first SDK | L |
| 🟡 Sprint I | **NW-200** | Duplex room agent + on-hold | L |
| 🟡 Sprint I | **NW-201** | Decision Rooms™ product pack | M |
| 🟢 Sprint J | **NW-110** | create-fluxy-chat CLI | M |
| 🔴 **Now** | **OC-1 → OC-32** | **One-click full product** — CLI → chat + agent + console in ≤90s; vedi [docs/ONE-CLICK-PRODUCT-ROADMAP.md](docs/ONE-CLICK-PRODUCT-ROADMAP.md) | L |

Tracker completo: [docs/NEXT-WAVE-ROADMAP-2026.md](docs/NEXT-WAVE-ROADMAP-2026.md) · [Docs site](/docs/operations/next-wave-roadmap) · **One-click epic:** [docs/ONE-CLICK-PRODUCT-ROADMAP.md](docs/ONE-CLICK-PRODUCT-ROADMAP.md)

Dettaglio architettura, SQL, guardrail e touchpoint codice: [FEATURE_ROADMAP.md](docs/FEATURE_ROADMAP.md) sezione Research Round 3.

## Implementation Workflow (LEGGERE PRIMA DI OGNI IMPLEMENTAZIONE)

Per ogni punto del roadmap, **seguire sempre questo flusso**:

1. **Ricerca online** — prima cercare best practice, librerie, pattern aggiornati. Capire come fanno gli altri.
2. **Priorità all'analisi già fatta** — le decisioni dell'analisi tecnica (Architectural Decisions Log) hanno precedenza sulle ricerche online.
3. **Implementa** — codice di alta qualità, best practice, pattern del progetto. Usa tool/skills a disposizione.
4. **Test** — verificare che funzioni (build, typecheck, test esistenti).
5. **Docs** — documentare l'implementazione se serve nuove guide.
6. **Integra nelle pagine** — non superficialmente. L'utente deve poter usare e testare la feature. Deve essere figa da vedere. La dashboard è una console dove tutto è connesso.
7. **Landing / marketing** — se la feature merita visibilità, aggiungere sezione animata nella landing o in pagine di marketing.
8. **Collega tutto** — aggiornare nav, breadcrumb, link correlati. Tutto deve essere raggiungibile.

**Golden rule**: ogni implementazione deve dare qualcosa di **usabile e testabile** all'utente finale. Non codice morto.

---

## Stack Infrastrutturale (Zero Budget)

| Servizio | Tool | Costo |
|----------|------|-------|
| Hosting edge | Cloudflare Workers + Pages | $5/mese |
| Database | D1 (SQLite edge) | Incluso Workers |
| Storage | R2 | $0.015/GB, egress gratis |
| Auth | Clerk (free tier 10K MAU) | $0 |
| Email | Resend (3K/mese gratis) | $0 |
| Analytics | PostHog (1M eventi/mese gratis) | $0 |
| Status Page | Uptime Kuma (self-hosted) | $0 |
| Docs | Docusaurus (self-hosted) | $0 |
| Video editing | OBS + DaVinci Resolve | $0 |
| Whiteboard | Excalidraw (MIT) | $0 |
| AI models | Ollama (self-hosted, CPU) | $0 |
| Route optimization | OSRM/Valhalla (self-hosted) | $0 |
| Time-series DB | TimescaleDB (self-hosted) | $5 VPS |
| Search | Meilisearch (self-hosted) o Algolia DocSearch (gratis OSS) | $0 |

### Edge DB Decision Framework

| Use Case | Storage | Perché |
|----------|---------|--------|
| Chat history, CRDT docs, game checkpoints | **D1** (default) | SQL queries, FTS5 search, pagination, 10GB limit |
| Config, session tokens, cache | **KV** | Sub-10ms reads globali, TTL nativo |
| File/asset storage | **R2** | Egress gratis, oggetti grandi |
| Time-series IoT (>1M row/mese) | **TimescaleDB** (self-hosted) | D1 non scala oltre ~10GB |
| External PostgreSQL | **Hyperdrive** | Connection pooling + query caching |

---

## Competitor Analysis: Portal (useportal.co)

Lanciato Maggio 2026, closed source, cloud-only, chat + AI basic.

| Dimensione | Portal | FluxyChat |
|---|---|---|
| License | Closed source, cloud-only | Open source MIT, self-host + edge |
| AI | Chat agent basic | Multi-agent swarm (A2A), voice, generative UI |
| Transport | WebSocket | DO + WebTransport + CRDT + WebRTC |
| Spatial/Voice/IoT | ❌ | ✅ Spatial audio, 3D awareness, voice-first |
| CRDT/Location | -- | CRDT + live location inclusi |

> **Cifratura, per essere precisi.** Non dichiarare E2EE. `packages/sdk/src/group-cipher.ts`
> fa AES-256-GCM reale con derivazione HKDF per epoch, ma la chiave la fornisce
> l'applicazione: è end-to-end **solo** se la distribuisci fuori banda. Il percorso
> `room-e2e` prende la chiave dal server (`lib/room-e2e.js:14`
> `generateRoomContentKeyMaterial`), quindi lì il server può decifrare — si chiama — si chiama
> "content encryption con chiavi gestite dal server", non E2EE. MLS (RFC 9420) non è
> implementato: vedi `ROADMAP_EXECUTION.md` P27-1. Ably vende E2E AES su tutti i piani,
> Free incluso, quindi su questa riga siamo indietro e va detto.

**Strategia**: Competere su open source (costo 1/10) + spatial + AI swarm + piattaforma unificata.
Portal è "Pusher con AI basic" — ignora completamente spatial, voice-first, digital twin, cross-reality.

**Gap closure tracker (Portal parity):** [docs/PORTAL-GAP-CLOSURE.md](docs/PORTAL-GAP-CLOSURE.md) (P0→P3 core) · **[docs/PORTAL-ZERO-BUDGET-ROADMAP.md](docs/PORTAL-ZERO-BUDGET-ROADMAP.md)** (Phase 2 — packaging, OSS integrations, percezione). Aggiornare ad ogni sprint.

### Portal Phase 2 — zero-budget (priorità attuale)

| ID | Task | Status |
|----|------|--------|
| PG-ZB-1 | `create-fluxy-chat` template React chat-only (60s guest mode) | [x] |
| PG-ZB-2 | Bundle benchmark table su `/compare` | [x] |
| PG-ZB-3 | Deploy to Cloudflare button | [x] |
| PG-ZB-4 | Feature parity checklist docs | [x] |
| PG-ZB-6 | MCP server esempi clonabili (`examples/mcp/`) | [x] |
| PG-ZB-7 | mcp-audit CI → D1 → badge marketplace | [x] |
| PG-ZB-8 | `@fluxy-chat/ui` 4 temi Tailwind | [x] |
| PG-ZB-10 | LiveKit self-hosted voice (VPS + Worker JWT) | [x] |
| PG-ZB-11 | Activepieces embed CRM | [x] POC |
| PG-ZB-12 | KMP mobile SDK (RN wrapper ✅ `#55`) | [x] scaffold |

Dettaglio completo: [PORTAL-ZERO-BUDGET-ROADMAP.md](docs/PORTAL-ZERO-BUDGET-ROADMAP.md).

---

## FASE 1 — Foundation (Ora → Mese 1)

### 1.1 Playground pubblico senza signup ✅

| | |
|---|---|
| **Cosa** | `demo.fluxychat.com` — entri, sei in una room con AI agent che risponde. Zero signup. |
| **Architettura** | Pagina Next.js SENZA Clerk middleware. Guest JWT via `GET|POST /demo/session`. Room pre-popolata con messaggi seed + AI agent. Rate-limit via `IpRateLimiterDO`. Probe pubblico `GET /demo/status`. |
| **Codice** | `apps/dashboard/app/demo/page.tsx`, `apps/worker/src/lib/demo-session.js`, `demo-room-seed.js`, `public-http.js` (`/demo/status`, `/demo/session`) |
| **Deploy** | Cloudflare Pages o Vercel Hobby + Worker env: `DEMO_ENABLED`, `DEMO_ROOM_ID`, `DEMO_API_KEY`, Turnstile in prod |
| **Best practice** | Query param `?room=demo` per tracciare sessioni guest. Rate-limitato via Worker DO. |
| **Tool** | `@fluxy-chat/sdk`, `@fluxy-chat/ui` |
| **Effort** | 2 settimane — **shipped 2026-08-03** |

### 1.2 Docs con search ✅

| | |
|---|---|
| **Algolia DocSearch** | `@docsearch/react` + env `NEXT_PUBLIC_ALGOLIA_*` — apply at docsearch.algolia.com for OSS crawler |
| **Fallback locale** | `DocsSearch` + `LocalGuideSearch` su `/guides` e `/docs` — indice client-side da 15+ guide |
| **Codice** | `components/doc-search.tsx`, `local-guide-search.tsx`, `lib/guides-search-index.ts` |
| **Effort** | 1 settimana — **shipped 2026-08-03** (Algolia opzionale in prod) |

### 1.3 Runnable code snippets (StackBlitz) ✅

| | |
|---|---|
| **Cosa** | Tutorial con "Open in StackBlitz" — ambiente pre-configurato con `@fluxy-chat/sdk`. |
| **Codice** | `stackblitz-templates.ts`, `StackBlitzButton`, `/templates/code`, guide marketing con `stackblitzTemplateId` |
| **Template** | `basic-connection`, `react-chat-ui`, `agent-chat` |
| **Docs** | `apps/docs/content/docs/guides/stackblitz-snippets.mdx` |
| **Effort** | 1 settimana — **shipped 2026-08-03** |

### 1.4 Pricing page pubblica

| | |
|---|---|
| **Cosa** | Rendere la pricing page della landing accessibile pubblicamente (non dietro auth Clerk). |
| **Come** | Estrarre da `apps/dashboard/app/landing/` e deployare su `fluxychat.com/pricing` SSR senza Clerk. |
| **Effort** | 3 giorni |

### 1.5 Product Hunt launch

| | |
|---|---|
| **Checklist** | 1. Account PH, upvota 20-30 prodotti. 2. Thumbnail 240x240 GIF, video 30-60s, 5-8 screenshot. 3. Allinea 20-30 supporter. 4. Launch alle 00:01 PT (martedì/giovedì). 5. Rispondi a OGNI commento in <30 min. 6. Post HN + Dev.to coordinati. |
| **Tagline** | "Open-source chat infra on Cloudflare — 10x cheaper than Pusher" |
| **Offerta** | "1 anno gratis hosted tier" per primi 100 upvoter |
| **Tool video** | OBS Studio (screen recording) + DaVinci Resolve (editing) — entrambi gratis |
| **Effort** | 2 settimane prep |

---

## FASE 2 — Developer Experience (Mese 1-2)

### 2.1 Supergroup Sharding

| | |
|---|---|
| **Cosa** | Room 10K+ utenti simultanei. Un DO gestisce ~1.000 req/sec. Per scale superiori: shardare room su più DO coordinati. |
| **Architettura** | `SupergroupRouter DO → RoomDO (N partizioni)`. Router tiene mappa {partitionKey → DO_ID}. Consistent hashing su userId per routing. Broadcast: `fetch()` parallelo a tutte le partizioni (Promise.allSettled + timeout 100ms). Latenza DO→DO: 1-5ms (stesso datacenter). |
| **Pattern** | **DO Fan-Out (raccomandato)** — broadcast via fetch parallelo. NO D1 Pub/Sub (write limit ~1/sec per DO, latenza polling 50-100ms). Ogni partizione = DO con ~1K WebSocket. Router crea nuove partizioni dinamicamente se piene. |
| **Head-of-line blocking** | ✅ Evitato: fetch paralleli con Promise.allSettled + timeout. I fallimenti di una partizione NON bloccano le altre. Sequenziale (for+await) causerebbe 5ms * N partizioni = blocco. |
| **Persistenza** | Broadcast realtime via DO fan-out. History chat persistita su D1 batch ogni 1s (batch insert, non per-message). |
| **Codice già pronto** | `createDurableTransport` (C-1), `createRegionalFailover` (C-6). `RoomDurableObject` da estendere con partizionamento. |
| **Best practice** | Singolo DO ~1.000 req/sec. Shard a 10K users. `storage.setAlarm()` SOLO per heartbeat/cleanup, MAI per realtime. |
| **Effort** | 4-6 settimane |

### 2.2 Flutter SDK su pub.dev

| | |
|---|---|
| **Cosa** | Pubblicare SDK Dart/Flutter su pub.dev. |
| **Architettura** | `FluxyChatClient` con `WebSocketChannel` (package `web_socket_channel`), state management via `ChangeNotifier`/`Riverpod`, retry/backoff, FCM push. Room CRUD via `http` package. |
| **Package Dart** | `web_socket_channel`, `http`, `json_annotation`, `flutter_secure_storage` |
| **Pubblicazione** | `flutter pub publish` |
| **Effort** | 2-3 settimane per MVP (connect, room, message) |

### 2.3 Template gallery agent 1-click

| | |
|---|---|
| **Cosa** | Marketplace nella dashboard dove installi agent template con 1 click. Revenue share: 70% creator, 30% piattaforma via Stripe Connect Standard. |
| **Template iniziali** | customer-support (faq/ticket/escalation), code-reviewer (pr_review/lint/suggest), onboarding (tutorial/guide/help), moderation (toxicity/spam/ban), faq-bot (search/answer/link) |
| **Schema D1** | `agent_templates(id, name, description, skills JSON, config_schema JSON, worker_script TEXT)` |
| **Deploy API** | `POST /api/agent-templates/:id/deploy?roomId=X` → istanzia agente nella room |
| **Codice già pronto** | `createAgentMarketplace` (G-6), `packages/agent/` (SDK agent server-side) |
| **Pattern** | ❌ Cloudflare NON permette creazione runtime di Workers/DO. Usare Worker monolitico → `AgentFactoryDO` → `AgentInstanceDO` con ID deterministico (hash agentType + roomId). Template caricato da KV al primo uso. |
| **Effort** | 2 settimane |

### 2.4 Chat core features (richieste dal mercato)

| Feature | Implementazione | Codice già pronto |
|---------|----------------|-------------------|
| **Threaded replies** | `parent_id` in messaggi D1 + `getThread(threadId)` API | — |
| **Message reactions** | `reactions` JSON column in D1 + `addReaction()` | — |
| **Rich link previews** | OpenGraph scraper via Worker + cache R2 | B-20 `createLinkPreview` |
| **Polls/Voting** | `createPoll()`, `votePoll()` | FluxyChatClient già ha metodi |
| **Message scheduling** | Cron su Worker + D1 query schedulati | — |
| **Pin messages** | `pinned_message_id` in room metadata | — |
| **Full-text search** | D1 FTS5 o Meilisearch | — |
| **Custom status** | `status` field + emoji su user profile | — |
| **Breakout rooms** | Sub-room DO create/destroy dinamici | — |
| **Screen sharing** | WebRTC `getDisplayMedia()` + relay | — |
| **Image upload in chat** | R2 presigned URL upload diretto. Ottimizzazione on-demand: Cloudflare Images solo per thumbnail/preview. Originali serviti da R2 diretto. | `getUploadUrl()` API (da implementare) |
| **Effort** | 2-3 settimane per tutte |

---

## FASE 3 — Espansione Prodotti (Mese 2-4)

### 3.1 FluxyTrack — Location & Fleet Tracking

Mercato: RTLS $49.5B (2026), CAGR 31.1%. Delivery management API $5.23B (2030). Competitor: Onfleet $619/mese, Bringg enterprise, Shipday $39/mese.

#### Feature base (richieste dal mercato)

| Feature | Implementazione | Costo |
|---------|----------------|-------|
| **Real-time GPS tracking** | `useLocation` + WebSocket push in room | $0 |
| **Geofencing** | Haversine algorithm nel SDK + D1 events | $0 |
| **ETA prediction** | Distance/speed formula + ML su dati storici | $0 |
| **Route optimization (multi-stop)** | OSRM/Valhalla API (open source, self-hosted) | $0 |
| **Proof of delivery** | Photo upload R2 + signature canvas | $0 |
| **Driver app** | PWA React/React Native + SDK | $0 |
| **Fleet dashboard** | Pagina `/tracking` in dashboard | $0 |
| **Auto-dispatch** | Nearest driver algorithm | $0 |
| **Customer notifications** | Resend (3K gratis/mese) + push | $0 |
| **Live tracking link** | URL pubblico con mappa embed | $0 |
| **Route history/replay** | D1 query + map timeline playback | $0 |
| **Driver behavior scoring** | Accelerometer + speed data + ML | $0 |

**Algoritmo Haversine (gratis, self-hosted):**
```typescript
const R = 6371;
function haversine(lat1, lon1, lat2, lon2) {
  const dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

**Architettura GPS 10K fleet:**
| Layer | Pattern | Note |
|-------|---------|------|
| **Inserimento** | Worker → `VehicleTracker DO` (1 per veicolo) + `GPSBatcher DO` (bucket 5s) | 10K DO in hibernation (~$50-100/mese). Singolo DO non regge 10K msg/sec. |
| **Aggregazione** | `GPSBatcher DO` batch ogni 5s o 50 posizioni → D1 | Evita D1 write per-message. ~400 writes/sec invece di 10K. |
| **Broadcast mappa** | `GPSBatcher DO` broadcast a subscribers del fleet | Solo posizioni aggregate, non raw. |
| **Storico** | D1 time-series con retention: raw 7gg → aggregated 5min 90gg | Cron esterno per pulizia (NO setAlarm). ~60GB per 7gg retention raw. |

**Schema D1 GPS:**
```sql
CREATE TABLE gps_raw (
  vehicle_id TEXT NOT NULL, fleet_id TEXT NOT NULL, timestamp INTEGER NOT NULL,
  lat REAL NOT NULL, lng REAL NOT NULL, speed REAL, heading REAL,
  PRIMARY KEY (vehicle_id, timestamp)
) WITHOUT ROWID;
CREATE INDEX idx_gps_fleet_time ON gps_raw(fleet_id, timestamp);

CREATE TABLE gps_aggregated_5min (
  fleet_id TEXT NOT NULL, vehicle_id TEXT NOT NULL, bucket INTEGER NOT NULL,
  avg_lat REAL, avg_lng REAL, max_speed REAL, distance_meters REAL, point_count INTEGER,
  PRIMARY KEY (fleet_id, vehicle_id, bucket)
);
CREATE TABLE trips (
  id TEXT PRIMARY KEY, room_id TEXT, status TEXT CHECK(status IN ('pending','active','completed','cancelled')),
  started_at DATETIME, completed_at DATETIME, driver_id TEXT, route JSON
);
CREATE TABLE geofence_events (
  id TEXT PRIMARY KEY, trip_id TEXT, geofence_id TEXT,
  event_type TEXT CHECK(event_type IN ('enter','exit')), occurred_at DATETIME
);
```

#### Feature innovative (nessuno le ha)

| Feature | Descrizione |
|---------|-------------|
| **"Chat + Map" unified** | Chat della consegna è INSIEME alla mappa — cliente vede rider muoversi E chatta nella stessa view |
| **AI Route Copilot** | Agent AI suggerisce route alternative in base a traffico/weather realtime |
| **Predictive delivery window** | ML su dati storici: "Consegna tra 14:30-14:45 con 95% confidenza" |
| **Dynamic pricing delivery** | Prezzo cambia in base a domanda realtime (Uber-style) |
| **Crowdsourced delivery matching** | Matching automatico driver-customer come Uber, ma API-first |
| **AR navigation for drivers** | Overlay AR sulla camera del telefono per indicazioni | 
| **Voice-activated dispatch** | "Hey Fluxy, assegna ordine #123 al driver più vicino" |

**PWA offline driver app:** Y.js + IndexedDB (via `y-indexeddb`) per persistenza offline. Background Sync API per queue GPS updates. CRDT converge automaticamente quando torna online. Service Worker con sync handler.

**Codice già pronto:** `useLocation`, `locationTrack`, `createSpatialCopresence` (C-10), `createGeofence`

**Effort:** 3-4 settimane per MVP

### 3.2 FluxyCollab — Collaboration beyond chat

Mercato: enterprise collaboration $59.67B (2025) → $161B (2034), CAGR 11.7%.

#### Feature base

| Feature | Tool | Licenza | Implementazione |
|---------|------|---------|-----------------|
| **Whiteboard** | Excalidraw | **MIT** (⚠️ NON tldraw — ha cambiato licenza nel 2024, non OSI-approved) | Embed Excalidraw component + sync via CRDT room |
| **Collaborative notes** | Lexical (Meta) | Open source | Y.js + `CollaborationPlugin` + WebSocket provider |
| **Kanban board** | Self-built + @dnd-kit | MIT | Drag & drop + D1 persistence + CRDT sync |
| **Document editor** | Plate/Lexical | MIT | CRDT sync via WebSocket |
| **Spreadsheet** | Luckysheet | MIT | CRDT sync |
| **File manager** | Self-built | — | R2 + D1 metadata per "cartelle" nella room |
| **Calendar** | FullCalendar | MIT | D1 events + scheduling |
| **Meeting summaries** | LLM (Ollama) | Open source | Agent post-meeting analysis |
| **Action items extraction** | LLM parsing | — | Agent analysis della trascrizione |
| **Collaborative cursor + avatar** | Y.js awareness | Open source | Vedi posizione altri utenti in tempo reale |
| **Version history with diff** | Y.js undo/redo | Open source | Git-style diff per documenti |

**⚠️ Attenzione:** tldraw NON è più open source per uso commerciale. Usare **Excalidraw (MIT)**.

**Codice già pronto:** `createCrdt` (C-2) — CRDT document/operation/awareness già implementato. `createDurableTransport` (C-1) per sync.

**E2EE CRDT:** Fase 1: TLS relay (server vede plaintext, come Pusher). Fase 2: Double Ratchet (Signal Protocol) per chat 1:1 e gruppi <50. MLS non production-ready per JS — OpenMLS è proof-of-concept WASM. Vedi Architectural Decisions Log.

**Effort:** 4-6 settimane (whiteboard + notes)

#### Feature innovative

| Feature | Descrizione |
|---------|-------------|
| **"Room as a Project"** | Una room = progetto completo con chat + task + file + calendario + budget |
| **Room as Universe (Spatial Computing)** | Ogni room ha coordinate spaziali (x,y,z). Utenti = avatar in mappa 3D con audio spaziale (proximity chat via Web Audio API + HRTF PannerNode). Posizione influenza visibilità messaggi, permessi, eventi. |
| **Generative UI Room** | AI genera componenti UI interattivi in realtime basati sulla conversazione. "Mostra dashboard vendite" → UI si materializza nella room. |
| **AI meeting assistant** | Bot partecipa alla call, prende appunti, estrae action items, crea task |
| **Generative UI in documents** | AI genera grafici/tabelle/dashboard DENTRO il documento collaborativo |
| **Context-aware search** | Cerca across chat, file, task, calendario con semantic search |
| **Smart notifications** | "Notifica solo se menzionato + AI rileva se è urgente" |
| **Focus mode** | Solo messaggi/task rilevanti filtrati da AI |
| **Embedded code execution** | Esegui Python/JS dentro il documento (Jupyter-style) |
| **Real-time translation** | H-6 già implementato — traduzione simultanea chat |
| **Spatial Whiteboard** | Lavagna 3D/AR invece di 2D. Oggetti posizionati in coordinate room. VR-ready. |

### 3.3 FluxyStream — Live streaming & broadcast

Mercato: interactive streaming $42.36B (2025) → $147.11B (2030), CAGR 28.2%.

#### Feature base

| Feature | Implementazione | Costo |
|---------|----------------|-------|
| **Live video broadcast** | WebRTC → Cloudflare Stream relay → HLS | Cloudflare Stream $1/1000 min |
| **Chat overlay** | FluxyChat room integrata nel player | $0 |
| **Viewer count** | D1 counter + WebSocket broadcast | $0 |
| **AI moderation** | Ollama + AI agent moderation (già avete DLP E-4) | $0 |
| **Polls/quizzes during stream** | `createPoll()` API già esistente | $0 |
| **Tipping/donations** | Stripe integration (già avete) | Stripe fees |
| **Recording + VOD** | Cloudflare Stream recording | Pay-per-use |
| **Multi-camera switching** | WebRTC simulcast | $0 |
| **RTMP ingest** | OBS → RTMP → Cloudflare Stream | $0 |
| **Adaptive bitrate** | HLS multi-resolution | $0 |
| **DVR/rewind live** | HLS DVR | $0 |
| **Analytics (viewership)** | D1 + PostHog | $0 |

**TURN server:** Cloudflare NON offre TURN relay. Usare Metered.ca (~$10-30/mese) per produzione, Coturn self-hosted su VPS $5 per dev. Pattern: Worker genera credenziali TURN ephemeral con TTL 1h.

**Codice già pronto:** `createHuddle` (D-9), WebRTC voice/video room

**Effort:** 6-8 settimane

#### Feature innovative

| Feature | Descrizione |
|---------|-------------|
| **"Stream as a Room"** | Live stream È una room FluxyChat. Spettatori = partecipanti con avatar, possono "alzare mano" per parlare |
| **AI-generated highlights** | Bot che crea clip automatiche dei momenti top (goal, reaction, quote) |
| **Real-time sentiment dashboard** | Per lo streamer: grafico sentiment spettatori in tempo reale |
| **Interactive storytelling** | Spettatori votano e cambiano il corso della narrazione |
| **Virtual gifts with physics** | Regali virtuali che cadono sullo schermo con fisica (TikTok-style) |
| **Multi-angle viewer choice** | Spettatore sceglie l'angolo camera |
| **AI co-host** | Agent AI co-conduce lo stream, risponde a domande, modera |
| **Live commerce integration** | "Compra ora" button sincronizzato con prodotto mostrato |

### 3.4 WebTransport readiness (in attesa)

| | |
|---|---|
| **Stato** | ❌ **Cloudflare Workers NON supporta WebTransport** (issue #6451 aperto, Luglio 2026). Safari 26.4+ e Chrome lo supportano, ma l'infrastruttura edge no. |
| **Implementazione** | Client-side auto-negotiation: prova WT → fallback WS obbligatorio. Quando supportato: Datagrams per unreliable (presence, typing, position), Bidirectional streams per reliable (chat, commands). Per ora, solo WebSocket. |
| **Codice già pronto** | `createWebTransportTransport` (transport registry), `createWebSocketTransport` (C-8). NOTA: `createWebTransportAdapter` (C-5) non utilizzabile fino a supporto CF. |
| **Best practice** | Auto-negotiation client con feature detection. WebSocket performante per MVP. Monitorare cloudflare/workerd#6451. |
| **Effort** | 1 settimana (solo auto-negotiation) |

### 3.5 AI Agent Platform expansion

Mercato: AI agent $40B+, 40% enterprise app avranno AI agent entro fine 2026 (Gartner).

#### Feature base

| Feature | Stato | Implementazione |
|---------|-------|-----------------|
| **No-code agent builder** | ❌ Manca | Visual flow builder nella dashboard |
| **Agent A/B testing** | ❌ Manca | G-12 già implementato, testare prompt diversi |
| **Agent versioning** | ❌ Manca | Git-style per agent configs (D1 + diff) |
| **Agent CI/CD deploy** | ❌ Manca | Deploy agent via API/Git webhook |
| **Agent testing sandbox** | ❌ Manca | F-1 spy adapter già pronto |
| **Agent multi-tenancy** | ❌ Manca | Isolamento per workspace (D1 tenant_id) |
| **Agent cost tracking** | ❌ Manca | LLM token usage per agent (D1 + dashboard) |
| **Agent rate limiting** | ❌ Manca | Prevenire abuse (basato su tier) |
| **Agent performance monitoring** | Parziale | F-3 telemetry già pronta |

#### Feature innovative

| Feature | Descrizione |
|---------|-------------|
| **"Agent Swarm" (A2A protocol)** | Più agenti collaborano su task complesso. Architettura: Agent Bus (DO centralizzato) + A2A protocol (Google) per scoperta/capabilities/delegation. Ogni agent è un DO o Worker indipendente. Communication via WebSocket + DO fetch fan-out. Hierarchical: orchestrator → specialist agents. |
| **Agent marketplace revenue share** | Creatori di agent guadagnano 70% (incentiva ecosistema) |
| **Agent personality designer** | UI per creare personalità (tone, humor, formality) |
| **Agent emotional intelligence** | Rileva emozioni utente e adatta tono (D-6 prosody) |
| **Agent cross-platform memory** | L'agent ricorda su WhatsApp, web, email (unified identity) |
| **Agent code generation + execution** | Genera ed esegue codice in sandbox (Replit-style) |
| **Agent learning from feedback** | Thumbs up/down → RLHF per migliorare continuamente |

---

## FASE 4 — Scale & Monetizzazione (Mese 4-6)

### 4.1 Pricing & Billing definitivo

| | |
|---|---|
| **Cosa** | Implementare tier pricing con Stripe Subscription + feature gating. |
| **Codice già pronto** | `apps/dashboard/app/billing/` — Stripe integration esistente. `QUOTA_MESSAGES_PER_MONTH` nel Worker. |
| **Feature gating lato Worker** | `SELECT subscription_status, plan FROM workspaces WHERE api_key = ?` — check su ogni request |
| **Stripe webhook** | `invoice.paid` → set subscription active. `customer.subscription.deleted` → set cancelled. |
| **Best practice** | Stripe Checkout Sessions API + Webhook. Feature entitlements via Stripe (Product → Features → Entitlements). |
| **Tier** | Free (self-host), Starter $29 (50K msg, 1K agent), Pro $99 (500K msg, 10K agent), Business $299 (2M msg, 50K agent, SSO), Enterprise custom |
| **Effort** | 2-3 settimane |

### 4.2 SOC 2 readiness

| | |
|---|---|
| **Cosa già pronta** | Audit logging (E-3), DLP (E-4), encryption CMK (E-5), data residency (E-6), bot protection (E-9), session replay (E-10). Worker ha HIPAA/GDPR routes. |
| **Da fare** | 1. Policy documentation (security, access, change management). 2. Penetration test con OWASP ZAP (gratis). 3. Audit firm engagement ($15-30K Type I). |
| **Alternative** | Vanta ha free tier per startup OPPURE self-build con checklist open source. |
| **Effort** | 6-9 mesi |

### 4.3 5 video tutorial YouTube

| # | Titolo | Hook | CTA |
|---|--------|------|-----|
| 1 | "Install FluxyChat in 5 Minutes" | "Tired of $500/month chat bills?" | "Star us on GitHub" |
| 2 | "Build a Slack Clone in 10 Minutes" | "Full chat app, zero config" | "Try the demo" |
| 3 | "Add AI Agent to Your Chat" | "One line of code, GPT-4 powered" | "Read the docs" |
| 4 | "Real-Time Location Tracking" | "Track delivery fleets for $5/month" | "Sign up free" |
| 5 | "Deploy to Production" | "Cloudflare Workers, worldwide" | "Get started" |

**Tool:** OBS Studio (recording) + DaVinci Resolve (editing) — entrambi gratis.
**Effort:** 2 settimane

---

## FASE 5 — Nuove Linee di Prodotto (Mese 6+)

### 5.1 FluxyGame — Multiplayer SDK

Mercato: game backend $3.22B (2025) → $6.12B (2034). Competitor: Photon/Nakama $600+/mese.

#### Feature base

| Feature | Implementazione |
|---------|----------------|
| **Matchmaking** | Skill-based + region + latency in DO |
| **Lobby system** | Room pre-game con stati |
| **State sync** | MessagePack (msgpack-lite) + WebSocket direct loop. **MAI usare `setAlarm()` per realtime** — costo $810/DO/giorno a 60fps, latency wake-up 5-50ms. Invece: server tick @20fps (authoritative su DO, driven da input client), client render @60fps (interpolation + prediction via requestAnimationFrame). |
| **Leaderboard** | D1 + Redis/Upstash (free tier) |
| **Player accounts** | Clerk auth |
| **Cloud saves** | D1 + R2 |
| **Anti-cheat** | Server-authoritative su DO (tutte le decisioni su DO, client solo input) |
| **Replay system** | Journal delle mosse in D1 |
| **Spectator mode** | Read-only WebSocket |
| **Voice chat** | WebRTC (huddles D-9 già pronto) |
| **Party system** | Group + invite via room |
| **Tournament brackets** | D1 + bracket elimination logic |

#### Feature innovative

| Feature | Descrizione |
|---------|-------------|
| **"Game room as chat room"** | Gioco e chat sono la stessa room — non serve Discord separato |
| **AI NPCs with memory** | NPC ricordano interazioni passate (GPT + D1 memory) |
| **Procedural content via AI** | Livelli generati dall'AI in base allo stile del giocatore |
| **Dynamic difficulty via AI** | AI adatta difficoltà in base alle performance |
| **Voice-to-action** | "Spawn enemy left" — comandi vocali nel gioco |
| **Cross-game inventory** | Item portabili tra giochi diversi (stesso account Fluxy) |
| **Replay with AI commentary** | AI commenta replay come un caster |

**Effort:** 8-12 settimane

### 5.2 FluxyIoT — MQTT bridge

Mercato: IoT messaging. 18.8B → 40B dispositivi entro 2030.

#### Feature base

| Feature | Implementazione |
|---------|----------------|
| **MQTT-over-WebSocket bridge** | `mqtt` (npm) → Worker → room |
| **Device provisioning** | Certificate + API key per device |
| **Rule engine** | If-this-then-that in DO (condizione → azione) |
| **Time-series storage** | D1 inizialmente, TimescaleDB (self-hosted) per scale |
| **Alerting** | Webhook + email (Resend) + push |
| **Device dashboard** | Pagina `/iot` in dashboard + Grafana (self-hosted) |
| **OTA updates** | R2 firmware storage + device polling |
| **Device shadow** | D1 state replica (stato desiderato vs riportato) |
| **Fleet management** | D1 + dashboard |
| **Geofencing for devices** | `useLocation` per IoT |
| **Predictive maintenance** | ML su time-series (scikit-learn) |
| **Security monitoring** | Anomaly detection su dati sensore |

**Esempio rule engine:**
```typescript
{ id: 'temp-alert', condition: { sensor: 'temperature', operator: '>', value: 30 },
  action: { type: 'alert', target: 'room:alerts', payload: '🔥 High temperature!' } }
```

#### Feature innovative

| Feature | Descrizione |
|---------|-------------|
| **"Device as room member"** | Ogni IoT device è un "utente" nella room. Può "parlare" in chat |
| **AI device doctor** | AI analizza dati dispositivo e diagnostica problemi |
| **Digital twin + real data** | H-5 digital twin si aggiorna in tempo reale dai sensori. Sync: event-based per criticità (allarmi, soglie), batch ogni 5s per telemetria. Conflict resolution: last-write-wins su DO. Device shadow pattern (desired vs reported state). |
| **Voice control for industrial** | "Hey Fluxy, qual è lo stato della pressione?" |
| **AR maintenance overlay** | Tecnico vede istruzioni AR sovrapposte alla macchina (H-5 AR overlay + IoT) |
| **Self-healing devices** | Device si autodiagnostica e richiede parti di ricambio |
| **Carbon footprint tracking** | Monitoraggio emissioni in tempo reale |

**Effort:** 6-8 settimane

### 5.3 Nuovi mercati verticali

> **Stato implementazione (2026-07):** capability kernel + Worker event router (D1 audit), workflow demo per tutti i verticali, studi console interattivi, gruppi nav Build / Products / Operate / Industries / Labs, landing `#platform` + hero room modes, subpath SDK (`@fluxy-chat/sdk/edu` …). Dettaglio: [docs/architecture/vertical-platform-expansion.md](docs/architecture/vertical-platform-expansion.md).

| Vertical | Console | SDK | Readiness |
|----------|---------|-----|-----------|
| FluxyEdu | `/edu` — SFU demo, session report, whiteboard links | `@fluxy-chat/sdk/edu` | Beta (demo) |
| FluxyHealth | `/health` — consent + FHIR context events | `@fluxy-chat/sdk/health` | Preview |
| FluxyEvent | `/events` — tickets + Q&A upvote | `@fluxy-chat/sdk/event` | Beta (demo) |
| FluxyFinance | `/finance` — alerts + invoice approval | `@fluxy-chat/sdk/finance` | Preview |
| Cross-Reality | `/continuity` — checkpoint handoff simulator | `@fluxy-chat/sdk/continuity` | Prototype |

**Prossimo passo produzione:** DO fan-out live, SFU/FHIR/ticketing/market vendor adapters, Yjs snapshot persistence on Worker, compliance gates (BAA/HIPAA, PCI).

#### FluxyHealth — Healthcare

Mercato healthcare digital twin $25B+. Feature: patient monitoring room (vitali realtime), doctor-patient secure chat (E2E HIPAA), telemedicine WebRTC, medical image sharing (DICOM viewer in room), AI symptom checker, care team coordination.

**Compliance:** HIPAA BAA required.

#### FluxyEdu — Education

Feature: virtual classroom (room = classe con lavagna + chat + video), breakout rooms (sub-room DO), quiz/poll realtime (createPoll), attendance tracking, AI grading assistant, whiteboard math (LaTeX), language practice (AI conversation partner), peer review.

**Mercato:** EdTech post-COVID rimasto ibrido.

#### FluxyEvent — Live events & ticketing

Feature: virtual venue (room = venue con stage/backstage/lobby + spatial audio), ticketing verification (anti-scalp), live Q&A with upvote, networking roulette (matchmaking 1:1), virtual booths (sponsor room), live polling, AR wayfinding (H-5).

#### FluxyFinance — Real-time financial data

Feature: real-time price alerts in room, trading signals bot, portfolio sync multi-exchange, risk monitoring (AI-powered), fraud detection chat, payment request in chat, invoice generation (AI), expense tracking.

### 5.4 Cross-Reality Continuity

> **Stato:** simulatore handoff in `/continuity` + checkpoint API client-side. Canonico server-side su DO: vedi [vertical-platform-expansion.md](docs/architecture/vertical-platform-expansion.md).

Feature trasversale che unifica spatial computing + AI swarm + voice-first + digital twin.

| Feature | Descrizione |
|---------|-------------|
| **Stato persistente cross-device** | Room state (chat, position, UI) sincronizzato su VR, mobile, desktop, IoT. Entri in room su VR → esci → continui su mobile dallo stesso punto. |
| **Identità unificata** | Stesso avatar, preferenze, cronologia su qualsiasi device. Auth Clerk + DO state sync. |
| **Adaptive UI per device** | Stessa room renderizzata come 3D world su VR, mappa su mobile, dashboard su desktop. |
| **Voice-first su qualsiasi device** | Comandi vocali funzionano ovunque. AI trascrive e interpreta in tempo reale. |
| **Digital twin always-on** | Twin si aggiorna anche quando nessun umano guarda. Replay storico da D1. |

**Implementazione**: DO come single source of truth per ogni room. State versioning per sync. Client adatta rendering in base al device (feature detection + capability negotiation).

**Effort**: 8-12 settimane (integrato con FluxySpatial + FluxyGame + FluxyIoT)

---

## Riepilogo Timeline

```
Mese 1        Foundation
              ├── Playground pubblico (2 settimane)
              ├── Algolia DocSearch (1 settimana)
              ├── StackBlitz embed (1 settimana)
              ├── Pricing page live (3 giorni)
              └── Product Hunt launch (2 settimane prep)

Mese 1-2      DX & Chat Core
              ├── Supergroup sharding (4-6 settimane)
              ├── Flutter SDK (2-3 settimane)
              ├── Agent template gallery (2 settimane)
              └── Chat core features (2-3 settimane)

Mese 2-4      Prodotti
              ├── FluxyTrack MVP (3-4 settimane)
              ├── FluxyCollab MVP (4-6 settimane)
              ├── FluxyStream MVP (6-8 settimane)
               ├── WebTransport readiness (1 settimana)
              └── AI agent platform (4-6 settimane)

Mese 4-6      Scale
              ├── Pricing & billing (2-3 settimane)
              ├── SOC 2 start (ongoing)
              └── 5 video YouTube (2 settimane)

Mese 6+       Nuove linee
              ├── FluxyGame (8-12 settimane)
              ├── FluxyIoT (6-8 settimane)
              ├── FluxyHealth/FluxyEdu/FluxyEvent/FluxyFinance
              └── Enterprise sales
```

## Metriche Chiave (6 mesi)

| Metrica | Target |
|---------|--------|
| GitHub Stars | 5,000 |
| npm downloads/mese | 10,000 |
| Playground sessioni/giorno | 1,000 |
| MRR | $10,000 |
| Paying customers | 100 |
| Flutter SDK pub.dev | > 90 score |
| SOC 2 Type I | Iniziato |
| YouTube subscribers | 500 |
| Discord members | 5,000 |

## Architectural Decisions Log

Decisioni validate dall'analisi tecnica — consultare PRIMA di implementare ogni feature.

| Decisione | Scelta | Motivazione |
|-----------|--------|-------------|
| **Game loop 60fps** | WebSocket direct + client prediction. NO `setAlarm()`. | Costo $810/DO/giorno con alarm 16ms, latency 5-50ms wake-up. Pattern: server authoritative @20fps, client interpolation @60fps. |
| **Supergroup sharding** | DO Fan-Out (fetch parallelo). NO D1 Pub/Sub. | D1 write limit ~1/sec, polling latenza 50-100ms. DO→DO fetch: 1-5ms, costo $0.15/milione req. |
| **WebTransport** | ❌ NON supportato su Cloudflare Workers (issue #6451). Solo fallback WS. | Browser support sì (Safari 26.4+), edge runtime NO. WebSocket sufficiente per MVP. Riprovare quando CF chiude issue. |
| **A2A Protocol** | Agent Bus DO + DAG cycle detection + circuit breaker. | DO è coordinatore nativo. DAG previene deadlock swarm. Circuit breaker isola agent falliti. |
| **Spatial Audio** | PannerNode nativo <20 utenti, Resonance Audio 20-80, server-side mixing >80. | HRTF browser: ~5-10% CPU per sorgente. Distance culling: solo 16 sorgenti più vicine. |
| **CRDT + E2EE** | Fase 1: TLS relay. Fase 2: Double Ratchet (Signal) per chat <50 utenti. Fase 3: MLS quando maturo. | Nessuna libreria MLS production-ready per JS. OpenMLS (Rust→WASM) è proof-of-concept. |
| **Y.js GC** | Snapshot ogni 1000 ops o 1h → ricrea documento fresco da snapshot. | Y.js non ha GC nativo. Snapshot truncate operation log e previene crescita infinita. |
| **Device Shadow** | DO sync realtime + D1 persistenza. Event-based per critico, batch per telemetria. Vector clock per conflict resolution. | Pattern AWS IoT Device Shadow su Workers. Bilanciamento realtime vs costo. |
| **Edge DB** | D1 default, KV cache, R2 files, TimescaleDB per IoT scale. | Match access pattern: query SQL → D1, read veloce → KV, oggetti → R2, time-series → TimescaleDB. |
| **Agent 1-click deploy** | Worker monolitico + DO factory (`AgentFactoryDO → AgentInstanceDO`). | Cloudflare non permette creazione runtime di Workers. Template da KV con ID deterministico. |
| **Analytics** | PostHog Cloud Free (1M eventi/mese) per MVP. Metriche realtime su DO + D1 a scale. | PostHog gratis sufficiente per ~1000 DAU. Custom DO buffer flush per metriche live. |
| **GPS 10K fleet** | DO per veicolo + GPSBatcher DO (bucket 5s) + D1 time-series. | Singolo DO non regge 10K msg/sec. DO per veicolo = 10K DO in hibernation. Retention: raw 7gg, aggregated 90gg. |
| **TURN server** | Metered.ca (~$10-30/mese) per prod. Coturn self-hosted per dev. | Cloudflare non offre TURN. Twilio troppo caro. Metered.ca è il più economico. |
| **Dashboard hosting** | Cloudflare Pages ($5/mese) per dashboard. | Backend già su Workers. next-on-pages perde ISR ma risparmia $60+/mese vs Vercel. |
| **Marketplace payments** | Stripe Connect Standard (zero costi fissi, 70/30 nativo). | Stripe gestisce KYC. Application fee del 30% con `application_fee_amount`. |
| **PWA offline** | Y.js + IndexedDB (y-indexeddb) + Background Sync API. | Y.js ha supporto nativo offline. CRDT converge automaticamente al reconnect. |
| **File upload** | R2 presigned URL upload diretto. CF Images solo per thumbnail/preview. KV cache per trasformazioni. | R2 è $0.015/GB. CF Images a $0.005/img è caro per chat. On-demand ottimizzazione solo quando serve. |

---

## Costi Totali (Zero Budget)

Al di fuori del Cloudflare Workers Paid ($5/mese), tutti i tool sono **open source, free tier, o self-hosted**. Unico costo reale: SOC 2 audit ($15-30K una tantum, solo quando serve per enterprise).
