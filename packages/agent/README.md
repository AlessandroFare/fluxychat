# @fluxy-chat/agent

Server-side agent SDK for [FluxyChat](https://github.com/AlessandroFare/fluxychat): WebSocket bots, message streaming, `waitFor`, and optional AI provider helpers.

Use this package in **Node.js**, **Cloudflare Workers**, or any server runtime. For browser/React apps, use [`@fluxy-chat/sdk`](https://www.npmjs.com/package/@fluxy-chat/sdk) and [`@fluxy-chat/react`](https://www.npmjs.com/package/@fluxy-chat/react).

## Install

```bash
pnpm add @fluxy-chat/agent @fluxy-chat/sdk
```

## Quick start

```ts
import { createFluxyAgent } from "@fluxy-chat/agent";

const agent = await createFluxyAgent({
  baseUrl: process.env.FLUXY_WORKER_URL!,
  id: "support-bot",
  apiKey: process.env.FLUXY_API_KEY!,
});

const room = await agent.join("support-general");

room.on("message", async (msg) => {
  if (msg.userId === agent.id) return;
  await room.reply(`You said: ${msg.content}`);
});
```

## Features

| Area | API |
|------|-----|
| Bot lifecycle | `createFluxyAgent`, `FluxyAgent`, `FluxyRoom` |
| Token minting | `mintWorkerToken` |
| Streaming replies | `FluxyMessageStream`, `waitFor` |
| AI providers | `AIProviderRegistry`, `retryAI`, middleware helpers |
| Tool / HITL flows | Re-exports from SDK where shared |

## Configuration

| Variable | Purpose |
|----------|---------|
| `baseUrl` | Your FluxyChat Worker URL |
| `id` | Stable bot user id |
| `apiKey` | Project API key (`fc_…`) for JWT minting (**server-side only**) |

Mint member JWTs with `POST /auth/token` and the `X-Fluxy-Api-Key` header, or use `mintWorkerToken` from this package.

## Related packages

- [`@fluxy-chat/sdk`](https://www.npmjs.com/package/@fluxy-chat/sdk): core client, REST, room sessions
- [`@fluxy-chat/react`](https://www.npmjs.com/package/@fluxy-chat/react): React hooks (`useChat`, `useInbox`)
- [`@fluxy-chat/config`](https://www.npmjs.com/package/@fluxy-chat/config): `fluxy.config.ts` room authz and middleware

## License

MIT
