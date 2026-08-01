# LiveKit integration (voice / video)

FluxyChat voice features use **LiveKit** as the WebRTC SFU. The Cloudflare Worker issues short-lived JWT access tokens; media runs on your LiveKit server, not on Workers.

## Architecture

```
Browser (livekit-client)  ←WebRTC→  LiveKit SFU
        ↑ JWT token
FluxyChat Worker  (POST /voice/token or dashboard voice-ai routes)
```

- **Worker**: token minting with [`jose`](https://github.com/panva/jose) (`video-voice.js`, `voice-realtime.ts` stubs).
- **Dashboard**: `/voice-ai` for agent voice configuration.
- **Client**: add `livekit-client` in React apps; connect with token from Worker.

## Self-hosted LiveKit

1. Deploy [LiveKit server](https://docs.livekit.io/home/self-hosting/deployment/) (Docker/K8s).
2. Set Worker secrets:
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
   - `LIVEKIT_URL` (wss://your-livekit.example.com)
3. Token mint: `POST /admin/calls/token` uses `mintLiveKitAccessToken` in `apps/worker/src/lib/livekit-token.js`.
4. Extend client apps with `livekit-client` when connecting to the SFU.

## React quick start

```tsx
import { Room, RoomEvent } from "livekit-client";
import { useLiveKitToken } from "@fluxy-chat/react";

function VoiceRoom({ roomId, adminJwt }: { roomId: string; adminJwt: string }) {
  const { token, fetchToken } = useLiveKitToken({
    workerUrl: process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL!,
    adminJwt,
    roomId,
    displayName: "Alice",
  });

  async function join() {
    const creds = await fetchToken();
    if (!creds?.token || !creds.url) return;
    const room = new Room();
    await room.connect(creds.url, creds.token);
  }

  return <button type="button" onClick={() => void join()}>Join voice</button>;
}
```

## LiveKit Agents (optional)

For AI voice agents, use [LiveKit Agents](https://docs.livekit.io/agents/) as a separate process. FluxyChat agent runtime can hand off to an agent worker via webhook when a voice session starts.

## References

- [LiveKit overview](https://docs.livekit.io/intro/overview/)
- [Access tokens](https://docs.livekit.io/home/get-started/authentication/)
- Worker stubs: `apps/worker/src/lib/video-voice.js`, `apps/dashboard/app/voice-ai/`
