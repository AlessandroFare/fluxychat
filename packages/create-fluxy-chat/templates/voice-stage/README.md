# FluxyChat voice stage

`joinVoiceStage` is **signaling on the room WebSocket** (who is speaker/listener). It is not live WebRTC audio and does not publish latency numbers.

Async clips: `POST /messages/voice`.

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-stage --example voice-stage
cp .env.example .env
npm run dev
```
