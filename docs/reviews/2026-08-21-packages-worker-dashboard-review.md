# Review: packages, Worker, dashboard

**Data:** 2026-08-21  
**Tipo:** review only — nessun codice è stato modificato.  
**Scope:** tutti i package npm in `packages/`, superficie HTTP/WS del Worker (`apps/worker`), console Next.js (`apps/dashboard`).  
**Metodo:** inventario file + lettura di nav, feature flags, auth, dispatch, SDK barrel, readiness, pagine settings/rooms.

---

## 1. Verdetto in una pagina

Il **cuore** (JWT per-project, stanze, WebSocket, `useChat`, CLI hosted/self-host, sidebar filtrata da labs/preview) è credibile e in diversi punti è già stato indurito (SSRF, `/dev/provision` fail-closed, CORS senza `*` di default, rate limit su messaggi/report/MCP).

Il **prodotto** non è “ottimo” come piattaforma unica. È un **monolito di feature** (176 handler HTTP, ~143 `page.tsx` dashboard, SDK barrel da ~6000 righe di export) in cui:

- troppe verticali sono etichettate **production** nell’SDK mentre la console le nasconde come **labs**;
- l’utente nella console **non ha un unico posto** che dica “questo è GA / preview / lab”;
- Settings ha **22 sottopagine** quasi tutte fuori dalla sidebar;
- Rooms è un **dump di pannelli avanzati** (MCP, quorum, knowledge graph, …) sulla stessa schermata del chat operativo.

**Raccomandazione strategica:** congelare le verticali (stream/game/IoT/fleet/edu/health/…) come labs, pubblicare solo il percorso **Projects → Rooms → Agents → Inbox → Webhooks**, e far coincidere `PLATFORM_READINESS`, sidebar e docs.

---

## 2. Inventario

| Superficie | Quantità (ordine di grandezza) | Note |
|---|---|---|
| Package in `packages/` | 11 | sdk, react, ui, ui-kit, protocol, agent, config, create-fluxy-chat, vue, svelte, react-native-sdk |
| Handler `*-http.js` | ~176 | più `worker.js` + `lib/worker-route-dispatch.js` |
| Pagine dashboard `page.tsx` | ~143 | mix marketing + console + guide SEO |
| Item sidebar (tutti i flag on) | ~70 | molti filtrati se labs/preview = off |
| Sottopagine `/settings/*` | 22 | quasi tutte **non** in sidebar |
| Migrazioni D1 | 100+ | indici presenti su molti moduli nuovi |

**Package e versioni (repo, 2026-08-21):**

| Package | Versione repo | Ruolo | Stato npm (contesto noto) |
|---|---|---|---|
| `@fluxy-chat/sdk` | 0.6.2 | Client TS: WS, REST, hook, verticali | Allineato |
| `@fluxy-chat/protocol` | 0.1.3 | Tipi evento WS + validator | Allineato |
| `@fluxy-chat/react` | **0.1.2** | Re-export hook da SDK | npm spesso **0.1.1** (SDK nidificato 0.6.0 incompleto) |
| `@fluxy-chat/ui` | **0.1.4** | Primitive chat (Radix/shadcn) | npm spesso **0.1.3** |
| `@fluxy-chat/ui-kit` | 0.1.0 | Widget drop-in | Peer su react `^0.1.1` |
| `@fluxy-chat/agent` | 0.2.1 | Bot server-side | — |
| `@fluxy-chat/config` | 0.1.1 | `fluxy.config.ts` | — |
| `@fluxy-chat/create-fluxy-chat` | **0.5.9** | Scaffold | npm spesso **0.5.6–0.5.8** |
| `@fluxy-chat/vue` | 0.1.0 | Composable | **non pubblicato** (o non nel flusso CLI) |
| `@fluxy-chat/svelte` | 0.1.0 | Store Svelte 5 | **non pubblicato** |
| `@fluxy-chat/react-native-sdk` | 1.1.1 | RN + protocol | non nel CLI `--full` |

Native (Kotlin/Swift/Flutter/Unity/.NET): fuori da npm; non nel percorso “npx”.

---

## 3. Packages — qualità, perf, sicurezza, tool

### 3.1 `@fluxy-chat/sdk` (0.6.2) — cuore e collo di bottiglia

**Cosa funziona**

