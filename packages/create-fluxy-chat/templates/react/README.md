# FluxyChat React starter

Minimal Vite + React app with `useChat` — first message in minutes.

## Quick start

```bash
cp .env.example .env
# Edit .env with your Worker URL + member JWT
npm install
npm run dev
```

Open http://localhost:5173 and send a message.

## Get credentials

1. **Hosted:** [fluxychat.com/onboarding](https://fluxychat.com/onboarding) → copy Worker URL + JWT
2. **Local monorepo:** `pnpm run first-message` from the FluxyChat repo

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Next steps

- Add `@fluxy-chat/ui` for polished message bubbles
- Use `useInbox` for unified feed
- See [chat-only quickstart](https://docs.fluxychat.com/docs/getting-started/chat-only-quickstart)
