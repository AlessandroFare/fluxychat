# FluxyChat game tick

Lobby → match → `POST /games/matches/:id/input` fans out `server_event` `game.tick` on the same room WebSocket. **Not a netcode engine.**

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-game --example game-tick
cp .env.example .env
npm run dev
```
