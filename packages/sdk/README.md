# @fluxychat/sdk

Client for a **Fluxychat Worker** (self-hosted or [Fluxychat Cloud](https://github.com/AlessandroFare/fluxychat)): rooms, messages, WebSockets, agents, and optional React `useChat`.

The SDK talks to **your** Worker URL. It does **not** include LLM API keys — only your Fluxy **project API key** or **member JWT**.

## Install

```bash
npm install @fluxychat/sdk
# or
pnpm add @fluxychat/sdk
```

Requires **React 18+** if you use `useChat` (peer dependency).

## What you must configure

| Piece | Who sets it | Notes |
|--------|-------------|--------|
| **Worker `baseUrl`** | You | e.g. `https://fluxychat-worker.<account>.workers.dev` or your custom domain |
| **Project API key** (`fc_…`) | Worker / console | Mint JWTs via `POST /auth/token` with header `X-Fluxy-Api-Key` — **server-side only** |
| **Member JWT** | Your backend or Fluxychat console | Passed to `FluxyChatClient` / `useChat` as `token` |
| **LLM provider keys** | Worker secrets or console | For agents; never embed in the npm package |

### Minimal backend (mint JWT)

```bash
curl -X POST "$WORKER_URL/auth/token" \
  -H "Content-Type: application/json" \
  -H "X-Fluxy-Api-Key: fc_your_project_key" \
  -d '{"userId":"alice","roles":["member"],"ttlSeconds":3600}'
```

Use the returned `token` in the browser.

## Quick start (React)

```tsx
import { FluxyChatClient, useChat } from "@fluxychat/sdk";

const client = new FluxyChatClient({
  baseUrl: process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL!,
  userId: "alice",
  token: memberJwtFromYourBackend,
});

function Room({ roomId }: { roomId: string }) {
  const { messages, sendMessage, connectionStatus } = useChat({ roomId, client });
  // render messages…
}
```

## Self-host vs hosted cloud

- **Self-host:** deploy `apps/worker` from the [monorepo](https://github.com/AlessandroFare/fluxychat), run D1 migrations, set secrets. See `apps/worker/.dev.vars.example`.
- **Hosted cloud:** use the Fluxychat dashboard on Vercel; sign in with Clerk; project + API keys are provisioned for you.

Full operator docs: [docs/dashboard-integration.md](https://github.com/AlessandroFare/fluxychat/blob/main/docs/dashboard-integration.md).

## Agents

Agent invokes run on the Worker (`POST /agents/:id/invoke`). Configure provider keys on the Worker or per-project in the console. The SDK exposes REST helpers only.

## Support

Questions: [fluxychat@outlook.com](mailto:fluxychat@outlook.com) · Issues: [github.com/AlessandroFare/fluxychat/issues](https://github.com/AlessandroFare/fluxychat/issues)

## License

MIT — see [LICENSE](./LICENSE).
