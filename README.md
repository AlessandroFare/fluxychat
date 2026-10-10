# FluxyChat

People and agents in the same room: chat, shared docs, tool calls. MIT Worker on your Cloudflare account, or hosted beta.

> **Open beta.** Self-host is MIT. [Try hosted](https://fluxychat.com) · [Guides](https://fluxychat.com/guides) · [Compare](https://fluxychat.com/compare) · [Public docs](https://docs.fluxychat.com) · [npm SDK](https://www.npmjs.com/package/@fluxy-chat/sdk) · **Support:** support@fluxychat.com · **Founder:** founder@fluxychat.com

## Quick links

| What | Where |
|------|-------|
| Try hosted | [fluxychat.com](https://fluxychat.com) |
| Public documentation | [docs.fluxychat.com](https://docs.fluxychat.com) |
| Status and limits | [docs/learn/status-and-limits](https://docs.fluxychat.com/docs/learn/status-and-limits) |
| Operator console | `apps/dashboard` → start at `/onboarding` |
| SDK (npm) | [@fluxy-chat/sdk](https://www.npmjs.com/package/@fluxy-chat/sdk) |
| React hooks | [@fluxy-chat/react](https://www.npmjs.com/package/@fluxy-chat/react) |
| Worker API | `apps/worker` · deploy with Wrangler |
| Repo docs index | [docs/README.md](docs/README.md) · [Features overview](docs/features-overview.md) |
| Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Public 90-day list | [docs/public-roadmap.md](docs/public-roadmap.md) |
| Releasing | [RELEASING.md](RELEASING.md) |

## What you get

- **Realtime:** rooms, presence, Yjs (second binary socket), SSE/polling as `degraded-http`, inbox
- **AI:** `invokeAgent` writes the room timeline. Copilot UI is a side panel you wire to your model.
- **Ingest:** HTTP IoT/fleet fan-out (`iot.reading`, `fleet.gps_update`). Not MQTT.
- **Enterprise:** SSO/SCIM and audit exist on **self-host**. Hosted login does **not** include SAML. SOC 2/HIPAA checklists in-repo are not attestations.
- **Bridges:** you create the Slack, Discord, Telegram, WhatsApp, or Teams app. This is not a 14-channel helpdesk. We do not sell a WhatsApp channel. Widget: `@fluxy-chat/ui-kit`. MCP is in the repo.

**Stack:** Cloudflare Workers + Durable Objects (WebSocket, presence) · D1 SQLite at the edge (messages, metadata) · Next.js dashboard · `@fluxy-chat/sdk` + `@fluxy-chat/react`.

## Get started

### Fastest path: public room with pk_

```tsx
import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/react";

<FluxyRealtimeProvider
  workerUrl="https://api.fluxychat.com"
  publishableKey="pk_..."
>
  <Chat />
</FluxyRealtimeProvider>

function Chat() {
  const { messages, sendMessage } = useChat({ roomId: "your-public-room" });
  return (
    <>
      <ul>
        {messages.map((message) => (
          <li key={message.id}>{message.content}</li>
        ))}
      </ul>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const input = event.currentTarget.elements.namedItem("body") as HTMLInputElement;
          void sendMessage(input.value);
          event.currentTarget.reset();
        }}
      >
        <input name="body" />
        <button type="submit">Send</button>
      </form>
    </>
  );
}
```

`fc_` stays on the server. `pk_` mints an anonymous JWT (`POST /tokens/anonymous`). Pin `@fluxy-chat/sdk@0.6.15` and `@fluxy-chat/react@0.1.9`.

### Deploy the Worker to your Cloudflare account

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/AlessandroFare/fluxychat/tree/main/apps/worker)

The button reads `apps/worker/wrangler.toml`. It can create D1 (migrations in `apps/worker/db`), KV, R2, and optional Vectorize. Replace the pasted `database_id` / KV ids if the form does not. **Secrets** (not `[vars]`): `JWT_SECRET` or per-project D1 secrets, `X-Fluxy-Api-Key` material, optional `AI_API_KEY`, ticket PATs. Hyperdrive is unused. Preview: [template notes](apps/worker/CLOUDFLARE-TEMPLATE.md). Hosted at fluxychat.com is a different account.

GitHub About (paste in the repo UI): Room layer on Cloudflare. Chat, presence, Yjs, and agents on one Durable Object. MIT self-host or hosted beta.

### Alternative: public room widget

```bash
pnpm add @fluxy-chat/ui-kit @fluxy-chat/ui @fluxy-chat/react @fluxy-chat/sdk
```

```tsx
import { FluxyChatWidget } from "@fluxy-chat/ui-kit";

<FluxyChatWidget workerUrl="https://api.fluxychat.com" roomId="your-public-room" guest publishableKey="pk_..." />
```

No JWT mint. The room must be public. Two browser tabs to see presence.

### Hosted CLI (no wrangler)

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-app --mode hosted -y
cd my-app && pnpm install && pnpm setup:hosted && pnpm dev
```

Uses the public demo on [api.fluxychat.com](https://api.fluxychat.com). Chat plus FluxyBot in about a minute.

### Full stack, local worker

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-app --full -y
cd my-app

# Terminal 1: from a FluxyChat monorepo checkout (or self-host worker)
pnpm --filter @fluxy-chat/worker dev

# Terminal 2: in my-app
pnpm install
pnpm setup    # provision project, JWT, @assistant into .env
pnpm dev      # Vite + optional dashboard if monorepo nearby
```

Chat + realtime + `@assistant` + tool thread in one Vite app. See [choose your path](apps/docs/content/docs/getting-started/choose-your-path.mdx) and [one-click roadmap](docs/ONE-CLICK-PRODUCT-ROADMAP.md).

### Monorepo contributor path

```bash
git clone https://github.com/AlessandroFare/fluxychat
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

1. Open `/onboarding` in the dashboard for project, JWT, and first room
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
| `apps/dashboard` | Next.js: marketing, operator console, onboarding, analytics, billing |
| `apps/worker` | Cloudflare Worker: WebSocket, REST, Durable Objects |
| `apps/docs` | Fumadocs documentation site (published at docs.fluxychat.com) |
| `apps/ai-agent` | Optional AI agent service (mention webhooks → LLM → room replies) |
| `apps/status` | Status page app |
| `packages/sdk` | TypeScript client (`FluxyChatClient`, transport, REST helpers) |
| `packages/react` | React hooks (`useChat`, `useInbox`, `FluxyRealtimeProvider`) |
| `packages/ui` | Headless, themeable chat UI components |
| `packages/protocol` | Shared WebSocket event types |
| `packages/agent` | Server-side bot / streaming helpers |

## SDK pieces

Public docs: [docs.fluxychat.com](https://docs.fluxychat.com/packages/sdk).

| Area | What is actually there |
|------|------------------------|
| Bridges | Slack, Discord, Telegram, WhatsApp, Teams. You create the vendor app. |
| AI | `invokeAgent` on the room timeline, HITL, MCP |
| npm | `@fluxy-chat/sdk`, `react`, `ui`, `ui-kit`, `vue`, `svelte`, `agent`, `protocol`, `config`. Pin versions. Pre-1.0. |

How to publish: [RELEASING.md](RELEASING.md).

## Documentation

| Topic | Link |
|-------|------|
| Docs home (repo) | [docs/README.md](docs/README.md) |
| Local dev | [docs/local-development.md](docs/local-development.md) |
| Dashboard | [docs/dashboard-integration.md](docs/dashboard-integration.md) |
| Self-host | [docs/self-hosting.md](docs/self-hosting.md) |
| Examples | [examples/README.md](examples/README.md) |

## Operations

- Deploy / rollback: [RUNBOOK_DEPLOY_ROLLBACK.md](RUNBOOK_DEPLOY_ROLLBACK.md)
- Tenant recovery drill: `apps/worker/scripts/tenant-recovery-drill.mjs`
- Post-deploy smoke: `cd apps/worker && pnpm run smoke:remote -- --base-url … --admin-jwt …`

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

Public path is **`/agents`**. Old **`/bots`** routes still answer.

The create example below uses OpenCode Zen (a third-party free model). Fine for a laptop demo. For hosted traffic, set your own `llmBaseUrl` and key. Do not treat Zen as a production SLA.

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

### Quotas and pricing

- `QUOTAS_ENABLED` (default `true`), `QUOTA_MESSAGES_PER_MONTH` (200000), `QUOTA_AGENT_INVOKES_PER_MONTH` (5000). Hosted Free matches these defaults.
- `GET /stats/costs` with guardrails via `PRICE_PER_MILLION_MESSAGES`, `MIN_GROSS_MARGIN`, etc.

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

## Why not build this on Durable Objects yourself?

You can. A room object and a WebSocket is a weekend. Then you still need tenancy, JWT, D1 history, GDPR export, Bridges, tool approvals, and a console. I wrote that up here: [Durable Objects for chat rooms](https://fluxychat.com/guides/durable-objects-for-chat-rooms).

## Examples

- [examples/agent-bot](examples/agent-bot): server-side bot, streaming, `@fluxy-chat/agent` on npm
- Shared-ai-room, war-room, and deal-room starters: `packages/create-fluxy-chat/templates/` (not copied into `examples/` yet)
