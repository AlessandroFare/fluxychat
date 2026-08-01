# FluxyChat Activepieces piece

Custom piece for **self-hosted Activepieces** (MIT, free). No marketplace publish required.

## Triggers (webhook)

| Trigger | FluxyChat event |
|---------|-----------------|
| New message | `message.created` |
| Agent handoff | `handoff.requested` |

Register the Activepieces webhook URL in **Console → Webhooks**. Verify `X-Fluxy-Signature` with the shared secret.

## Actions

| Action | API |
|--------|-----|
| Send message | `POST /rooms/:id/messages` |
| Create room | `POST /admin/rooms` |

## Install in Activepieces

1. Self-host per [docs/integrations/activepieces.md](../../docs/integrations/activepieces.md)
2. **Settings → Pieces → Add custom piece** → `examples/integrations/activepieces/src/`
3. FluxyChat dashboard: set `NEXT_PUBLIC_ACTIVEPIECES_URL` → **Settings → Automation integrations** opens studio in new tab

**Note:** Iframe embed (`NEXT_PUBLIC_ACTIVEPIECES_EMBED_URL`) is not used — Activepieces embedding is enterprise-licensed.

See also `docs/PRODUCTION-SETUP.md`.