- `FluxyRealtimeProvider` con `workerUrl` + `authTokenProvider` (stringa o callback) è l’API giusta.
- Peer opzionali `react` / `zustand`: il core può vivere senza React.
- Export per verticale (`./edu`, `./health`, …) e `./testing`, `./worker-runtime`.
- `partysocket` per reconnect; protocol condiviso.

**Problemi**

| Sev | Finding | Dettaglio |
|---|---|---|
| **High** | Barrel `src/index.ts` enorme (~6000+ righe di export) | Chi fa `import { FluxyChatClient } from "@fluxy-chat/sdk"` rischia tree-shaking fragile. Le verticali dovrebbero stare **solo** nei subpath, non anche nel main. |
| **High** | `PLATFORM_READINESS` marca collab/stream/game/IoT/fleet/spatial/edu/health/event/finance/continuity come **`production`** | In dashboard quelle route sono **labs** (`DASHBOARD_LAB_HREFS`). Bug di prodotto: SDK e console si contraddicono. File: `packages/sdk/src/readiness.ts` vs `apps/dashboard/lib/dashboard-feature-flags.ts`. |
| **Medium** | Hook React **dentro** l’SDK (`use-chat.ts`, `realtime-provider.tsx`) | `@fluxy-chat/react` è un re-export “transitional split”. Due package da pubblicare in lockstep; i clienti importano da uno o dall’altro a caso. |
| **Medium** | Dipendenze markdown (`remark`, `unified`, `mdast`, `remend`) nel package client | Peso bundle per chi vuole solo `connectRoom`. Meglio `./markdown` opzionale. |
| **Medium** | `yjs` nel SDK principale | Ha senso per collab; non per chat-only. Stesso discorso: subpath. |
| **Low** | Peer `sdk ^0.6.0` su vue/svelte | Permette l’SDK 0.6.0 incompleto (stesso incidente di react 0.1.1). |

**Tool migliori**

- Split reale: `@fluxy-chat/sdk/core` + `@fluxy-chat/sdk/react` **oppure** spostare tutti gli hook solo in `@fluxy-chat/react` e togliere React dall’sdk.
- Analisi bundle: `vite-plugin-dts` già c’è via tsc; aggiungere `publint` + `attw` (già avete `verify-publish-manifest.mjs` — estenderlo).
- Validazione payload WS: oggi `protocol` controlla soprattutto il **type**; schema per-evento (Zod o TypeBox) ridurrebbe drift Worker↔SDK.

### 3.2 `@fluxy-chat/react` (0.1.2)

**Cosa funziona:** API unica per provider/hook; peer `@fluxy-chat/sdk ^0.6.2`.

**Problemi**

| Sev | Finding |
|---|---|
| **Critical (ops)** | npm 0.1.1 tira SDK 0.6.0 nidificato incompleto → Vite rotto. Mitigazione attuale: hoist in template `full`. Serve **publish 0.1.2** prima del CLI. |
| **Medium** | Zero test nel package react (i test stanno nell’sdk). Un breaking change sul re-export non si vede. |
| **Low** | `ui-kit` peer ancora `react ^0.1.1`. |

### 3.3 `@fluxy-chat/ui` (0.1.4) e `ui-kit` (0.1.0)

**Cosa funziona:** primitive shadcn/Radix, Storybook, vitest, `sideEffects: false`.

**Problemi**

| Sev | Finding |
|---|---|
| **Medium** | Dipendenza `@shadcn/react` (`message-scroller`) **e** reimplementazione locale. Due fonti di verità; lockfile/versioni da monitorare. File: `packages/ui/src/primitives/message-scroller.tsx`. |
| **Medium** | Peer pesanti (`radix-ui`, `lucide-react`) duplicati come dependencies. Chi usa il template full reinstalla due volte. |
| **Low** | `ui-kit` opzionale `@assistant-ui/react` — buono; documentare che non è nel path `--full`. |

### 3.4 `@fluxy-chat/protocol` (0.1.3)

**Cosa funziona:** elenco eventi inbound/outbound, `isFluxyInboundEvent`. Unico contratto WS condiviso.

**Gap:** validazione **strutturale** per evento (campi obbligatori, size). Oggi è “il type è nella allowlist”. Per sicurezza e versioning protocol è insufficiente su payload grandi (collab, IoT, game ticks).

### 3.5 `@fluxy-chat/agent` (0.2.1)

