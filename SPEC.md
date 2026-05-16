# Fluxychat — Product Specification v3.0

> **One-liner:** La chat real-time più economica del mercato per prodotti SaaS — WebSocket serverless, self-serve, senza DevOps.

---

## 1. Posizionamento

### Il problema

Aggiungere chat real-time a un prodotto SaaS è ancora inutilmente costoso e complesso:

- **Pusher / Ably** costano $49–$299/mese anche per volumi modesti, con pricing opaco.
- **Sendbird / Stream** sono orientati all'enterprise — sales-driven, niente self-serve.
- **Firebase / Supabase** ti obbligano a spostare il DB da loro.
- **Farlo da soli** richiede di gestire WebSocket stateful su serverless, che Vercel e Netlify non supportano bene.

### La soluzione

Fluxychat è una piattaforma SaaS + SDK che ti dà chat real-time production-ready in meno di un'ora, a una frazione del costo dei competitor.

| | Fluxychat | Pusher | Sendbird |
|---|---|---|---|
| WebSocket serverless | ✅ | ✅ | ❌ |
| Chat primitives (rooms, DM, reactions…) | ✅ | ❌ | ✅ |
| Self-serve + pricing chiaro | ✅ | ✅ | ❌ |
| Free tier generoso | ✅ | ❌ | ❌ |
| AI agent contestuale | ✅ (Starter+) | ❌ | ❌ |
| Prezzo entry | **£0** | $49/mese | "Parla con sales" |

### Differenziatore principale

**Il prezzo.** £1 per 1 milione di messaggi. Free tier da 50k messaggi/mese. Nessun lock-in su DB o stack. Funziona con qualsiasi backend — Next.js, Express, Laravel, qualsiasi cosa.

L'AI è disponibile nei piani a pagamento come upgrade naturale, non come requisito per iniziare.

---

## 2. Target

### Cliente primario (oggi)

Indie developer e startup che costruiscono prodotti SaaS su stack moderni (Next.js, Vercel, TypeScript) e devono aggiungere chat senza diventare esperti di WebSocket e senza spendere centinaia di euro al mese.

**Profilo tipico:**
- Team 1–10 persone
- Stack: Next.js / Vercel, TypeScript, Prisma o Supabase per il DB principale
- Problema sentito: *"Voglio aggiungere chat al mio SaaS. Pusher costa troppo e Firebase mi obbliga a cambiare tutto."*
- Canali: Twitter/X dev community, Hacker News, Product Hunt, SEO tecnico

### Cliente secondario (6–18 mesi)

Team di prodotto in aziende mid-market che vogliono sostituire soluzioni legacy o aggiungere comunicazione real-time ai loro tool interni, con budget e requisiti più strutturati.

---

## 3. Architettura

### Stack tecnico

| Layer | Tecnologia | Ruolo |
|---|---|---|
| Edge runtime | Cloudflare Workers | Entrypoint HTTP + WebSocket |
| Stato real-time | Cloudflare Durable Objects | RoomDurableObject per ogni room |
| Database primario | Cloudflare D1 (SQLite edge) | Messaggi, rooms, membri, moderation |
| Cache / sessioni | Cloudflare KV | Rate limiting, presenza aggregata |
| File storage | Cloudflare R2 | Allegati e media |
| AI routing | Worker dedicato | Riceve eventi, chiama LLM, posta risposte |
| Dashboard | Next.js 16 (App Router) | Admin, analytics, configurazione |
| SDK client | TypeScript | `useChat()` hook + client REST tipizzato |

### Perché Cloudflare

- Durable Objects risolvono nativamente il problema WebSocket su serverless — niente Terraform, niente DevOps.
- Costo infrastrutturale bassissimo → permette il pricing aggressivo che è il cuore del posizionamento.
- Edge globale → latenza bassa ovunque senza configurazione.

### Flusso di un messaggio

```
Client WS  ──►  RoomDurableObject
                    │
                    ├──► broadcast a tutti i client connessi nella room
                    ├──► persist in D1 (messages)
                    ├──► parse @mentions → automation_events
                    └──► deliver webhooks (message.created)

[Solo se AI abilitata]
AgentRouter  ◄──  automation_events (type = mention / dm_message)
    │
    ├──► carica contesto: ultimi N messaggi + app_context opzionale
    ├──► chiama LLM configurato
    └──► POST /rooms/{id}/messages/from-bot  →  broadcast risposta
```

---

## 4. Domain Model

