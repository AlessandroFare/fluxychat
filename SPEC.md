# Fluxychat — Product Specification v3.0

> **One-liner:** The most affordable real-time chat for SaaS products — serverless WebSockets, self-serve, no DevOps.

---

## 1. Positioning

### The problem

Adding real-time chat to a SaaS product is still unnecessarily expensive and complex:

- **Pusher / Ably** cost $49–$299/month even at modest volume, with opaque pricing.
- **Sendbird / Stream** are enterprise-oriented — sales-driven, no self-serve.
- **Firebase / Supabase** push you to move your database to them.
- **Rolling your own** means running stateful WebSockets on serverless, which Vercel and Netlify do not support well.

### The solution

Fluxychat is a SaaS platform + SDK that gives you production-ready real-time chat in under an hour, at a fraction of competitor cost.

| | Fluxychat | Pusher | Sendbird |
|---|---|---|---|
| Serverless WebSocket | ✅ | ✅ | ❌ |
| Chat primitives (rooms, DM, reactions…) | ✅ | ❌ | ✅ |
| Self-serve + clear pricing | ✅ | ✅ | ❌ |
| Generous free tier | ✅ | ❌ | ❌ |
| Contextual AI agent | ✅ (Starter+) | ❌ | ❌ |
| Entry price | **£0** | $49/month | "Talk to sales" |

### Main differentiator

**Price.** £1 per 1 million messages. Free tier of 50k messages/month. No lock-in on DB or stack. Works with any backend — Next.js, Express, Laravel, anything.

AI is available on paid plans as a natural upgrade, not a requirement to get started.

---

## 2. Target

### Primary customer (today)

Indie developers and startups building SaaS on modern stacks (Next.js, Vercel, TypeScript) who need chat without becoming WebSocket experts or spending hundreds per month.

**Typical profile:**
- Team of 1–10
- Stack: Next.js / Vercel, TypeScript, Prisma or Supabase for the main DB
- Pain: *"I want chat in my SaaS. Pusher is too expensive and Firebase forces me to change everything."*
- Channels: Twitter/X dev community, Hacker News, Product Hunt, technical SEO

### Secondary customer (6–18 months)

Product teams in mid-market companies replacing legacy chat or adding real-time communication to internal tools, with budget and structured requirements.

---

## 3. Architecture

### Technical stack

| Layer | Technology | Role |
|---|---|---|
| Edge runtime | Cloudflare Workers | HTTP + WebSocket entrypoint |
| Real-time state | Cloudflare Durable Objects | RoomDurableObject per room |
| Primary database | Cloudflare D1 (edge SQLite) | Messages, rooms, members, moderation |
| Cache / sessions | Cloudflare KV | Rate limiting, aggregated presence |
| File storage | Cloudflare R2 | Attachments and media |
| AI routing | Dedicated worker | Receives events, calls LLM, posts replies |
| Dashboard | Next.js 16 (App Router) | Admin, analytics, configuration |
| Client SDK | TypeScript | `useChat()` hook + typed REST client |

### Why Cloudflare

- Durable Objects natively solve WebSockets on serverless — no Terraform, no DevOps.
- Very low infrastructure cost → enables aggressive pricing at the core of positioning.
- Global edge → low latency everywhere without configuration.

### Message flow

```
Client WS  ──►  RoomDurableObject
                    │
                    ├──► broadcast to all clients connected in the room
                    ├──► persist in D1 (messages)
                    ├──► parse @mentions → automation_events
                    └──► deliver webhooks (message.created)

[When AI is enabled]
AgentRouter  ◄──  automation_events (type = mention / dm_message)
    │
    ├──► [optional] GET {context_fetch_url} → { ticket: {...}, user: {...} }
    ├──► LLM call with context + tools
    ├──► [if tool call] POST {tool_execute_url} → runs action in your system
    └──► response posted in the room
```

---

## 4. Domain Model

### Project (Tenant)

Represents a Fluxychat customer. Each project has its own API keys and JWT secret.

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

### Bots & Agents

