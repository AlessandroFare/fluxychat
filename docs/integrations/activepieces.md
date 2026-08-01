# Activepieces integration (CRM / automation)

Use **Activepieces** (MIT) to embed no-code automation beside FluxyChat helpdesk flows — e.g. sync tickets to CRM, notify Slack, update Notion.

## Architecture

```
FluxyChat Worker webhooks  →  Activepieces trigger
Activepieces action        →  FluxyChat REST / admin API
Dashboard (optional)       →  Activepieces embed SDK (JWT)
```

Activepieces runs **outside** Cloudflare Workers. The Worker exposes signed webhooks; Activepieces pieces call back with API keys.

## Embedding in dashboard

1. Self-host or use [Activepieces Cloud](https://www.activepieces.com/docs/overview/welcome).
2. Enable [embedding](https://www.activepieces.com/docs/embedding/overview) and mint JWT for your tenant admin.
3. Add an iframe route in dashboard (POC: `apps/dashboard/app/automation/` when enabled).

```tsx
// Pseudocode — use @activepieces/piece-framework embed SDK per their docs
<ActivepiecesEmbed jwt={tenantEmbedJwt} projectId={projectId} />
```

## FluxyChat piece (custom)

Build an Activepieces piece with:

| Trigger | Source |
|---------|--------|
| New message | Worker webhook `message.created` |
| Room created | Worker webhook `room.created` |
| Agent handoff | Worker webhook `handoff.requested` |

| Action | Target |
|--------|--------|
| Send message | `POST /rooms/:id/messages` |
| Create room | Admin rooms API |

Store webhook signing secret in Activepieces connection; verify `X-Fluxy-Signature` in trigger handlers.

## CRM adapters today

KV stubs live in `apps/worker/src/lib/crm-adapters.js`. Activepieces replaces bespoke CRM glue with user-configurable flows.

## References

- [Activepieces docs](https://www.activepieces.com/docs/overview/welcome)
- [Embedding overview](https://www.activepieces.com/docs/embedding/overview)
