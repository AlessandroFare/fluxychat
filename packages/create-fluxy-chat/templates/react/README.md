# FluxyChat React starter

Minimal Vite + React app with `useChat`. First message in about 60 seconds via the public guest room.

## Quick start (guest, fastest)

```bash
cp .env.example .env
# Set VITE_FLUXYCHAT_WORKER_URL + VITE_FLUXYCHAT_PUBLIC_ROOM_ID (public room from console)
npm install
npm run dev
```

Open http://localhost:5173. A guest JWT is minted automatically via `joinPublicRoomAsGuest`.

## Quick start (member JWT)

```bash
cp .env.example .env
# Set VITE_FLUXYCHAT_WORKER_URL + VITE_FLUXYCHAT_MEMBER_JWT + VITE_FLUXYCHAT_ROOM_ID
npm install
npm run dev
```

## Get credentials

1. **Guest:** create a **public** room in console, copy room ID, set `VITE_FLUXYCHAT_PUBLIC_ROOM_ID`
2. **Member:** [fluxychat.com/onboarding](https://fluxychat.com/onboarding) for Worker URL and JWT
3. **Local monorepo:** `pnpm run first-message` from the FluxyChat repo

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Next steps

- Add `@fluxy-chat/ui` themes (`default`, `dark`, `minimal`, `brand`)
- Use `useInbox` for unified feed
- See [chat-only quickstart](https://docs.fluxychat.com/docs/getting-started/chat-only-quickstart)