SDK bot server-side sopra lo stesso SDK. Rischio: importare il client browser (markdown, yjs) in un Worker bot. Va verificato il tree-shake in wrangler. Preferibile dipendere da un `@fluxy-chat/sdk/core` futuro.

### 3.6 `@fluxy-chat/config` (0.1.1)

Nicchia utile (`fluxy.config.ts`). Poco visibile in dashboard/CLI full. Non è un problema di qualità, è un problema di **discoverability**.

### 3.7 Vue / Svelte 0.1.0

Parity dichiarata con react, **non nel CLI**, peer SDK `^0.6.0` (stesso buco 0.6.0). Non venderli come “supported” finché non c’è publish + e2e.

### 3.8 `react-native-sdk` 1.1.1

Dipende da **protocol**, non dall’sdk web. Divergenza API vs `useChat` web. Accettabile se documentato; oggi il newcomer JS non deve inciamparci nella console.

### 3.9 `create-fluxy-chat` 0.5.9 (repo)

Miglioramenti recenti (self-host prompts, `worker.dev.vars`) sono giusti. Finché npm è indietro, **ogni review “customer” è menzognera**. Publish con `pnpm publish` + OTP, ordine: react 0.1.2 → ui 0.1.4 se serve → create-fluxy-chat 0.5.9.

---

## 4. Worker — architettura, perf, sicurezza

### 4.1 Forma del codice

- **JS** per quasi tutte le route (`*-http.js`), con isole **TS** (`url-ssrf.ts`). Mix che complica typecheck CI.
- `pickRouteDeps` è una buona pratica (niente god-object implicito… ma `worker.js` costruisce comunque un **routeDeps** enorme ~80 campi).
- Dispatch **sequenziale** in `lib/worker-route-dispatch.js` (generato da `scripts/generate-route-dispatch.mjs`): ogni request prova decine/centinaia di `dispatchX` finché uno non matcha.

| Sev | Finding | Perché conta |
|---|---|---|
| **High** | Dispatch a catena O(n) handler | Latenza e CPU su ogni REST call, peggio sul cold start. Un trie/prefix map (`/rooms` → modulo rooms) è lo standard Workers. |
| **High** | Superficie 176 file route | Authz inconsistente è **statistica**, non teorica: un handler nuovo può dimenticare `hasAnyRole`. Non c’è un middleware unico “requireJwt({ roles })” obbligatorio. |
| **Medium** | Worker ancora JS | Nessun typecheck sulle route. Errori `auth` null vs Response thrown si ripetono (`catch` diversi per file). |
| **Medium** | `REQUIRE_ADMIN_AUTH !== "false"` | Fail-open se qualcuno setta `"false"` in prod. Documentato; pericoloso. |
| **Low** | Commento in `dev-provision-http.js` vs implementazione | Il file dice “NODE_ENV !== production”; il codice è **allowlist** `development\|test`. Il commento in testa a `worker.js` è ancora il denylist. Drift docs interno. |

### 4.2 Sicurezza — cosa è già buono

- `/dev/provision`: `ALLOW_DEV_PROVISION=true` **e** `NODE_ENV` in `{development, test}`. Body JSON non vuoto → 400.
- `ALLOW_LEGACY_DEFAULT_PROJECT` default off (audit S-14).
- CORS: `ALLOWED_ORIGINS=*` solo opt-in esplicito (`custom-domains.js`).
- JWT firmato con `jwt_secret` **per project** in D1, non un env globale unico (rotation via `JWT_SECRET_PREVIOUS`).
- Hash API key + `API_KEY_HASH_SALT`.
- Webhook: HMAC, encryption at rest, SSRF su URL (`url-ssrf.ts`, `webhook-delivery.js`).
- Agent tools: block SSRF (`tool_execute_url_blocked_ssrf`).
- Rate limit: messaggi, report, MCP, SMS OTP, WS nel Room DO, thread summary.
- `TRUST_FORWARDED_FOR` default off (spoof XFF).
- Audit log su molte azioni admin.

### 4.3 Sicurezza — gap

