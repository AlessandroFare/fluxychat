# Fluxychat Docs

Use-case oriented documentation.

**LLM / agent discovery:** [`llms.txt`](./llms.txt) · [`llms-full.txt`](./llms-full.txt) (index + bundle, Sent-style)

## Security & audit

- [Production due diligence audit (2026-06-15)](./audit/production-due-diligence-2026-06-15.md)
- [Remediation tracker](./audit/REMEDIATION.md)
- [M6 security review](./security-review-m6.md)

## Overview

- [Features overview (P12–P20)](./features-overview.md)
- [Marketing: email, landing, pricing, enterprise script](./marketing/)

## Use cases

- [Support chat](./use-cases/support-chat.md)
- [Team chat](./use-cases/team-chat.md)
- [Assistant room (AI agent)](./use-cases/assistant-room.md)

## Quickstart

- [Ship in-app chat in one afternoon](./quickstart-afternoon.md)
- [Message middleware (validate / filter / enrich)](./message-middleware.md)

## Realtime parity

- [Pusher Channels parity (P9)](./pusher-channels-parity.md) — rooms, presence, user channel, E2E, webhooks, public channels
- [Competitive parity P10 (Sendbird, Sent.dm, Pusher gaps)](./competitive-parity-p10.md)
- [Twilio inspiration map (Messaging, Verify, Conversations)](./twilio-parity-inspiration.md)
- [Daily AI digest (P12-F)](./daily-ai-digest.md)
- [AI agent + human handoff (P12-H)](./ai-agent-handoff.md)
- [Custom domain white-label (P12-G)](./custom-domain-white-label.md)
- [Web Push (VAPID) + Pusher Beams parity](./web-push-vapid.md) — self-hosted browser push, RFC 8292 / 8188 / 8291, no Pusher dependency

## Cookbooks

- [Auth / Token / JWT (role-based)](./cookbook/auth-jwt.md)
- [Node bot streaming with FluxyMessageStream](./cookbook/bot-streaming-fluxy-message-stream.md)
- [Transport fallback (WS → SSE → polling)](./cookbook/transport-fallback.md)
- [Message templates & member preferences](./cookbook/message-templates.md)
- [Offline notify: in-app + Sent.dm SMS/WhatsApp](./cookbook/offline-notify-sent-dm.md)
- [US SMS compliance playbook (10DLC, STOP, opt-in)](./operations/us-sms-compliance-playbook.md)
- [Public demo & guest token hardening](./cookbook/public-demo-hardening.md)

### Beta console features (open beta)

- Agent chat: tool_call / tool_result / tool_error in-thread, run banner, reply-to, replay toggle
- Agent profile: prompt templates, fallback provider/model
- Rooms page: embedded assistant room chat

## Dashboard app

- [Session, operator pages, GDPR & SDK transport](./dashboard-integration.md)
- [Custom domains: Vercel + Cloudflare Worker + Clerk](./hosted-domains.md)
- [Stripe billing runbook](./billing-stripe-runbook.md)
- [Billing overage policy](./billing-overage-policy.md)

## Troubleshooting

- [Troubleshooting guide](./troubleshooting.md)

## Performance

- [Performance verification & benchmark](./performance-benchmark.md)

## Operations

- [**Environment setup**](./operations/environment-setup.md) — **configure local / staging / production**
- [**Operations index**](./operations/README.md) — deploy, staging, status, multi-tenant, cron
- [**Open beta deploy guide**](./operations/open-beta-deploy-guide.md)
- [**Staging & status page**](./operations/staging-and-status.md)
- [**Hosted multi-tenant**](./operations/hosted-multi-tenant.md)
- [**Observability & cron**](./operations/observability.md)
- [Production: demo Turnstile + Sent.dm SMS](./operations/production-demo-and-sms.md)
- [US SMS compliance (10DLC, STOP)](./operations/us-sms-compliance-playbook.md)
- [Agent tool exfiltration (tenant admin trust model)](./security/agent-tool-exfiltration.md)

## P22–P25 guides (AI-native architecture)

- [Adapter pattern (P22-A)](./guides/adapter-pattern.md) — Multi-platform adapter interface (14 platforms)
- [Streaming markdown (P22-B)](./guides/streaming-markdown.md) — Table buffering, code fence tracking, inline marker healing
- [Card builder (P22-C)](./guides/card-builder.md) — JSX + function API for rich interactive messages
- [AI tool presets (P22-D)](./guides/ai-tool-presets.md) — Reader/messenger/moderator presets with approval gates
- [Stream resumption (P23-1)](./guides/stream-resumption.md) — Reconnect to in-progress AI streams
- [LLM middleware (P23-4)](./guides/llm-middleware.md) — Pluggable pipeline for guardrails, caching, RAG
- [MCP client (P23-3)](./guides/mcp-client.md) — Consume external MCP tool servers
- [WorkflowAgent (P23-6)](./guides/workflow-agent.md) — Durable agent execution that survives restarts

## P12 / P13 feature docs

- [Daily AI digest (P12-F)](./daily-ai-digest.md)
- [Embed widget (P12-A)](./embed-widget.md)
- [Thread TL;DR (P12-M)](./thread-summary.md)
- [Quiet hours (P12-N)](./quiet-hours-notifications.md)
- [Room export (P12-O)](./room-export.md)
- [AI Gateway (P12-I)](./ai-gateway.md)
- [Feature flags (P12-J)](./feature-flags.md)
- [Browser Run OG (P12-K)](./browser-run.md)
- [Scheduled Workflows (P12-L)](./scheduled-workflows.md)
- [Twilio inspiration / P13](./twilio-parity-inspiration.md)

## M6 rollout & pilot

- [Checklist deploy, smoke, pilot, benchmark (M6-A / M6-D)](./m6-operational-checklist.md)

## SPEC & product

- [SPEC §5 / §6 endpoint map ↔ Worker](./spec-implementation-map.md)

## Marketing & distribution

- [Distribution index (live Dev.to, compare, guide URLs)](./distribution/README.md)
- [Dev.to article source draft](./distribution/devto-realtime-chat-cloudflare-workers.md)

## Research (local clones, not shipped)

- [Research index & cloned repos](./research/README.md)
- [Synthesis + prioritized backlog](./research/fluxychat-research-synthesis.md)
- [WS client benchmark (Fluxy-bot vs SDK)](./research/ws-client-benchmark-fluxy.md)
- [Chatsemble concepts (GPL, no import)](./research/chatsemble-concepts.md)

## Snippets

- [Next.js end-to-end (App Router)](./snippets/nextjs-end-to-end.md)

## Contract policy

- [Public contract & changelog policy](./contract-policy.md)

## Release

- [Release notes v0.2.0 (suggested)](./release/release-notes-v0.2.0.md)

## Common prerequisites

- **Base URL**: `FLUXY_BASE_URL` (dev: `http://127.0.0.1:8787`)
- **API key**: `X-Fluxy-Api-Key: fc_...` (server-to-server)
- **JWT**: `Authorization: Bearer <JWT>` (client/SDK)

Mint a JWT:

```bash
curl -X POST "$FLUXY_BASE_URL/auth/token" \
  -H "Content-Type: application/json" \
  -H "X-Fluxy-Api-Key: fc_your_api_key" \
  -d '{
    "userId": "alice",
    "roles": ["member"],
    "ttlSeconds": 3600
  }'
```

