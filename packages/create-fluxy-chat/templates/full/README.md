# FluxyChat full stack starter

Chat + AI agent in a Vite app. Hosted: `pnpm setup:hosted` writes a public `pk_` when the Worker exposes `GET /public/demo-credentials`. Otherwise copy a `pk_` from the console, or sign in for a private assistant room.

## Quick start

**Hosted (no wrangler):**

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-app --mode hosted -y
cd my-app
pnpm install
pnpm setup:hosted
pnpm dev
```

If demo credentials are configured on the Worker, chat starts with `publishableKey` (no Clerk). Sign in later for a private assistant room.

**Hosted overlay (one file deploy for deny / rooms / extension slots):**

```bash
# fluxy.hosted.json → PUT /admin/projects/:id/publish-config
FLUXY_WORKER_URL=https://api.fluxychat.com FLUXY_ADMIN_JWT=eyJ... FLUXY_PROJECT_ID=prj_... pnpm fluxy:deploy
```

This is not Worker-bundled `onPublish` callbacks. Those run in `fluxy.config.ts` on self-host. Hosted extension slots are declared `kv` / `counter` on the room Durable Object (`GET /rooms/:id/extensions`).

**Self-host (your Worker):**

```bash
# In the FluxyChat repo
pnpm run self-host
pnpm --filter @fluxy-chat/worker dev

# In another terminal
npx @fluxy-chat/create-fluxy-chat@latest my-app --mode self-host
cd my-app
pnpm install
pnpm setup:local
pnpm dev
```

If the Worker is down, `setup:local` asks for the URL. Merge `.fluxy/worker.dev.vars` into `apps/worker/.dev.vars` (Groq key + `ALLOW_DEV_PROVISION=true`).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm setup:hosted` | Worker URL + public `pk_` when `/public/demo-credentials` is configured |
| `pnpm fluxy:deploy` | PUT hosted publish-config from `fluxy.hosted.json` |
| `pnpm setup:local` / `pnpm setup:self-host` | `POST /dev/provision` on your Worker |
| `pnpm doctor` | Health check |
| `pnpm dev` | Start Vite |

## Environment

`.env` from `pnpm setup:hosted` includes worker URL and, when configured, `VITE_FLUXYCHAT_PUBLISHABLE_KEY`. Clerk still creates a private assistant room.

Dashboard: [fluxychat.com/dashboard](https://fluxychat.com/dashboard)

## Learn more

- [Docs](https://docs.fluxychat.com)