### Project (Tenant)

Rappresenta un cliente di Fluxychat. Ogni progetto ha chiavi API e JWT secret propri.

```sql
projects(id, name, created_at)
api_keys(id, project_id, secret, created_at)
project_secrets(project_id, jwt_secret)
```

### Room

```sql
rooms(id, project_id, type, name, created_at)
-- type: "dm" | "group" | "public"

room_members(room_id, user_id, role, joined_at)
-- role: "owner" | "admin" | "member" | "guest"
```

### Message

```sql
messages(
  id, project_id, room_id, user_id,
  content, created_at,
  parent_id,          -- threading / replies
  edited_at,
  deleted_at,
  mentions,           -- JSON array
  og_title, og_description, og_image, og_url,  -- link preview
  source              -- "user" | "bot" | "agent" | "system"
)

message_reactions(message_id, room_id, user_id, emoji, created_at)

attachments(project_id, room_id, message_id, kind, url, name, size_bytes, content_type, created_at)
```

### Read receipts & moderation

```sql
read_receipts(project_id, room_id, user_id, message_id, created_at)

moderation_events(project_id, room_id, user_id, action, reason, expires_at, created_at, target_message_id)
-- action: "mute" | "ban" | "unmute" | "unban" | "report" | "flag"
```

### Bots & Agenti

```sql
bots(id, project_id, name, webhook_url, created_at)

-- Estensione per agenti AI (piani Starter+)
-- handle, provider, model, system_prompt, tools_schema,
-- context_fetch_url, tool_execute_url, capabilities,
-- rate_limit_rpm, is_builtin
```

### Webhooks & Automation

```sql
webhooks(id, project_id, url, secret, event_types, created_at)
automation_events(project_id, event_type, room_id, payload, delivered, created_at)
```

---

## 5. HTTP API

### Autenticazione

Tutte le mutation richiedono JWT HMAC-signed per-project:

```
Authorization: Bearer <JWT>
-- oppure --
?token=<JWT>
```

Claims: `sub` (userId), `tid` (projectId), `roles`, `exp`.

### Messaggi

| Endpoint | Method | Descrizione |
|---|---|---|
| `/messages` | POST | Crea messaggio. Body: `{ roomId, content, replyTo? }` |
| `/messages/{id}` | PATCH | Modifica (solo mittente originale) |
| `/messages/{id}` | DELETE | Soft-delete (solo mittente originale) |
| `/messages/{id}/reactions` | POST | Aggiunge reazione `{ emoji }` |
| `/messages/{id}/reactions` | DELETE | Rimuove reazione `{ emoji }` |

### Rooms

| Endpoint | Method | Descrizione |
|---|---|---|
| `/rooms` | GET | Lista rooms. Params: `type`, `userId` (include unreadCount) |
| `/rooms` | POST | Crea room. Body: `{ id?, name, type, members? }` |
| `/rooms/dm` | POST | Crea o recupera DM tra due utenti `{ a, b }` |
| `/rooms/{id}/members` | GET | Lista membri con ruoli |
| `/rooms/{id}/read` | POST | Aggiorna read receipt `{ messageId }` |
| `/rooms/{id}/unread` | GET | `{ unreadCount }` per userId |

### Ricerca & Export

| Endpoint | Method | Descrizione |
|---|---|---|
| `/api/messages` | GET | History paginata. Params: `roomId`, `before`, `limit` |
| `/search/messages` | GET | Full-text search. Params: `q`, `roomId?`, `limit` |
| `/search/conversations` | GET | Rooms che matchano query con `matches` e `lastMessage` |
| `/export/messages.json` | GET | Export JSON. Params: `roomId`, `from?`, `to?` |
| `/export/messages.csv` | GET | Export CSV per room |

### Moderazione & Admin

| Endpoint | Method | Descrizione |
|---|---|---|
| `/reports` | POST | Segnala messaggio `{ messageId, roomId, reason? }` |
| `/admin/mute` | POST | Muta utente in room |
| `/admin/ban` | POST | Banna utente |
| `/admin/unmute` | POST | Rimuove mute |
| `/admin/unban` | POST | Rimuove ban |
| `/admin/announcement` | POST | Messaggio di sistema in una room |
| `/admin/reports` | GET | Lista segnalazioni recenti |
| `/admin/webhooks` | GET | Lista webhooks registrati |
| `/admin/projects` | GET/POST | Gestione progetti e API key |

### Stats & Costi