| Sev | Finding | File / area |
|---|---|---|
| **High** | Nessun validator schema (Zod/Valibot) sulle route | Body parse `request.json().catch(() => null)` ovunque. Campi extra, tipi sbagliati, DoS JSON grandi. |
| **High** | Guest / public room + embed | `PUBLIC_GUEST_ALLOWED_ORIGINS` / `DEMO_ALLOWED_ORIGINS` — se misconfigurati, playground = superficie abusabile. Da trattare come prod-sensitive. |
| **Medium** | OG preview / fetch URL | C’è `url-fetch-audit` + `validateUrl`; va verificato che **tutti** i fetch (non solo agent/webhook) passino `safeOutboundFetch`. |
| **Medium** | Quota vs rate limit | Quota progetto e rate IP/user non sono lo stesso. Un JWT valido può comunque martellare D1 su list unbounded. |
| **Medium** | PII verso LLM | Flag `AGENT_TOOL_ALLOWLIST`, redaction in dashboard middleware — non è garantito su ogni path agent. Tenant opt-out regionale: da confermare per-request. |
| **Low** | `timingSafeEqual` usato (bene) | Assicurarsi che tutte le compare di secret/HMAC ci passino, non `===` su stringhe. |

### 4.4 Performance Worker / DO / D1

| Sev | Finding |
|---|---|
| **High** | Dispatch sequenziale (sopra). |
| **Medium** | Fan-out stanza: DO unico per room è il modello giusto; verticali (game ticks, IoT readings, fleet GPS) sullo **stesso** DO della chat possono starvare i messaggi. Isolare DO per verticale o code. |
| **Medium** | List unbounded: molte GET accettano `limit` con default 50, non tutte. Export GDPR/e-discovery devono essere streaming, non un JSON gigante in memoria. |
| **Medium** | Indici: le migrazioni recenti li hanno; le query vecchie su `messages(room_id, created_at)` vanno periodicamente `EXPLAIN`. |
| **Low** | Cold start: import di **tutti** i moduli dispatch all’avvio del Worker. Un router lazy (dynamic import per prefix) taglia CPU di init. |

### 4.5 Completezza feature vs “production”

Il Worker **ha** HTTP per auction, truth-market, cartography, hipaa, web3, driver, A2A, debate, rehearsal, ambient, digital twin, empathy, firmware, …  
Questo non significa che siano GA. Molti sono CRUD + un evento WS.

**Allineare:**

1. Catalogo interno: GA / preview / labs / frozen.
2. `PLATFORM_READINESS` deve usare le stesse etichette.
3. Dashboard labs flag deve matchare (oggi matcha solo la **nav**, non l’SDK).

Verticali **core GA** da trattare come tali: projects, rooms, messages, members, inbox, agents (invoke + tools allowlist), webhooks, auth/token, presence/typing se testati e2e.

### 4.6 Osservabilità

- `traceId`, `logError`, `incrementOperationalMetric`, OTel route (`otel-http.js`), agent eval export.
- Non c’è evidenza di uno **SLO unico** per WS connect success / message p99 su tutte le verticali.
- Dashboard ha `SloOverviewCard` + `WorkerHealthCard` — buono se i numeri arrivano dal Worker; da non lasciare come placeholder.

### 4.7 Tool Worker consigliati

- Migrare route a **TypeScript** + Hono o `itty-router` (match O(path), middleware JWT).
- **Zod** (o TypeBox) per body; generare OpenAPI dallo stesso schema (il sito docs API oggi è un altro albero).
- Test: avete molti `*.test.js` — ottimo. Manca una **matrice auth**: ogni `dispatch*` deve avere almeno un 401 senza JWT e un 403 ruolo sbagliato.
- Wrangler: `compatibility_date = 2026-03-24` è recente (bene). Tenere DO hibernation + websocket espliciti nei test (`room-do.test.js` già tocca rate WS).

---

## 5. Dashboard — IA, integrazione, “dove sono?”

### 5.1 Cosa è già strutturato bene

- Chrome unico: sidebar, mobile nav, command palette, skip-link, `ConsoleAuthGate`, `QuickstartGate`.
- `ConsolePageHeader` con breadcrumb **Console → gruppo → pagina** (`console-page-header.tsx` + `resolveConsoleNavContext`).
- Feature flags: labs/preview **default off** (`NEXT_PUBLIC_DASHBOARD_LABS` / `_PREVIEW`). Allineato alla honesty recente.
- Overview (`app/dashboard/page.tsx`) filtra shortcut labs; checklist onboarding; health/SLO cards.
- Sidebar raggruppa Build / Operate / Platform / AI tools / Industries; active state; lock finché quickstart incompleto.
- Session: `useDashboardSession` con project attivo in storage scoped.

