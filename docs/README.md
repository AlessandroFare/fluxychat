# FluxyChat docs (repository)

Contributor-oriented documentation for the monorepo. **Integrators should use [docs.fluxychat.com](https://docs.fluxychat.com)** (built from `apps/docs`).

**LLM / agent discovery:** [`llms.txt`](./llms.txt) · [`llms-full.txt`](./llms-full.txt)

## Start here

| Topic | Link |
|-------|------|
| Local development | [local-development.md](./local-development.md) |
| Production setup | [operations/production-setup.md](./operations/production-setup.md) |
| Dashboard integration | [dashboard-integration.md](./dashboard-integration.md) |
| Features overview | [features-overview.md](./features-overview.md) |
| Troubleshooting | [troubleshooting.md](./troubleshooting.md) |

## Use cases

- [Support chat](./use-cases/support-chat.md)
- [Team chat](./use-cases/team-chat.md)
- [Assistant room (AI agent)](./use-cases/assistant-room.md)

## Quickstart and cookbooks

- [Ship in-app chat in one afternoon](./quickstart-afternoon.md)
- [Message middleware](./message-middleware.md)
- [Auth / JWT](./cookbook/auth-jwt.md)
- [Bot streaming with FluxyMessageStream](./cookbook/bot-streaming-fluxy-message-stream.md)
- [Transport fallback (WS → SSE → polling)](./cookbook/transport-fallback.md)
- [Public demo hardening](./cookbook/public-demo-hardening.md)

## Realtime parity and reference

- [Pusher Channels parity](./pusher-channels-parity.md)
- [Messaging parity checklist](./reference/messaging-parity-checklist.md) (if moved, see apps/docs)
- [Daily AI digest](./daily-ai-digest.md)
- [AI agent handoff](./ai-agent-handoff.md)
- [Custom domain white-label](./custom-domain-white-label.md)
- [Web Push (VAPID)](./web-push-vapid.md)

## Operations

- [Environment setup](./operations/environment-setup.md)
- [Operations index](./operations/README.md)
- [Staging and status page](./operations/staging-and-status.md)
- [Hosted multi-tenant](./operations/hosted-multi-tenant.md)
- [Observability and cron](./operations/observability.md)
- [Agent tool exfiltration (trust model)](./security/agent-tool-exfiltration.md)
- Deploy / rollback: [RUNBOOK_DEPLOY_ROLLBACK.md](../RUNBOOK_DEPLOY_ROLLBACK.md)

## AI-native guides (also on public docs)

- [Adapter pattern](./guides/adapter-pattern.md)
- [Streaming markdown](./guides/streaming-markdown.md)
- [Card builder](./guides/card-builder.md)
- [AI tool presets](./guides/ai-tool-presets.md)
- [Stream resumption](./guides/stream-resumption.md)
- [LLM middleware](./guides/llm-middleware.md)
- [MCP client](./guides/mcp-client.md)
- [WorkflowAgent](./guides/workflow-agent.md)

## Marketing and distribution

- [Marketing assets](./marketing/)
- [Distribution index](./distribution/README.md)

## Internal roadmaps (contributors)

- [Portal Hackathon Roadmap 2026](./PORTAL-HACKATHON-ROADMAP-2026.md): patterns from 35 Portal hackathon builds (PH-*)
- [Next Wave Roadmap 2026](./NEXT-WAVE-ROADMAP-2026.md)
- [Beat Portal roadmap](./BEAT-PORTAL-ROADMAP.md)
- [Portal zero-budget Phase 2](./PORTAL-ZERO-BUDGET-ROADMAP.md)

Production audit snapshots stay in this repo only. Public docs use stubs in `apps/docs` where needed.

## Research (local clones, not shipped)

See [research/README.md](./research/README.md). Vendored upstream repos for comparison only.

## Internal only

Production audit snapshots and roadmaps are **not** public docs. Use `apps/docs` stubs or keep material in this repo for contributors.
