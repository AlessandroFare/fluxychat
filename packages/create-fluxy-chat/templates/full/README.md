# FluxyChat full stack starter

Chat + AI agent in a Vite app. Hosted mode starts with a short local tour, then Clerk, then your own room.

## Quick start

**Hosted (no wrangler):**

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-app --mode hosted -y
cd my-app
pnpm install
pnpm setup:hosted
pnpm dev
```

Localhost opens a 3-step tour. Last step is sign in. After Clerk you come back to a simple chat. Open a second tab to try realtime. Use Open dashboard for rooms and agents.

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
| `pnpm setup:hosted` | Writes worker + console URLs. Auth happens in the browser via Clerk. |
| `pnpm setup:local` / `pnpm setup:self-host` | `POST /dev/provision` on your Worker |
| `pnpm doctor` | Health check |
| `pnpm dev` | Start Vite |

## Environment

`.env` from `pnpm setup:hosted` only needs worker and console URLs. Member JWT, room, and agent come from Clerk after sign in.

Dashboard: [fluxychat.com/dashboard](https://fluxychat.com/dashboard)

## Learn more

- [Docs](https://docs.fluxychat.com)
