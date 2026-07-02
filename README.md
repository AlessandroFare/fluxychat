## FluxyChat

Realtime chat on Cloudflare Workers. One worker, WebSocket rooms, a TypeScript SDK, and an operator console for projects, agents, and compliance.

### Quick links

| What | Where |
|------|-------|
| Try hosted | [fluxychat.com/landing](https://fluxychat.com/landing) |
| Operator console | `apps/dashboard` → start at `/onboarding` |
| SDK (npm) | [@fluxy-chat/sdk](https://www.npmjs.com/package/@fluxy-chat/sdk) |
| Worker API | `apps/worker` · deploy with Wrangler |
| Documentation | [docs/README.md](docs/README.md) · [Features overview](docs/features-overview.md) |
| Marketing | [docs/marketing/](docs/marketing/) |

### What you get (at a glance)

- **Realtime:** WebSocket rooms, presence, SSE fallback, inbox, notifications
- **AI:** in-room agents, voice + transcription, suggestions, digest, room memory
- **Omnichannel:** SMS/WhatsApp, agent queue, handoff, polls and forms
- **Enterprise:** SSO/SCIM, audit, retention, SOC2/HIPAA checklist, DLP, IP whitelist
- **Distribution:** embed widget, custom domain, external bridges, MCP

### Get started in 3 steps

1. `pnpm install` and `pnpm run dev:setup` (copy `.dev.vars` / `.env.local` templates), then `pnpm dev`
2. Open `/onboarding` in the dashboard: project, JWT, first room
3. Integrate `@fluxy-chat/sdk` in your frontend (see `packages/sdk/README.md`)

### Quickstart (90 seconds)

Skip the dashboard and verify the stack end-to-end from the terminal:

```bash
git clone https://github.com/fluxychat/fluxychat
cd fluxychat
pnpm install
pnpm run first-message
```

The script starts a local Worker, provisions a project, and lands your first message.
It prints a JWT you can use immediately with the SDK.

---

> **Open beta** — [Try hosted cloud](https://fluxychat.com/landing) · [Guides](https://fluxychat.com/guides) · [Compare](https://fluxychat.com/compare) · [Dev.to walkthrough](https://dev.to/fluxychat_sdk_330378fbf56/how-to-build-a-realtime-chat-app-on-cloudflare-workers-without-managing-a-socket-fleet-4hdh) · [npm SDK](https://www.npmjs.com/package/@fluxy-chat/sdk) · [![Socket Badge](https://badge.socket.dev/npm/package/@fluxy-chat/sdk/0.4.0)](https://badge.socket.dev/npm/package/@fluxy-chat/sdk/0.4.0) · **Support:** fluxychat@outlook.com

- **Cloudflare Workers + Durable Objects** for WebSocket handling and presence.
- **Cloudflare D1 (SQLite edge)** for messages and metadata.
- **React / JS SDK (`useChat(roomId)`)** and lightweight UI kit.
- **Next.js 16** dashboard for analytics, moderation, and cost insights.

### What's new (P22–P25 — AI-native architecture overhaul)

Inspired by the [Vercel Chat SDK](https://chat-sdk.dev) and [AI SDK](https://sdk.vercel.ai) architecture. Full roadmap: [`ROADMAP_EXECUTION.md`](ROADMAP_EXECUTION.md).

| Area | Highlights |
|------|------------|
| **P22 adapters** | Multi-platform adapter pattern (14 platforms: Slack, Teams, Discord, Telegram, WhatsApp, Google Chat, GitHub, Linear, Matrix, Resend, IRC, Twitch, Line, API); streaming markdown renderer with table buffering + code fence tracking + inline marker healing; card element builder (JSX + function API) with Slack Block Kit / Teams Adaptive Cards rendering; AI tool presets (reader/messenger/moderator) with per-tool approval gates; concurrency strategies (drop/queue/debounce/burst/concurrent); mdast canonical message format; transcripts API; custom emoji; callback URLs; modal context; lock scope; identity resolver; streaming plan |
| **P23 AI core** | Stream resumption (reconnect to in-progress AI responses); human-in-the-loop approval workflow; MCP client integration (HTTP/SSE/stdio transports + tool conversion + resources); LLM middleware pipeline (transformParams / wrapGenerate / wrapStream); DevTools web UI for inspecting LLM calls + token usage; OpenTelemetry with GenAI semantic conventions; WorkflowAgent for durable agent execution; sandbox support for untrusted code; bidirectional realtime voice (voice-to-voice AI with tool calling); scoped tool context per-tool secret isolation |
| **P24 AI medium** | Tool call streaming (progressive input rendering); multi-step loop control (maxSteps / stopWhen); provider-defined & provider-executed tools; pluggable transport architecture; typed UIMessage generics; data parts streaming; extractReasoningMiddleware; RAG middleware; provider-level middleware; image generation; speech generation (TTS); useObject hook for structured JSON streaming; generateObject/streamObject with schema validation; MCP Apps (sandboxed tool UIs); slash commands |
| **P25 AI low** | experimental_throttle for render throttling; smoothStream for flicker-free text; ephemeral messages with DM fallback; cosine similarity utility; strict tool calling; sendAutomaticallyWhen auto-submit; sensitive context controls for telemetry |

Full feature docs: [`docs/README.md`](docs/README.md) · SDK API tables: [`packages/sdk/README.md`](packages/sdk/README.md) · Guides: [`docs/guides/`](docs/guides/)

### Monorepo layout

- `apps/dashboard` – Next.js 16 app: marketing **`/landing`**, operator home **`/`**, guided **`/onboarding`**, analytics, rooms, admin, billing.
- `apps/worker` – Cloudflare Worker entry (WebSocket, APIs, Durable Objects).
- `apps/ai-agent` – AI Agent Service (processes mention webhooks, calls LLM providers, posts replies).
- `packages/sdk` – TypeScript client SDK (`useChat`, low-level client).
- `packages/ui` – Headless, themeable chat UI components.

### What the hosted app does

1. **Sign up** (Clerk) → provisions a Worker project + admin JWT.
2. **Quickstart** (`/onboarding`) → member JWT, room, first message, optional agent.
3. **Console** → rooms, agents, webhooks, billing, analytics, GDPR tools.

Backend: your messages and metadata live on **your Cloudflare Worker + D1** (multi-tenant hosted cloud or self-host).

### Publish `@fluxy-chat/sdk` to npm

1. npm org **`fluxy-chat`** (scope `@fluxy-chat`) — already created for publish.
2. `cd packages/sdk && pnpm run build && pnpm test`
3. `npm login` then `npm publish --access public` (from `packages/sdk`).
4. Consumers set `baseUrl` to their Worker and mint JWTs server-side — see `packages/sdk/README.md`.

`@fluxychat/ui` and `@fluxychat/agent` are workspace packages today (not published yet).

### Getting started

1. Install dependencies:

```bash
pnpm install
```

2. Run all apps in dev mode:

```bash
pnpm dev
```

3. Individual apps:

- `cd apps/dashboard` – `pnpm dev`
- `cd apps/worker` – `pnpm dev` (via `wrangler dev`)
- `cd apps/ai-agent` – `pnpm dev` (via `wrangler dev`)

For the Worker, optional local secrets and toggles: copy `apps/worker/.dev.vars.example` to `apps/worker/.dev.vars` (gitignored) and fill only what you need.

Use case guides, auth cookbook, troubleshooting, and dashboard integration notes live under `docs/` (see `docs/README.md`). HTTP surface vs `SPEC.md`: `docs/spec-implementation-map.md`.

### Docs

- Docs home: `docs/README.md`
- **Local dev setup (env vars, ports, Clerk, first message):** [`docs/local-development.md`](docs/local-development.md)
- Dashboard (JWT session, `/rooms`, `/admin` webhooks, Privacy/GDPR, `useChat` transport): `docs/dashboard-integration.md`
- Distribution assets (published Dev.to, InsightScout replies): `docs/distribution/README.md`

### Operations

- **Open beta deploy (step-by-step + env):** [`docs/operations/open-beta-deploy-guide.md`](docs/operations/open-beta-deploy-guide.md)
- Deploy/rollback runbook: `RUNBOOK_DEPLOY_ROLLBACK.md`
- Tenant recovery drill script: `apps/worker/scripts/tenant-recovery-drill.mjs`
- Post-deploy smoke (health + stats): `cd apps/worker && pnpm run smoke:remote -- --base-url … --admin-jwt …` (see `docs/m6-operational-checklist.md`)
- End-to-end HTTP smoke (auth → room → message → GDPR): `export TEST_API_KEY=fc_...` then `pnpm smoke:bundled` from repo root (`scripts/smoke-test.sh`; requires `bash` + `curl`)

### API contract (M3)

- Public standard for AI resources is `agents`.
- Legacy compatibility endpoints under `bots` are still supported for existing integrations.

### Auth token quickstart

Use an API key to mint a project-scoped JWT for SDK/client operations:

```bash
curl -X POST "http://127.0.0.1:8787/auth/token" \
  -H "Content-Type: application/json" \
  -H "X-Fluxy-Api-Key: fc_your_api_key" \
  -d '{
    "userId": "alice",
    "roles": ["admin"],
    "ttlSeconds": 3600
  }'
```

### Agents API quickstart

Create an agent:

```bash
curl -X POST "http://127.0.0.1:8787/agents" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Support Assistant",
    "handle": "assistant",
    "provider": "openai",
    "model": "gpt-4o-mini",
    "capabilities": ["chat"]
  }'
```

List agents:

```bash
curl -X GET "http://127.0.0.1:8787/agents" \
  -H "Authorization: Bearer <JWT>"
```

Invoke an agent:

```bash
curl -X POST "http://127.0.0.1:8787/agents/<agentId>/invoke" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "public-demo-room",
    "content": "Give me a short summary for this room"
  }'
```

Get runs for an agent:

```bash
curl -X GET "http://127.0.0.1:8787/agents/<agentId>/runs?limit=20" \
  -H "Authorization: Bearer <JWT>"
```

Get aggregated AI usage stats:

```bash
curl -X GET "http://127.0.0.1:8787/stats/ai" \
  -H "Authorization: Bearer <JWT>"
```

### Ops and SLO snapshot

Read operational counters and SLO status for a project:

```bash
curl -X GET "http://127.0.0.1:8787/stats/ops?minutes=60" \
  -H "Authorization: Bearer <JWT>"

curl -X GET "http://127.0.0.1:8787/stats/slo?minutes=60" \
  -H "Authorization: Bearer <JWT>"

curl -X GET "http://127.0.0.1:8787/stats/launch-kpis" \
  -H "Authorization: Bearer <JWT>"
```

Default SLO targets (overridable via env):

- `SLO_TARGET_REQUEST_ERROR_RATE`: max request error rate (default `0.01`)
- `SLO_TARGET_WEBHOOK_SUCCESS_RATE`: min webhook success rate (default `0.98`)
- `ALERT_DISPATCH_WEBHOOK_URL`: external endpoint for automatic operational alert dispatch (deduplicated per alert event)

### Quotas (M5-C)

Basic plan enforcement is enabled by default (can be disabled in dev):

- `QUOTAS_ENABLED` (default `true`)
- `QUOTA_MESSAGES_PER_MONTH` (default `50000`)
- `QUOTA_AGENT_INVOKES_PER_MONTH` (default `1000`)
- `QUOTA_WEBHOOK_DELIVERIES_PER_MONTH` (default `10000`)

### Pricing guardrails (M5-C)

`GET /stats/costs` also returns pricing guardrails computed from env assumptions:

- `PRICE_PER_MILLION_MESSAGES` (default `1`)
- `PRICE_PER_AGENT_INVOKE` (default `0`)
- `PRICE_PER_WEBHOOK_DELIVERY` (default `0`)
- `MIN_GROSS_MARGIN` (default `0.3`)

### SDK quickstart for agents

```ts
import { FluxyChatClient, useChat } from "@fluxy-chat/sdk";

const client = new FluxyChatClient({
  baseUrl: "http://127.0.0.1:8787",
  userId: "alice",
  token: "<JWT>",
});

// low-level REST helpers
const agents = await client.listAgents();
const runs = await client.getAgentRuns(agents[0].id);
await client.invokeAgentRest(agents[0].id, "public-demo-room", "Summarize");

// hook-level helper
const { invokeAgent, agentTyping } = useChat({
  roomId: "public-demo-room",
  client,
  agentId: agents[0].id,
});
await invokeAgent("Draft a reply for this thread");
```


