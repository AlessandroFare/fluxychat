# FluxyChat full stack starter

Chat + AI agent in a Vite app. Hosted mode signs you in with Clerk (same as the console), then creates your project and assistant room.

## Quick start

**Hosted (Clerk, no wrangler):**

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-app --mode hosted -y
cd my-app
pnpm install
pnpm setup:hosted
pnpm dev
```

The app opens on localhost. Click Continue with FluxyChat, sign in, then you land in your own room (not the public playground).

**Local worker:**

```bash
pnpm --filter @fluxy-chat/worker dev
npx @fluxy-chat/create-fluxy-chat@latest my-app --full -y
cd my-app
pnpm install
pnpm setup
pnpm dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm setup:hosted` | Writes worker + console URLs. Auth happens in the browser via Clerk. |
| `pnpm setup:local` | Local `/dev/provision` |
| `pnpm doctor` | Health check |
| `pnpm dev` | Start Vite |

## Environment

`.env` from `pnpm setup:hosted` only needs worker and console URLs. Member JWT, room, and agent come from Clerk after sign in.

Open console: [fluxychat.com/onboarding](https://fluxychat.com/onboarding)

## Learn more

- [Docs](https://docs.fluxychat.com)