### 5.2 Mappa nav vs realtà

**Build / Core (GA percepito)**  
Overview, Quickstart, Projects, Rooms, Inbox, Threads, Profile.

**Agents**  
Hub è GA. Platform / A2A / cross-org / debate / rehearsal / ambient sono **preview** (flag). Observability + eval restano visibili anche senza preview → l’utente “GA” vede comunque profondità agent da prodotto grande.

**Connect**  
Knowledge, customers, integrations, bridges: plausibili per un prodotto chat.  
**Voice AI** e **Huddles** sono in `DASHBOARD_LAB_HREFS` ma anche in Connect — con labs off spariscono (corretto). Con labs on, Connect diventa un mix GA+demo.

**Operate**  
Webhooks, settings, notifications, activity, agent-queue, automations, analytics, billing, admin: il set “operatore” giusto.

**Trust**  
Moderation, AI governance, EU AI Act, SOC2, privacy, e-discovery, security, status: molto enterprise. Rischio: empty/stub percepito se il Worker non è configurato (HIPAA, CMK, …).

**Tools**  
Features hub, realtime demos, DevTools, middleware, card builder, CLI, domains, embed, templates, search: mix developer + prodotto.  
**Cartography** e **Truth Market** sono labs ma stanno nel gruppo Tools, non Platform — **IA incoerente**.

**Platform + Industries**  
Tutto labs/preview. Con flag on, ~20 voci extra. L’utente non sa che è un “studio verticale”.

### 5.3 Pagine orfane / semi-orfane (non in sidebar)

Esempi (non esaustivo):

| Area | Route | Problema |
|---|---|---|
| Settings | `/settings/media`, `e2e`, `dlp`, `hipaa`, `mcp`, `telephony`, `firmware`, `residency`, `crm`, `consent`, `ephemeral`, `commands`, `push`, `search`, `usage`, `integrations`, `agent-tools`, `translation`, `support` | 22 pagine. Solo `/settings` e `/settings/status` in nav. Chi atterra da un link interno **non ha gerarchia visibile** oltre al breadcrumb se il path non matcha un href nav (`/settings/hipaa` matcha `/settings` via `startsWith` — il titolo breadcrumb diventa “Settings”, non “HIPAA”). |
| Agents | `/agents/[id]`, `.../edit`, `.../chat`, `/agents/llm-keys` | Contesto agent nella **seconda** sidebar (`agents-sidebar`), non nel breadcrumb globale. Due modelli di orientamento. |
| Stream | `/stream/[eventId]`, `.../broadcast` | Breadcrumb può restare “FluxyStream” — OK; manca “evento X”. |
| Users | `/users/[id]` | Poco scoperto dalla nav principale. |
| Marketplace | `/marketplace/templates/[slug]` | Preview. |
| Guide SEO | `/guides/*` | Marketing, non console — `isConsoleRoute` deve escluderle (verificare che non finiscano nello chrome console). |
| SOC2 | `/soc2/audit-chain` | Sotto Trust ma non item dedicato. |

### 5.4 “Sappiamo sempre dove siamo?” — no, non alla perfezione

| Criterio | Stato |
|---|---|
| Nome pagina (h1) | Quasi ovunque `ConsolePageHeader` — **buono**. Alcune pagine lunghe (rooms, settings) mescolano troppi h2. |
| Breadcrumb gruppo | Funziona solo se l’href è in `CONSOLE_NAV_GROUPS` **dopo il filtro flag**. Con labs off, `/collab` visitabile via URL diretta: breadcrumb fallback “Console → titolo”. La pagina **esiste comunque** (il flag nasconde la nav, non la route). **High IA:** deep-link labs senza badge “Labs”. |
| Progetto attivo | In session; non è ripetuto in ogni header. L’utente cambia progetto e resta su Fleet/IoT senza un chip “Project: X” fisso. **High** per multi-tenant. |
| Stanza attiva | Rooms è una pagina mostro (~700+ righe) con decine di pannelli (offline notify, MCP, presence escalation, role visibility, quorum, external events, asymmetry, audience score, memory, knowledge graph, approval chain). Non è “una stanza”: è un **laboratorio**. L’utente non sa cosa è core. |
| Quickstart lock | Sidebar locked — chiaro. Dopo il lock, 70 voci. |
| Command palette | Ripete la nav filtrata + actions. Non spiega GA vs lab. |
| Readiness badge | Overview lista industry readiness dall’SDK (`production`) — **contraddice** i flag labs. |