```sql
bots(id, project_id, name, webhook_url, created_at)

-- Extension for AI agents (Starter+ plans)
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

### Authentication

All mutations require per-project HMAC-signed JWT:

```
Authorization: Bearer <JWT>
-- or --
?token=<JWT>
```

Claims: `sub` (userId), `tid` (projectId), `roles`, `exp`.

### Messages

| Endpoint | Method | Description |
|---|---|---|
| `/messages` | POST | Create message. Body: `{ roomId, content, replyTo? }` |
| `/messages/{id}` | PATCH | Edit (original sender only) |
| `/messages/{id}` | DELETE | Soft-delete (original sender only) |
| `/messages/{id}/reactions` | POST | Add reaction `{ emoji }` |
| `/messages/{id}/reactions` | DELETE | Remove reaction `{ emoji }` |

### Rooms

| Endpoint | Method | Description |
|---|---|---|
| `/rooms` | GET | List rooms. Params: `type`, `userId` (includes unreadCount) |
| `/rooms` | POST | Create room. Body: `{ id?, name, type, members? }` |
| `/rooms/dm` | POST | Create or fetch DM between two users `{ a, b }` |
| `/rooms/{id}/members` | GET | List members with roles |
| `/rooms/{id}/read` | POST | Update read receipt `{ messageId }` |
| `/rooms/{id}/unread` | GET | `{ unreadCount }` per userId |

### Search & Export

| Endpoint | Method | Description |
|---|---|---|
| `/api/messages` | GET | Paginated history. Params: `roomId`, `before`, `limit` |
| `/search/messages` | GET | Full-text search. Params: `q`, `roomId?`, `limit` |
| `/search/conversations` | GET | Rooms matching query with `matches` and `lastMessage` |
| `/export/messages.json` | GET | JSON export. Params: `roomId`, `from?`, `to?` |
| `/export/messages.csv` | GET | CSV export per room |

### Moderation & Admin

| Endpoint | Method | Description |
|---|---|---|
| `/reports` | POST | Report message `{ messageId, roomId, reason? }` |
| `/admin/mute` | POST | Mute user in room |
| `/admin/ban` | POST | Ban user |
| `/admin/unmute` | POST | Remove mute |
| `/admin/unban` | POST | Remove ban |
| `/admin/announcement` | POST | System message in a room |
| `/admin/reports` | GET | Recent reports list |
| `/admin/webhooks` | GET | Registered webhooks list |
| `/admin/projects` | GET/POST | Projects and API key management |

### Stats & Costs

| Endpoint | Method | Description |
|---|---|---|
| `/stats/rooms/{id}` | GET | `{ roomId, messageCount, activeUsers }` |
| `/stats/costs` | GET | Cost estimate from message volume (+ AI if enabled) |

**HTTP extensions (implemented in Worker, beyond the table):** API key auth (`/auth/token`), agent CRUD (`/agents`), room `PATCH`/`DELETE`, member `POST`/`DELETE`, SSE stream (`GET /rooms/{id}/stream`), upload (`POST /upload`), GDPR, Stripe billing, observability (`/stats/*`, `/benchmark`, …). Detailed map: `docs/spec-implementation-map.md`.

### WebSocket

```
GET /ws/room/{roomId}?userId=...&token=...
```

Inbound and outbound message types:

| Type | Direction | Description |
|---|---|---|
| `history` | ← server | Last 50 messages on connect |
| `message` | ↔ | New message |
| `edit` | ↔ | Message edit |
| `delete` | ↔ | Message delete |
| `reaction` | ↔ | Add/remove reaction |
| `read` | → server | Read receipt |
| `typing` | ↔ | Typing indicator |
| `presence` | ← server | Online users in room |
| `ping` / `pong` | ↔ | Keep-alive |
| `error` | ← server | Error (e.g. user banned) |

---

## 6. Webhooks & Integrations

### Registration

```
POST /webhooks/register
{ url, eventTypes: string[], secret? }
```

### Delivery

Standard payload signed HMAC-SHA256 (`X-Fluxy-Signature: sha256=<hex>`):

```json
{
  "type": "<eventType>",
  "projectId": "<project-id>",
  "payload": { ... },
  "createdAt": "ISO timestamp"
}
```

### Event types

| Event | Trigger |
|---|---|
| `message.created` | New message via REST |
| `report.created` | New report |
| `mention` | User or bot mentioned |
| `dm_message` | Message in DM room |
| `room_summary` | Summary generated (if AI enabled) |

---

## 7. AI Layer (Starter and Pro plans)

AI is not the core product — it is an upgrade. The developer enables the agent with a toggle after chat is already integrated.

### How it works

The agent is a room participant invokable via `@mention`. Before replying, it can fetch app context from the developer backend (optional) and run actions via tool calling.

```
@assistant what's the status of ticket #42
    │
    ├──► [optional] GET {context_fetch_url} → { ticket: {...}, user: {...} }
    ├──► LLM call with context + tools
    ├──► [if tool call] POST {tool_execute_url} → runs action in your system
    └──► reply posted in the room
```

### Agent configuration

```typescript
const agent = await fluxy.agents.create({
  handle: 'assistant',
  provider: 'anthropic',           // "openai" | "anthropic" | "custom"
  model: 'claude-3-5-sonnet',
  systemPrompt: 'You are an assistant for {{room_name}}.',
  contextFetchUrl: 'https://myapp.com/api/fluxy/context',  // optional
  toolExecuteUrl: 'https://myapp.com/api/fluxy/tools',     // optional
  toolsSchema: [ /* OpenAI-compatible function definitions */ ]
});

