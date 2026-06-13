# Features overview

Index of major FluxyChat capabilities. Follow the links for technical detail.

## Chat & realtime (P9–P12)

| Feature | Documentation |
|---------|----------------|
| WebSocket rooms + presence | [Pusher parity](pusher-channels-parity.md) |
| TypeScript / React SDK | [packages/sdk/README.md](../packages/sdk/README.md) |
| Voice + transcription | [thread-summary](thread-summary.md), worker `voice-messages` |
| Public demo | [embed-widget](embed-widget.md) |
| Custom domain | [custom-domain-white-label](custom-domain-white-label.md) |
| Embed widget | [embed-widget](embed-widget.md) |

## AI & automation (P12–P15)

| Feature | Documentation |
|---------|----------------|
| AI Gateway | [ai-gateway](ai-gateway.md) |
| Agent handoff | [ai-agent-handoff](ai-agent-handoff.md) |
| Daily digest | [daily-ai-digest](daily-ai-digest.md) |
| Feature flags | [feature-flags](feature-flags.md) |
| Scheduled workflows | [scheduled-workflows](scheduled-workflows.md) |
| Room memory / AI actions | Worker APIs `/room-memory`, `/ai-actions` |

## Omnichannel & operations (P13, P17)

| Feature | Documentation |
|---------|----------------|
| Telco SMS/WA | [twilio-parity-inspiration](twilio-parity-inspiration.md) |
| Unified inbox | [dashboard-integration](dashboard-integration.md) |
| Agent queue | Console `/agent-queue` |
| FTS search | [competitive-parity-p10](competitive-parity-p10.md) |
| Quiet hours | [quiet-hours-notifications](quiet-hours-notifications.md) |

## Enterprise & compliance (P18–P20)

| Feature | Documentation |
|---------|----------------|
| SSO / SAML / SCIM | `identity-access-http` routes |
| Data classification / retention | `enterprise-compliance` API |
| SOC2 / HIPAA checklist | `/api/soc2`, `/api/hipaa` |
| Audit / eDiscovery | `/audit-export`, `/ediscovery` |
| Incident response | `/incidents` API |

## Integrations (P19–P20)

| Feature | Documentation |
|---------|----------------|
| MCP server | Worker `mcp-http` |
| Slack / Discord / Matrix bridges | `bridge-http` |
| Workflow automation | `workflow-automation` |
| Marketing copy | [marketing/](marketing/) |

## Marketing & go-to-market

- [Outbound email sequence](marketing/outbound-email-sequence.md)
- [Landing page copy](marketing/landing-page-copy.md)
- [Pricing](marketing/pricing-table.md)
- [Enterprise sales script](marketing/enterprise-sales-script.md)

## Next (P21)

| Item | Status |
|------|--------|
| Shared `@fluxychat/protocol` package | Done — event registry, parse/dispatch, contract tests |
| SDK + RN wired to protocol | Done — shared `dispatchInboundWsFrame`, worker validates outbound |
| Cross-SDK contract tests | Done in `packages/protocol` + RN parity test |
| RN SDK tests (vitest) | Done — protocol contract test |
| D1 schema consolidation | Baseline exported — [`db/baseline/0136_schema.sql`](../apps/worker/db/baseline/0136_schema.sql), [`db/README.md`](../apps/worker/db/README.md) |
| Flutter SDK tests | Done — `test/protocol_contract_test.dart` (requires Flutter SDK) |
| Observability and alerting | Done — [`docs/operations/observability.md`](operations/observability.md), `operational-alerts` unit tests |
| Room DO unknown WS events | Done — `room-do.test.js` + `ws-protocol.js` |

See [`packages/protocol/README.md`](../packages/protocol/README.md).
