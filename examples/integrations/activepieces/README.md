# FluxyChat Activepieces piece

Custom piece for **self-hosted Activepieces** (MIT, free). No marketplace publish required.

## Triggers (webhook)

| Trigger | FluxyChat event |
|---------|-----------------|
| New message | `message.created` |
| Agent handoff | `handoff.requested` |

Register the Activepieces webhook URL in **Console → Webhooks** for your project. Verify `X-Fluxy-Signature` with the shared secret.

## Actions

| Action | API |
|--------|-----|
| Send message | `POST /rooms/:id/messages` |
| Create room | `POST /admin/rooms` |

## Install in Activepieces

1. Self-host: `docker compose up` from [activepieces/activepieces](https://github.com/activepieces/activepieces)
2. **Settings → Pieces → Add custom piece** → point at this `src/` folder (or build & upload)
3. Dashboard embed: `/settings/integrations` + `NEXT_PUBLIC_ACTIVEPIECES_EMBED_URL`

See `docs/integrations/activepieces.md` and `docs/PRODUCTION-SETUP.md`.
