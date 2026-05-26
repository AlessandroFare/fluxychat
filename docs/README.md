# Fluxychat Docs

Use-case oriented documentation.

**LLM / agent discovery:** [`llms.txt`](./llms.txt) · [`llms-full.txt`](./llms-full.txt) (index + bundle, Sent-style)

## Use cases

- [Support chat](./use-cases/support-chat.md)
- [Team chat](./use-cases/team-chat.md)
- [Assistant room (AI agent)](./use-cases/assistant-room.md)

## Cookbooks

- [Auth / Token / JWT (role-based)](./cookbook/auth-jwt.md)
- [Node bot streaming with FluxyMessageStream](./cookbook/bot-streaming-fluxy-message-stream.md)
- [Transport fallback (WS → SSE → polling)](./cookbook/transport-fallback.md)
- [Message templates & member preferences](./cookbook/message-templates.md)

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

## M6 rollout & pilot

- [Checklist deploy, smoke, pilot, benchmark (M6-A / M6-D)](./m6-operational-checklist.md)

## SPEC & product

- [SPEC §5 / §6 endpoint map ↔ Worker](./spec-implementation-map.md)

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