| Endpoint | Method | Descrizione |
|---|---|---|
| `/stats/rooms/{id}` | GET | `{ roomId, messageCount, activeUsers }` |
| `/stats/costs` | GET | Stima costi basata su volume messaggi (+ AI se abilitata) |

**Estensioni HTTP (implementate nel Worker, oltre alla tabella):** auth API key (`/auth/token`), CRUD agent (`/agents`), room `PATCH`/`DELETE`, membri `POST`/`DELETE`, stream SSE (`GET /rooms/{id}/stream`), upload (`POST /upload`), GDPR, billing Stripe, osservabilità (`/stats/*`, `/benchmark`, …). Mappa dettagliata: `docs/spec-implementation-map.md`.

### WebSocket

```
GET /ws/room/{roomId}?userId=...&token=...
```

Tipi di messaggio in ingresso e uscita:

| Tipo | Direzione | Descrizione |
|---|---|---|
| `history` | ← server | Ultimi 50 messaggi al connect |
| `message` | ↔ | Nuovo messaggio |
| `edit` | ↔ | Modifica messaggio |
| `delete` | ↔ | Cancellazione messaggio |
| `reaction` | ↔ | Aggiunta/rimozione reazione |
| `read` | → server | Read receipt |
| `typing` | ↔ | Indicatore di digitazione |
| `presence` | ← server | Lista utenti online nella room |
| `ping` / `pong` | ↔ | Keep-alive |
| `error` | ← server | Errore (es. utente bannato) |

---

## 6. Webhooks & Integrazioni

### Registrazione

```
POST /webhooks/register
{ url, eventTypes: string[], secret? }
```

### Delivery

Payload standard firmato HMAC-SHA256 (`X-Fluxy-Signature: sha256=<hex>`):

```json
{
  "type": "<eventType>",
  "projectId": "<project-id>",
  "payload": { ... },
  "createdAt": "ISO timestamp"
}
```

### Event types

| Evento | Trigger |
|---|---|
| `message.created` | Nuovo messaggio via REST |
| `report.created` | Nuova segnalazione |
| `mention` | Utente o bot menzionato |
| `dm_message` | Messaggio in room DM |
| `room_summary` | Summary generato (se AI abilitata) |

---

## 7. AI Layer (Piani Starter e Pro)

L'AI non è il prodotto — è un upgrade. Il developer abilita l'agente con un toggle dopo aver già integrato la chat.

### Principio di funzionamento

L'agente è un partecipante della room invocabile via `@mention`. Prima di rispondere, può richiedere contesto applicativo al backend del developer (opzionale) ed eseguire azioni tramite tool calling.

```
@assistant dimmi lo stato del ticket #42
    │
    ├──► [opzionale] GET {context_fetch_url} → { ticket: {...}, user: {...} }
    ├──► LLM call con contesto + tools
    ├──► [se tool call] POST {tool_execute_url} → esegue azione nel tuo sistema
    └──► risposta postata nella room
```

### Configurazione agente

```typescript
const agent = await fluxy.agents.create({
  handle: 'assistant',
  provider: 'anthropic',           // "openai" | "anthropic" | "custom"
  model: 'claude-3-5-sonnet',
  systemPrompt: 'Sei un assistente per {{room_name}}.',
  contextFetchUrl: 'https://myapp.com/api/fluxy/context',  // opzionale
  toolExecuteUrl: 'https://myapp.com/api/fluxy/tools',     // opzionale
  toolsSchema: [ /* OpenAI-compatible function definitions */ ]
});

await fluxy.rooms.update(roomId, { agentEnabled: true, agentId: agent.id });
```

### Agenti built-in (abilitabili con un toggle)

| Agente | Funzione | Trigger |
|---|---|---|
| `@summarizer` | Summary della conversazione on-demand o periodico | `@summarizer` o timer |
| `@moderator` | Analisi contenuti asincrona, flag automatico | Ogni messaggio |
| `@assistant` | General-purpose, configurabile dal developer | `@assistant` |
| `@onboarding` | Guida interattiva per nuovi membri | Join in room |

### Endpoint AI

| Endpoint | Method | Descrizione |
|---|---|---|
| `/agents` | POST/GET | Crea / lista agenti del progetto |
| `/agents/{id}` | PATCH | Aggiorna configurazione |
| `/agents/{id}/invoke` | POST | Invocazione diretta senza @mention |
| `/agents/{id}/runs` | GET | Storico esecuzioni (latency, tokens, status) |
| `/stats/ai` | GET | Usage totale: invocazioni, token, costo stimato |

