# Fluxychat Docs

Documentazione orientata ai casi d’uso (M5-B).

## Use cases

- [Support chat](./use-cases/support-chat.md)
- [Team chat](./use-cases/team-chat.md)
- [Assistant room (AI agent)](./use-cases/assistant-room.md)

## Cookbooks

- [Auth / Token / JWT (role-based)](./cookbook/auth-jwt.md)

## Dashboard app

- [Session, operator pages, GDPR & SDK transport](./dashboard-integration.md)
- [Stripe billing runbook](./billing-stripe-runbook.md)
- [Billing overage policy](./billing-overage-policy.md)

## Troubleshooting

- [Troubleshooting guide](./troubleshooting.md)

## Performance

- [Performance verification & benchmark](./performance-benchmark.md)

## M6 rollout & pilot

- [Checklist deploy, smoke, pilot, benchmark (M6-A / M6-D)](./m6-operational-checklist.md)
- [Pilot / feedback / GTM (M6-C)](./m6-pilot-gtm-playbook.md)

## SPEC & prodotto

- [Mappa endpoint SPEC §5 / §6 ↔ Worker](./spec-implementation-map.md)
- [Snippet positioning / ICP per landing](./product-landing-snippet.md)

## Snippets

- [Next.js end-to-end (App Router)](./snippets/nextjs-end-to-end.md)

## Contract policy

- [Public contract & changelog policy](./contract-policy.md)

## Release

- [Demo script (10-12 min)](./release/demo-script.md)
- [Release notes v0.2.0 (suggested)](./release/release-notes-v0.2.0.md)

## Prerequisiti comuni

- **Base URL**: `FLUXY_BASE_URL` (dev: `http://127.0.0.1:8787`)
- **API key**: `X-Fluxy-Api-Key: fc_...` (server-to-server)
- **JWT**: `Authorization: Bearer <JWT>` (client/SDK)

Per mintare un JWT:

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

