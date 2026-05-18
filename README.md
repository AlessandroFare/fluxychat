## fluxychat

> **Open beta** — [Try the hosted console](https://fluxychat.vercel.app/landing)
> · [npm SDK](https://www.npmjs.com/package/@fluxy-chat/sdk)
> · Feedback: fluxychat@outlook.com

Ultra-low-cost realtime chat (SaaS + SDK), inspired by services like TalkJS but built on modern edge-native primitives.

**Live demo console:** [fluxychat.vercel.app](https://fluxychat.vercel.app) · **Source:** [github.com/AlessandroFare/fluxychat](https://github.com/AlessandroFare/fluxychat) · **Support:** fluxychat@outlook.com

- **Cloudflare Workers + Durable Objects** for WebSocket handling and presence.
- **Cloudflare D1 (SQLite edge)** for messages and metadata.
- **React / JS SDK (`useChat(roomId)`)** and lightweight UI kit.
- **Next.js 16** dashboard for analytics, moderation, and cost insights.

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
- Dashboard (JWT session, `/rooms`, `/admin` webhooks, Privacy/GDPR, `useChat` transport): `docs/dashboard-integration.md`

### Operations

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


