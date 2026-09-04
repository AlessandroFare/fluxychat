# FluxyChat React starter

`FluxyRealtimeProvider` + `publishableKey` + `useChat`. No member JWT mint.

```bash
cp .env.example .env
# Set VITE_FLUXYCHAT_WORKER_URL + VITE_FLUXYCHAT_PUBLISHABLE_KEY + room id
npm install
npm run dev
```

Pin `@fluxy-chat/sdk@0.6.7` and `@fluxy-chat/react@0.1.6` once those versions are on npm.

## Other paths

- Member JWT: `VITE_FLUXYCHAT_MEMBER_JWT`
- Guest session: `VITE_FLUXYCHAT_PUBLIC_ROOM_ID` (`joinPublicRoomAsGuest`)
- Credentials: [fluxychat.com/onboarding](https://fluxychat.com/onboarding) or `GET /public/demo-credentials` on a Worker that sets `PUBLIC_DEMO_PUBLISHABLE_KEY`