### 5.5 Integrazione: usiamo tutte le feature Worker?

**Sì, troppe.** Quasi ogni `*-http.js` ha o una pagina o un pannello innestato in Rooms/Settings.

Questo è il problema opposto all’incompletezza: **over-wiring**.

| Worker / SDK | Dashboard | Giudizio |
|---|---|---|
| Rooms, messages, JWT, agents, inbox | Pagine dedicate | Integrato, percorso chiaro |
| Webhooks, billing, GDPR, moderation | Pagine Trust/Operate | Integrato |
| Collab, stream, game, IoT, fleet, spatial | Pagine Platform (labs) | Integrato **come demo**, etichettato production nell’SDK |
| Room memory, KG, quorum, firmware, empathy | Pannelli **dentro Rooms** | Integrato male: rumore sul gold path |
| Settings DLP, HIPAA, CMK, residency | Sottopagine settings | Esistono; non navigabili |
| Vue/Svelte/RN | Assenti in console | Corretto; non prometterli nel CLI page |
| `fluxy.config.ts` / `@fluxy-chat/config` | Quasi invisibile | Sottousato |
| Native SDKs | Guide isolate | OK |

### 5.6 Coerenza UX tecnica

| Sev | Finding |
|---|---|
| **Medium** | Quasi tutto `"use client"`. Poco RSC. Bundle console grande; LCP della sidebar. |
| **Medium** | `dashboardFeatureFlags` valutato a init modulo (`console-nav.ts` importa il const). Con Next, `NEXT_PUBLIC_*` è bake-time — OK. Non cambiare flag a runtime senza rebuild. |
| **Medium** | Interfacce `ConsoleNavGroup` **dichiarate due volte** in `console-nav.ts` (duplicato). Sintomo di crescita caotica. |
| **Medium** | `dangerouslySetInnerHTML` in `components/chat/fluxychat.tsx` (snippet search) e `collab-document.tsx`. Search ha un componente che **evita** innerHTML (`search-snippet.tsx`) — il chat principale no. XSS se lo snippet non è sanitizzato. |
| **Low** | Settings page mescola profilo Clerk, status emoji, e `createComposableUIKit` / translation dal **SDK** — settings “prodotto” vs “SDK playground”. |
| **Low** | `HOSTED_PATHS.console` vs `/dashboard` vs `/` — tre “home” possibili (marketing, get-started, overview). Onboarding aiuta, ma il bookmark “/” non è la console. |

### 5.7 Come dovrebbe essere l’IA (target, non implementato)

Livello 0 — **sempre visibile:** progetto attivo, ambiente (hosted vs self-host Worker URL), stato WS.

Livello 1 — **Build:** Overview, Projects, Rooms (chat only), Agents hub, Inbox.

Livello 2 — **Operate:** Webhooks, Members/admin, Analytics, Billing, Moderation.

Livello 3 — **Developers:** API keys, CLI, Embed, DevTools, Middleware.

Livello 4 — **Trust:** Privacy, Security checklist, SSO/passkeys (identity è già in settings).

Livello 5 — **Labs:** un unico item “Labs” che apre un catalogo con badge, non 20 foglie in sidebar.

Rooms: tab **Chat | Members | Automations | Advanced**. Advanced = MCP, KG, quorum, ecc.

Settings: **indice** con gruppi (Identity, Data, Compliance, Channels, AI) che lista le 22 pagine.

---

## 6. Sicurezza cross-cutting (dashboard + client)

| Sev | Finding |
|---|---|
| **High** | JWT member in `localStorage` / `.env` Vite (`VITE_FLUXYCHAT_MEMBER_JWT`) nel template. Normale per demo; per SaaS: cookie httpOnly o `connectUrl` (già nel provider). La console usa Clerk + JWT worker: due identità da non confondere. |
| **Medium** | XSS snippet/HTML (sopra). |
| **Medium** | Pagine labs raggiungibili senza flag: **auth** c’è, **posizionamento** no. Non è un bypass auth, è un bypass “honesty”. |
| **Low** | Guide `/guides/*` pubbliche: non devono leakare `fc_` keys di esempio reali. |

---

## 7. Performance cross-cutting

