# FluxyChat

Realtime chat on Cloudflare Workers — one Worker, WebSocket rooms, a TypeScript SDK, and an operator console for projects, agents, and compliance.

> **Open beta** — [Try hosted](https://fluxychat.com) · [Guides](https://fluxychat.com/guides) · [Compare](https://fluxychat.com/compare) · [Public docs](https://docs.fluxychat.com) · [npm SDK](https://www.npmjs.com/package/@fluxy-chat/sdk) · [![Socket Badge](https://badge.socket.dev/npm/package/@fluxy-chat/sdk/0.5.0)](https://badge.socket.dev/npm/package/@fluxy-chat/sdk/0.5.0) · **Support:** fluxychat@outlook.com

## Quick links

| What | Where |
|------|-------|
| Try hosted | [fluxychat.com](https://fluxychat.com) |
| Public documentation | [docs.fluxychat.com](https://docs.fluxychat.com) |
| Operator console | `apps/dashboard` → start at `/onboarding` |
| SDK (npm) | [@fluxy-chat/sdk](https://www.npmjs.com/package/@fluxy-chat/sdk) |
| React hooks | [@fluxy-chat/react](https://www.npmjs.com/package/@fluxy-chat/react) |
| Worker API | `apps/worker` · deploy with Wrangler |
| Repo docs index | [docs/README.md](docs/README.md) · [Features overview](docs/features-overview.md) |
| Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) |

## What you get

- **Realtime:** WebSocket rooms, presence, SSE fallback, inbox, notifications
- **AI:** in-room agents, voice + transcription, suggestions, digest, room memory
- **Omnichannel:** SMS/WhatsApp, agent queue, handoff, polls and forms
- **Enterprise:** SSO/SCIM, audit, retention, SOC 2/HIPAA checklist, DLP, IP whitelist
- **Distribution:** embed widget, custom domain, external bridges, MCP

**Stack:** Cloudflare Workers + Durable Objects (WebSocket, presence) · D1 SQLite at the edge (messages, metadata) · Next.js dashboard · `@fluxy-chat/sdk` + `@fluxy-chat/react`.

## Get started

### Fastest path (terminal)

```bash
git clone https://github.com/fluxychat/fluxychat
cd fluxychat
pnpm install
pnpm run first-message
```

Starts a local Worker, provisions a project, and sends your first message. Prints a JWT you can use with the SDK immediately.

### Full local dev

```bash
pnpm install
pnpm run dev:setup   # copies .dev.vars / .env.local templates
pnpm dev             # dashboard + worker + docs in parallel
```

Then:

1. Open `/onboarding` in the dashboard — project, JWT, first room
2. Integrate `@fluxy-chat/sdk` in your frontend ([packages/sdk/README.md](packages/sdk/README.md))

**Per-app dev:**

| App | Command |
|-----|---------|
| Dashboard | `cd apps/dashboard && pnpm dev` |
| Worker | `cd apps/worker && pnpm dev` (Wrangler) |
| Docs site | `pnpm docs:dev` |
| AI agent service | `cd apps/ai-agent && pnpm dev` |

Copy `apps/worker/.dev.vars.example` → `apps/worker/.dev.vars` (gitignored) for local secrets. Full env guide: [docs/local-development.md](docs/local-development.md).

## Hosted app flow

1. **Sign up** (Clerk) → provisions a Worker project + admin JWT
2. **Quickstart** (`/onboarding`) → member JWT, room, first message, optional agent
3. **Console** → rooms, agents, webhooks, billing, analytics, GDPR tools

Your messages and metadata live on **your Cloudflare Worker + D1** (multi-tenant hosted cloud or self-host).

## Monorepo layout

| Path | Role |
|------|------|
| `apps/dashboard` | Next.js — marketing, operator console, onboarding, analytics, billing |
| `apps/worker` | Cloudflare Worker — WebSocket, REST, Durable Objects |
| `apps/docs` | Fumadocs documentation site (published at docs.fluxychat.com) |
| `apps/ai-agent` | Optional AI agent service (mention webhooks → LLM → room replies) |
| `apps/status` | Status page app |
| `packages/sdk` | TypeScript client (`FluxyChatClient`, transport, REST helpers) |
| `packages/react` | React hooks (`useChat`, `useInbox`, `FluxyRealtimeProvider`) |
| `packages/ui` | Headless, themeable chat UI components |
| `packages/protocol` | Shared WebSocket event types |
| `packages/agent` | Server-side bot / streaming helpers |

## What's new (P22–P25)

Inspired by the [Vercel Chat SDK](https://chat-sdk.dev) and [AI SDK](https://sdk.vercel.ai). Details: [docs/README.md](docs/README.md) (P22–P25 section) · [features overview](docs/features-overview.md).

| Area | Highlights |
|------|------------|
| **P22 adapters** | 14 platform adapters; streaming markdown; card builder; AI tool presets; mdast message format |
| **P23 AI core** | Stream resumption; HITL approval; MCP client; LLM middleware pipeline; DevTools; WorkflowAgent; voice-to-voice |
| **P24 AI medium** | Tool call streaming; multi-step loops; pluggable transport; RAG middleware; TTS; structured JSON streaming |
| **P25 AI low** | Render throttling; smoothStream; ephemeral messages; strict tool calling; telemetry controls |

## Publish to npm

Scope **`@fluxy-chat`** on npm:

```bash
cd packages/sdk && pnpm run build && pnpm test
npm login && npm publish --access public
```

Consumers set `baseUrl` to their Worker and mint JWTs server-side — see [packages/sdk/README.md](packages/sdk/README.md).

`@fluxy-chat/ui` and `@fluxy-chat/agent` are workspace packages today (not published yet).

## Documentation

| Topic | Link |
|-------|------|
| Docs home (repo) | [docs/README.md](docs/README.md) |
| Local dev setup | [docs/local-development.md](docs/local-development.md) |
| Dashboard integration | [docs/dashboard-integration.md](docs/dashboard-integration.md) |
| Open beta deploy | [docs/operations/open-beta-deploy-guide.md](docs/operations/open-beta-deploy-guide.md) |
| SPEC ↔ Worker map | [docs/spec-implementation-map.md](docs/spec-implementation-map.md) |
| Distribution assets | [docs/distribution/README.md](docs/distribution/README.md) |

## Operations

- Deploy / rollback: [RUNBOOK_DEPLOY_ROLLBACK.md](RUNBOOK_DEPLOY_ROLLBACK.md)
- Tenant recovery drill: `apps/worker/scripts/tenant-recovery-drill.mjs`
- Post-deploy smoke: `cd apps/worker && pnpm run smoke:remote -- --base-url … --admin-jwt …` ([M6 checklist](docs/m6-operational-checklist.md))
- End-to-end HTTP smoke: `export TEST_API_KEY=fc_...` then `pnpm smoke:bundled` (requires `bash` + `curl`)

## API quickstart

### Mint a JWT

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

### Agents

Public standard is **`/agents`**. Legacy **`/bots`** endpoints remain for existing integrations.

Create an agent (default: OpenCode Zen + DeepSeek Flash v4 free tier):

```bash
curl -X POST "http://127.0.0.1:8787/agents" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Support Assistant",
    "handle": "assistant",
    "provider": "custom",
    "model": "deepseek-v4-flash-free",
    "llmBaseUrl": "https://opencode.ai/zen/v1",
    "capabilities": ["chat"]
  }'
```

List, invoke, and inspect runs:

```bash
curl -H "Authorization: Bearer <JWT>" http://127.0.0.1:8787/agents
curl -X POST -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  http://127.0.0.1:8787/agents/<agentId>/invoke \
  -d '{"roomId":"public-demo-room","content":"Give me a short summary"}'
curl -H "Authorization: Bearer <JWT>" \
  "http://127.0.0.1:8787/agents/<agentId>/runs?limit=20"
curl -H "Authorization: Bearer <JWT>" http://127.0.0.1:8787/stats/ai
```

### Ops and SLO

```bash
curl -H "Authorization: Bearer <JWT>" "http://127.0.0.1:8787/stats/ops?minutes=60"
curl -H "Authorization: Bearer <JWT>" "http://127.0.0.1:8787/stats/slo?minutes=60"
curl -H "Authorization: Bearer <JWT>" http://127.0.0.1:8787/stats/launch-kpis
```

Default SLO env vars: `SLO_TARGET_REQUEST_ERROR_RATE` (0.01), `SLO_TARGET_WEBHOOK_SUCCESS_RATE` (0.98), `ALERT_DISPATCH_WEBHOOK_URL`.

### Quotas and pricing (M5-C)

- `QUOTAS_ENABLED` (default `true`), `QUOTA_MESSAGES_PER_MONTH` (50000), `QUOTA_AGENT_INVOKES_PER_MONTH` (1000)
- `GET /stats/costs` — guardrails via `PRICE_PER_MILLION_MESSAGES`, `MIN_GROSS_MARGIN`, etc.

## SDK example

```ts
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useChat } from "@fluxy-chat/react";

const client = new FluxyChatClient({
  baseUrl: "http://127.0.0.1:8787",
  userId: "alice",
  token: "<JWT>",
});

const agents = await client.listAgents();
await client.invokeAgentRest(agents[0].id, "public-demo-room", "Summarize");

const { invokeAgent } = useChat({
  roomId: "public-demo-room",
  client,
  agentId: agents[0].id,
});
await invokeAgent("Draft a reply for this thread");
```

## Examples

- [examples/agent-bot](examples/agent-bot) — server-side bot with streaming via `@fluxy-chat/agent`