---

## 8. SDK & UI Kit

### `useChat(roomId)` — hook principale

```typescript
const {
  messages,
  sendMessage,
  editMessage,
  deleteMessage,
  addReaction,
  markRead,
  typing,
  presence,
  // AI (solo se agente abilitato)
  agentTyping,
  invokeAgent,
} = useChat(roomId, { token });
```

### Componenti UI (headless, Tailwind + Radix)

- `MessageList` — lista messaggi con virtualizzazione
- `MessageItem` — singolo messaggio con reazioni, threading, OG preview
- `MessageInput` — input con mention autocomplete, upload allegati
- `PresenceList` — lista utenti online
- `ChannelList` — lista rooms con unread count
- `AgentMessage` — variante MessageItem con badge AI
- `AgentTypingIndicator` — animazione "assistente sta scrivendo…"

---

## 9. Dashboard

Applicazione Next.js 16 per la gestione del progetto.

**Funzionalità:**
- Gestione progetti e API key
- Configurazione webhooks e bots/agenti
- Moderazione: lista segnalazioni, mute/ban
- Analytics: messaggi per room, utenti attivi
- Costi: stima in tempo reale basata sul volume
- Export messaggi (JSON/CSV)
- (Piani AI) Configurazione agenti, storico AgentRun, AI usage & costi

---

## 10. Pricing

| | Free | Starter | Pro |
|---|---|---|---|
| **Prezzo** | £0 | £29/mese | £99/mese |
| Messaggi | 50k/mese | 1M/mese | 10M/mese |
| Overage messaggi | — | £1/1M | £1/1M |
| AI token inclusi | — | 500k/mese | 3M/mese |
| Agenti custom | — | 3 | Illimitati |
| Agenti built-in | — | Tutti | Tutti |
| Webhooks | 1 | 10 | Illimitati |
| Export | — | ✅ | ✅ |
| Supporto | Community | Email | Prioritario |

**Overage AI:** pass-through dal provider LLM + 20% di margine. Il developer vede il costo reale nel dashboard.

---

## 11. Roadmap

### Fase 1 — Core (0–2 mesi)
*Obiettivo: chat stabile e production-ready, primi developer sul free tier.*

- Worker + Durable Objects stabili con test di carico
- SDK `useChat()` con reconnection e backoff automatico
- Dashboard: gestione progetti, API key, rooms, moderation base
- Documentazione + starter kit Next.js (deploy in < 5 minuti)
- Free tier attivo: 50k messaggi/mese

### Fase 2 — AI Layer (2–4 mesi)
*Obiettivo: differenziatore AI disponibile nei piani a pagamento.*

- AgentRouter: pipeline completa trigger → context → LLM → tool execution → output
- Agenti configurabili dal dashboard (context_fetch_url, tool_execute_url, tools_schema)
- Agenti built-in: @summarizer, @moderator, @assistant
- AgentRun tracking: latency, tokens, errori — visibile nel dashboard
- Stats AI e costi nel dashboard

### Fase 3 — Scale & Enterprise (4–12 mesi)
*Obiettivo: crescere upmarket, aumentare ARPU.*

- Multi-provider AI routing (OpenAI, Anthropic, Azure, custom)
- SSO / SAML
- Audit log completo
- SLA garantito e supporto dedicato
- Agent marketplace: template condivisibili tra developer

---

## 12. Requisiti Non-Funzionali

### Performance
- Latenza WS: < 100ms p99 per send/receive
- Latenza agente: < 3s p50 per risposta AI (escluso tempo LLM provider)
- Timeout tool execution: 10s per chiamata, max 5 iterazioni per evitare loop

### Sicurezza
- JWT HMAC-signed per-project con scadenza
- API key non stocare in chiaro (hash)
- Webhook signing HMAC-SHA256
- Rate limiting per-tenant su messaggi e invocazioni AI
- Mute/ban enforcement a livello Durable Object (non bypassabile dal client)

### Osservabilità
- Structured logs su Worker e DO con `trace_id` per ogni request
- Metriche: throughput messaggi, errori WS, webhook failures, AgentRun status
- Alert su `rate_limit_exceeded` e `agent_error_rate`

### Costi infrastruttura
- Target: ~£1 per 1M messaggi (infra Cloudflare edge)
- AI: pass-through costo provider + margine — developer vede costo reale
- Niente compute pesante nel router HTTP: tutto in Durable Objects