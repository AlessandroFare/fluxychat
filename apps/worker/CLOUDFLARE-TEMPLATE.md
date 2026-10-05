# Cloudflare Workers dashboard template

Not submitted to `cloudflare/templates`. Folder name for a PR there must end in `-template` (e.g. `shared-ai-room-template`), with a 16:9 preview, visible UI, and this Deploy button.

Deploy this Worker:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/AlessandroFare/fluxychat/tree/main/apps/worker)

Gallery UI (humans + agent): `npx @fluxy-chat/create-fluxy-chat@latest my-room --example shared-ai-room`.

## Dashboard copy (when proposing)

- **Title:** Shared AI room on a Durable Object
- **Category:** chat
- **What it is:** One room. Humans and `invokeAgent` share the timeline. Not a copilot sidecar.
- **D1:** `migrations_dir = "db"` — Wrangler apply on first deploy. Confirm the Deploy form runs it.
- **Secrets to prompt:** JWT signing / project `fc_` key, optional LLM key. Do not put PATs in `[vars]`.
- **Bindings:** ROOM, USER, DB, RATE_LIMIT_KV, ATTACHMENTS. AGENT optional. BROWSER off by default.

durable-chat-template in Cloudflare’s gallery is chat-only. This is the humans-and-agents variant.
