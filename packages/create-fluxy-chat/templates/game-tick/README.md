# FluxyChat game tick

Lobby → match → input fans out `game.tick` (includes `state`). `leaveLobby` while waiting. `getMatch` is reconnect. **Not Colyseus Schema / netcode.**

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-game --example game-tick
cp .env.example .env
npm run dev
```