| Area | Issue | Direzione |
|---|---|---|
| SDK | Barrel + remark + yjs | Subpath / optional deps |
| Worker | Sequential dispatch + eager import | Router per prefix + lazy |
| Dashboard | 70 nav item + client ovunque | Nav ridotta; dynamic import labs |
| Rooms page | N pannelli = N fetch all’open | Tab + lazy panel |
| Liste messaggi | Virtualizzazione: `message-scroller` c’è | Usarlo ovunque (rooms + template) |
| npm | Versioni sfasate | Publish lockstep + overrides documentati |

---

## 8. Tooling / stack — “tool migliori”

Già in casa e da tenere: pnpm workspaces, Vitest, Wrangler, Clerk, D1, DO, Fumadocs, Tailwind, Radix.

**Da introdurre o usare di più (senza riscrivere il mondo):**

| Bisogno | Tool | Perché |
|---|---|---|
| HTTP Worker | Hono o itty-router | Middleware JWT, routing O(path), OpenAPI |
| Validazione | Zod (già in regole repo, **assente nel worker**) | Unico schema REST + docs |
| Bundle SDK | `publint`, size-limit, export `./core` | Evitare 0.6.0-gate |
| Console | Un `ProjectSwitcher` sticky + badge Labs | Orientamento |
| Qualità route | Generatore test 401/403 da lista dispatch | Copertura auth |
| Osservabilità | Un dashboard SLO su connect/send, non solo card | Allineare `SloOverviewCard` a dati veri |
| UI HTML | DOMPurify / lo stesso sanitizer di `search-snippet` | Chat + collab |
| TS Worker | Migrazione incrementale `routes/*.ts` | Come `url-ssrf.ts` |

Non serve un secondo framework dashboard. Serve **meno superficie visibile**.

---

## 9. Backlog priorizzato (solo consiglio)

### P0 — verità del prodotto

1. Pubblicare react 0.1.2 e create-fluxy-chat 0.5.9 (`pnpm publish`).
2. Allineare `PLATFORM_READINESS` a labs/preview/GA (oggi è quasi tutto `production`).
3. Badge “Labs” sulle route labs anche se aperte da URL.
4. Project chip globale nella chrome.

### P1 — sicurezza e robustezza

5. Zod (o equivalente) su POST caldi: `/auth/token`, `/rooms`, `/messages`, agent invoke, webhooks.
6. Audit `safeOutboundFetch` su ogni fetch uscente.
7. Sanitizzare HTML chat/collab/search.
8. Matrice test 401/403 per dispatch.

### P2 — performance

9. Router Worker per prefisso.
10. Split SDK core vs markdown/yjs/verticals.
11. Rooms a tab + lazy.

### P3 — IA console

12. Settings index (22 link).
13. Un solo ingresso Labs.
14. Spostare cartography/truth-market da Tools a Labs.
15. Observability/eval agent dietro preview **oppure** documentarli come GA.

### P4 — package minori

16. Non promettere vue/svelte finché non pubblicati.
17. Peer SDK `^0.6.2` ovunque.
18. Rimuovere duplicato tipi in `console-nav.ts` (quando si toccherà il file).

---

## 10. Cosa è già “ottimo” (da non buttare)

- Modello **Worker + DO + JWT per stanza** è coerente con Cloudflare.
- Fail-closed su provision, legacy default project, CORS `*`, XFF.
- SSRF dedicato (`url-ssrf.ts`) su webhook e tool agent.
- Dashboard chrome (palette, skip link, quickstart lock, header+breadcrumb) è un sistema, non pagine sparse.
- Flag labs/preview default **off** dopo la correzione honesty.
- Protocol package come allowlist eventi.
- Script docs link checker (0 broken `/docs/` al 2026-08-21).
- CLI self-host che scrive env invece di “apri il file a mano”.

---

## 11. Conclusione

Non è codice “scarso”. È **troppo prodotto in un solo binario e in una sola sidebar**.

La qualità del gold path (auth, rooms, messages, agents, CLI) è alta.  
La qualità percepita dell’applicativo intero è bassa perché l’utente atterra in un hangar di prototipi etichettati production.

Finché SDK, Worker e dashboard non condividono **lo stesso catalogo di readiness**, non si può dire che “usiamo tutte le funzionalità” in modo integrato: le usiamo tutte, ma **nello stesso piano**, e l’utente non sa a che piano è.
)
