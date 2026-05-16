# @fluxychat/sdk

Client for a Fluxychat Worker: rooms, messages, WebSockets, and optional React `useChat`.

## Install

```bash
npm install @fluxychat/sdk
# or
pnpm add @fluxychat/sdk
```

Point `baseUrl` at **your** Worker (self-hosted or Fluxychat Cloud). The SDK does **not** ship LLM API keys — only your Fluxy **project API key** or **member JWT** for chat/auth.

## Quick start

```ts
import { FluxyChatClient, useChat } from "@fluxychat/sdk";

const client = new FluxyChatClient({
  baseUrl: "https://your-worker.example.com",
  userId: "alice",
  token: memberJwt, // from POST /auth/token on your backend
});

const { messages, sendMessage, connectionStatus } = useChat({
  roomId: "support-room",
  client,
});
```

## LLM / agents

Agent invokes run on **your Worker**. Configure provider keys there (Worker secrets) or per-project in the operator console (`PUT /projects/llm/credentials/:provider` with an admin JWT). The npm package exposes agent REST helpers only; it never embeds OpenAI/Anthropic keys.

Before `npm publish`, set `repository.url` and `bugs.url` in `package.json` to your real monorepo URL.

## License

MIT — see [LICENSE](./LICENSE).