await fluxy.rooms.update(roomId, { agentEnabled: true, agentId: agent.id });
```

### Built-in agents (enable with a toggle)

| Agent | Function | Trigger |
|---|---|---|
| `@summarizer` | On-demand or periodic conversation summary | `@summarizer` or timer |
| `@moderator` | Async content analysis, automatic flag | Every message |
| `@assistant` | General-purpose, developer-configurable | `@assistant` |
| `@onboarding` | Interactive guide for new members | Join room |

### AI endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/agents` | POST/GET | Create / list project agents |
| `/agents/{id}` | PATCH | Update configuration |
| `/agents/{id}/invoke` | POST | Direct invoke without @mention |
| `/agents/{id}/runs` | GET | Run history (latency, tokens, status) |
| `/stats/ai` | GET | Total usage: invocations, tokens, estimated cost |

---

## 8. SDK & UI Kit

### `useChat(roomId)` — main hook

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
  // AI (only when agent enabled)
  agentTyping,
  invokeAgent,
} = useChat(roomId, { token });
```

### UI components (headless, Tailwind + Radix)

- `MessageList` — virtualized message list
- `MessageItem` — single message with reactions, threading, OG preview
- `MessageInput` — input with mention autocomplete, attachment upload
- `PresenceList` — online users
- `ChannelList` — rooms with unread count
- `AgentMessage` — MessageItem variant with AI badge
- `AgentTypingIndicator` — "assistant is typing…" animation

---

## 9. Dashboard

Next.js 16 application for project management.

**Features:**
- Projects and API key management
- Webhook and bot/agent configuration
- Moderation: reports list, mute/ban
- Analytics: messages per room, active users
- Costs: real-time estimate from volume
- Message export (JSON/CSV)
- (AI plans) Agent configuration, AgentRun history, AI usage & costs

---

## 10. Pricing

| | Free | Starter | Pro |
|---|---|---|---|
| **Price** | £0 | £29/month | £99/month |
| Messages | 50k/month | 1M/month | 10M/month |
| Message overage | — | £1/1M | £1/1M |
| AI tokens included | — | 500k/month | 3M/month |
| Custom agents | — | 3 | Unlimited |
| Built-in agents | — | All | All |
| Webhooks | 1 | 10 | Unlimited |
| Export | — | ✅ | ✅ |
| Support | Community | Email | Priority |

**AI overage:** pass-through from LLM provider + 20% margin. Developer sees real cost in the dashboard.

---

## 11. Roadmap

### Phase 1 — Core (0–2 months)
*Goal: stable production-ready chat, first developers on free tier.*

- Stable Worker + Durable Objects with load tests
- SDK `useChat()` with reconnection and automatic backoff
- Dashboard: projects, API keys, rooms, basic moderation
- Documentation + Next.js starter kit (deploy in < 5 minutes)
- Active free tier: 50k messages/month

### Phase 2 — AI Layer (2–4 months)
*Goal: AI differentiator on paid plans.*

- AgentRouter: full pipeline trigger → context → LLM → tool execution → output
- Agents configurable from dashboard (context_fetch_url, tool_execute_url, tools_schema)
- Built-in agents: @summarizer, @moderator, @assistant
- AgentRun tracking: latency, tokens, errors — visible in dashboard
- AI stats and costs in dashboard

### Phase 3 — Scale & Enterprise (4–12 months)
*Goal: grow upmarket, increase ARPU.*

- Multi-provider AI routing (OpenAI, Anthropic, Azure, custom)
- SSO / SAML
- Full audit log
- Guaranteed SLA and dedicated support
- Agent marketplace: shareable templates between developers

---

## 12. Non-Functional Requirements

### Performance
- WS latency: < 100ms p99 for send/receive
- Agent latency: < 3s p50 for AI response (excluding LLM provider time)
- Tool execution timeout: 10s per call, max 5 iterations to avoid loops

### Security
- Per-project HMAC-signed JWT with expiry
- API keys not stored in plaintext (hash)
- Webhook signing HMAC-SHA256
- Per-tenant rate limiting on messages and AI invocations
- Mute/ban enforced at Durable Object level (not bypassable from client)

### Observability
- Structured logs on Worker and DO with `trace_id` per request
- Metrics: message throughput, WS errors, webhook failures, AgentRun status
- Alerts on `rate_limit_exceeded` and `agent_error_rate`

### Infrastructure cost
- Target: ~£1 per 1M messages (Cloudflare edge infra)
- AI: provider cost pass-through + margin — developer sees real cost
- No heavy compute in HTTP router: everything in Durable Objects
