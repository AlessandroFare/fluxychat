# @fluxy-chat/config

Type-safe **`fluxy.config.ts`** authoring for FluxyChat (Portal `@portalsdk/config` parity).

## Install

```bash
pnpm add -D @fluxy-chat/config
```

## Quick start

Create `fluxy.config.ts` at your worker project root:

```ts
import { defineConfig, allow, block, defineMiddleware, allowPublish } from "@fluxy-chat/config";

const moderate = defineMiddleware("publish", (ctx) => {
  if (!ctx.capabilities.publish) {
    return { action: "block", reason: "You cannot post here." };
  }
  return allowPublish();
});

export default defineConfig({
  client: {
    readOn: "visible",
    wsCache: "on",
    historyLimit: 50,
  },
  rooms: {
    "support-*": {
      anonymous: false,
      authz: (ctx) => (ctx.anonymous ? block("Sign in first.") : allow({ publish: true })),
      onPublish: [moderate.handler],
    },
    "room-*": { anonymous: true, onPublish: [moderate.handler] },
  },
});
```

Wire it in the Worker (this repo: `apps/worker/fluxy.config.js` → bundled by Wrangler).

## What you can configure

| Area | Portal equivalent | Fluxy field |
|------|-------------------|-------------|
| Room templates `room-*` | `channels` | `rooms` |
| Anonymous access | `anonymous` | `rooms.*.anonymous` |
| Connect authz | `authz` | `rooms.*.authz` |
| Message middleware | `onPublish` | `rooms.*.onPublish` |
| Disconnect hooks | `onDisconnect` | `rooms.*.onDisconnect` |
| SDK defaults | — | `client` (via `GET /config/client`) |

## Client defaults

The worker exposes merged defaults:

```
GET /config/client
→ { client: { readOn, wsCache, historyLimit, ... }, source: "fluxy.config" }
```

Use in your app to align `useChat` options with server policy.

## Self-hosted vs Portal hosted

Portal runs config callbacks on their cloud. Fluxy runs yours **inside your Worker** — same API shape, you own execution and secrets (Wrangler vars / secrets instead of `portal secrets set`).
