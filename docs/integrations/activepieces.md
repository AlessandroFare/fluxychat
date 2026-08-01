# Activepieces integration (CRM / automation)

Use **Activepieces** (MIT, self-hostable) to run no-code automations when FluxyChat events fire — sync to CRM, notify Slack, update Notion.

## Important: embed vs external dashboard

| Approach | Cost | FluxyChat status |
|----------|------|------------------|
| **Self-host + use Activepieces UI directly** | Free (MIT) | ✅ Recommended |
| **Custom FluxyChat piece (webhooks + actions)** | Free | ✅ Supported |
| **Iframe embed inside FluxyChat console** | Enterprise / custom license | ❌ Not used (zero-budget) |

Activepieces [embedding](https://www.activepieces.com/docs/embedding/overview) is an **enterprise feature** for white-label / multi-tenant embed. Self-hosting the OSS core is free for **your own** automations, but embedding Activepieces inside the FluxyChat dashboard requires a separate embed license.

**Our approach:** Console → **Settings → Automation integrations** opens your Activepieces instance in a **new tab** (`automation.yourdomain.com`), not an iframe.

---

## Architecture

```
FluxyChat Worker webhooks  →  Activepieces Webhook trigger
Activepieces action        →  FluxyChat REST / admin API
Operator                   →  Activepieces web UI (separate tab)
```

Activepieces runs **outside** Cloudflare Workers.

---

## Self-host setup (free)

### Prerequisites

- VPS with Docker
- Subdomain DNS A record, e.g. `automation.fluxychat.com` → VPS IP
- HTTPS reverse proxy (Caddy recommended — automatic Let's Encrypt)

### Install

```bash
mkdir -p /opt/activepieces && cd /opt/activepieces
git clone https://github.com/activepieces/activepieces .

# Generate secrets
openssl rand -hex 16   # → AP_ENCRYPTION_KEY
openssl rand -hex 32   # → AP_JWT_SECRET
openssl rand -hex 16   # → AP_POSTGRES_PASSWORD
```

Create `.env` (names match official docker-compose):

```text
AP_FRONTEND_URL=https://automation.fluxychat.com
AP_POSTGRES_DATABASE=activepieces
AP_POSTGRES_USERNAME=ap_user
AP_POSTGRES_PASSWORD=<from openssl above>
AP_POSTGRES_HOST=postgres
AP_POSTGRES_PORT=5432
AP_REDIS_HOST=redis
AP_REDIS_PORT=6379
AP_ENCRYPTION_KEY=<from openssl above>
AP_JWT_SECRET=<from openssl above>
AP_SIGN_UP_ENABLED=false
```

```bash
docker compose up -d
```

### HTTPS with Caddy (example)

```text
automation.fluxychat.com {
    reverse_proxy localhost:8080
}
```

Point Activepieces container port 80/8080 per their compose file.

### Dashboard link (not embed)

Set in Vercel / dashboard env:

```text
NEXT_PUBLIC_ACTIVEPIECES_URL=https://automation.fluxychat.com
```

Users click **Open automation studio** in **Settings → Automation integrations** — opens Activepieces in a new tab.

**Do not set** `NEXT_PUBLIC_ACTIVEPIECES_EMBED_URL` unless you have an enterprise embed license.

---

## FluxyChat custom piece

Code: `examples/integrations/activepieces/src/`

| Trigger | FluxyChat event |
|---------|-----------------|
| New message | `message.created` |
| Agent handoff | `handoff.requested` |

| Action | API |
|--------|-----|
| Send message | `POST /rooms/:id/messages` |
| Create room | Admin rooms API |

### Install piece in Activepieces

1. **Settings → Pieces → Add custom piece** → path to `examples/integrations/activepieces/src/`
2. Or build and upload per Activepieces custom piece docs

### Webhooks

1. FluxyChat **Console → Webhooks** → register outbound URL from Activepieces flow
2. Verify `X-Fluxy-Signature` with shared secret in Activepieces connection

### API key (automations)

Activepieces **Platform Admin → Security → API Keys** — use for server-side calls from FluxyChat piece actions (not for dashboard embed).

---

## CRM adapters today

KV stubs: `apps/worker/src/lib/crm-adapters.js`. Activepieces replaces bespoke CRM glue with user-configurable flows.

---

## References

- [Activepieces docs](https://www.activepieces.com/docs/overview/welcome)
- [Embedding (enterprise)](https://www.activepieces.com/docs/embedding/overview)
- [PRODUCTION-SETUP.md](../PRODUCTION-SETUP.md)
- Piece README: `examples/integrations/activepieces/README.md`
