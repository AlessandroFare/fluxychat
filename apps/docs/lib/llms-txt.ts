/** Served at /llms.txt and /docs/llms.txt. llmstxt.org: one H1, blockquote, then H2 link lists with absolute URLs. */

export const FLUXYCHAT_LLMS_TXT = `# FluxyChat

> Realtime rooms on Cloudflare Workers (Durable Objects + D1). Chat, presence, Yjs, agents, and HTTP ingest share one room Durable Object. MIT self-host or hosted beta.

FluxyChat is a room layer for your product. Map roomId to a document, board, deal, classroom, or dispatch view. Public rooms: FluxyRealtimeProvider publishableKey (pk_; POST /tokens/anonymous) or FluxyChatClient.joinPublicRoomAsGuest (stable guestKey in localStorage). Private rooms: mint a member JWT with POST /auth/token and header X-Fluxy-Api-Key (fc_ keys are server-only; pk_ returns 403). Scaffold with npx @fluxy-chat/create-fluxy-chat@latest (the unscoped create-fluxy-chat package is not ours). Open two browser tabs for cursors, presence, or Yjs. Named errors: FluxyNotMemberError, FluxyTokenExpiredError, FluxyAnonymousNotAllowedError. Message quota: persisted chat + non-ephemeral client_event; cursors do not count.

Presence is sendCursor / liveCursors / presence_patch (WebSocket type cursor). Large rooms switch presenceKind to aggregate above 250 unique users. Derived late-joiner JSON is setDerivedState (not a CRDT, 16 KiB). Visibility is visibility/visibleTo on send (kernel, not UI-only). Broadcast is sendClientEvent; prefix client-ephemeral-* skips webhooks. Pointers on client_event warn in development. Storage is FluxyYjsProvider plus useStorage from @fluxy-chat/sdk/yjs. Nest it under FluxyRealtimeProvider or pass token/authTokenProvider. Feeds are /rooms/:id/feeds, not chat messages. Comment pins are /comment-threads (useThreads). Chat nested replies are parentId / useThread / GET /rooms/:id/threads. Room agents use invokeAgent. Copilots use RegisterAiKnowledge and AiChat (they do not write the timeline). Hosted onPublish overlay: PUT /admin/projects/:id/publish-config (CLI: pnpm fluxy:deploy) including rooms templates and extension slots. Inbox socket: GET /ws/inbox (connectInbox). Weekend demo: GET /public/demo-credentials when PUBLIC_DEMO_PUBLISHABLE_KEY is set. FluxyRealtimeProvider takes workerUrl plus publishableKey, authTokenProvider, or connectUrl (not token/config.baseUrl). Nest useChat under it. useChat and useLiveCursors share sessionScope app (one JSON WebSocket per room). Pass a distinct sessionScope for a second widget on the same room. Yjs opens a second binary WebSocket on the same /ws/room/:id route. Spec: /docs/core/wire-protocol.

IoT and fleet ingest HTTP and fan out server_event names iot.reading and fleet.gps_update. Set iotAutoAgentId on publish-config to invoke an agent without @mention. Geofences are GET/POST /fleet/geofences (listFleetGeofences), not a location SDK package. useLocation consumes fleet tracks. Games use /games/* plus game.tick after startMatch. Voice stage is joinVoiceStage signaling. Cross-org negotiation is REST /cross-org. Omnichannel lives in console Bridges with per-vendor OAuth and signing secrets. RCS uses RCS_OUTBOUND_URL plus RCS_WEBHOOK_SECRET. Voice clone/translation posts to /voice-ai/clone-translate, which calls VOICE_CLONE_URL on your media box. Voice P95 tables are SLO targets from a unit bench, not fleet measurements. Hosted is beta. Pin npm versions. Vue/Svelte packages are best-effort vs React.

## Docs

- [Docs home](https://docs.fluxychat.com/docs): Start here. Hosted, self-host, or SDK-only.
- [Concepts](https://docs.fluxychat.com/docs/concepts): Projects, rooms, presence, broadcast, storage, feeds, threads, chat.
- [Choose your path](https://docs.fluxychat.com/docs/getting-started/choose-your-path): Hosted CLI, your Worker, or a few lines of SDK.
- [What to build](https://docs.fluxychat.com/docs/getting-started/what-to-build): Product idea to gallery example.
- [Gallery](https://docs.fluxychat.com/docs/getting-started/gallery): Copy-paste Vite apps. Open two tabs.
- [CLI and examples](https://docs.fluxychat.com/docs/getting-started/for-coding-agents): create-fluxy-chat flags, env vars, JWT mint.
- [Quickstart](https://docs.fluxychat.com/docs/getting-started/quickstart): pk_ in the browser, then member JWT.
- [Wire protocol](https://docs.fluxychat.com/docs/core/wire-protocol): v1 frames and non-goals.
- [Client setup](https://docs.fluxychat.com/docs/getting-started/client-setup): React, vanilla, React Native.
- [Self-hosting](https://docs.fluxychat.com/docs/getting-started/self-hosting): Worker on your Cloudflare account.
- [useChat](https://docs.fluxychat.com/docs/core/use-chat): Timeline, agents, most room APIs.
- [Presence](https://docs.fluxychat.com/docs/core/presence-typing): Who is here, cursors, selections.
- [Broadcast](https://docs.fluxychat.com/docs/core/broadcast): Sparse one-shot events.
- [Storage](https://docs.fluxychat.com/docs/core/storage): Yjs, Tiptap, whiteboard.
- [Comments](https://docs.fluxychat.com/docs/core/comments): Pinned threads.
- [Chat reply threads](https://docs.fluxychat.com/docs/core/nested-threads): `useThread` on `parentId`. Same room socket.
- [Feeds](https://docs.fluxychat.com/docs/core/feeds): Activity logs.
- [Copilots](https://docs.fluxychat.com/docs/core/copilots): Side-panel AI.
- [Notifications](https://docs.fluxychat.com/docs/core/notifications): Inbox and daily digest.
- [Voice](https://docs.fluxychat.com/docs/core/voice-huddles): Clips, stage signaling, clone proxy.
- [Platform modules](https://docs.fluxychat.com/docs/features/platform-status): IoT, fleet, game, RCS, adapters, commerce, federation.
- [Auth JWT](https://docs.fluxychat.com/docs/guides/auth-jwt): Mint tokens from your backend.
- [Publishable keys](https://docs.fluxychat.com/docs/guides/publishable-keys): pk_ in the browser, fc_ on the server.
- [Polls](https://docs.fluxychat.com/docs/core/polls): Timeline polls and anonymous ballots.
- [Voice load report](https://docs.fluxychat.com/docs/operations/voice-load-test-report): SLO targets (unit bench), not fleet P95.

## Examples

- [live-cursors](https://docs.fluxychat.com/docs/getting-started/gallery): Presence pointers.
- [live-cursors-chat](https://docs.fluxychat.com/docs/getting-started/gallery): Cursors plus chat.
- [javascript-live-cursors](https://docs.fluxychat.com/docs/getting-started/gallery): Vanilla JS pointers.
- [tiptap-room](https://docs.fluxychat.com/docs/getting-started/gallery): Collaborative editor.
- [whiteboard](https://docs.fluxychat.com/docs/getting-started/gallery): Y.Array strokes plus cursors.
- [draw](https://docs.fluxychat.com/docs/getting-started/gallery): Ephemeral stamps.
- [comments-board](https://docs.fluxychat.com/docs/getting-started/gallery): Contextual pins.
- [polls](https://docs.fluxychat.com/docs/getting-started/gallery): createPoll / votePoll. POST /polls isAnonymous for ballots.
- [war-room](https://docs.fluxychat.com/docs/getting-started/gallery): Humans and invokeAgent.
- [deal-room](https://docs.fluxychat.com/docs/getting-started/gallery): Decisions and markdown export.
- [iot-panel](https://docs.fluxychat.com/docs/getting-started/gallery): HTTP ingest, iot.reading.
- [fleet-panel](https://docs.fluxychat.com/docs/getting-started/gallery): GPS ingest, fleet.gps_update.
- [game-tick](https://docs.fluxychat.com/docs/getting-started/gallery): Lobby, ticks, leaderboard.
- [voice-stage](https://docs.fluxychat.com/docs/getting-started/gallery): Speaker roster signaling.

## API

- [HTTP reference](https://docs.fluxychat.com/docs/api-reference): Worker REST.
- [OpenAPI YAML](https://docs.fluxychat.com/openapi.yaml): Machine-readable routes.
- [@fluxy-chat/sdk](https://docs.fluxychat.com/docs/packages/sdk): Client, REST, Yjs, verticals.
- [@fluxy-chat/react](https://docs.fluxychat.com/docs/packages/react): Provider and hooks.
- [@fluxy-chat/ui](https://docs.fluxychat.com/docs/packages): Cursors, Thread, AiChat.
- [npm sdk](https://www.npmjs.com/package/@fluxy-chat/sdk): Published client.
- [npm react](https://www.npmjs.com/package/@fluxy-chat/react): Published hooks.
- [npm ui-kit](https://www.npmjs.com/package/@fluxy-chat/ui-kit): FluxyChatWidget, FluxyInboxPanel, guest mode.
- [npm vue](https://www.npmjs.com/package/@fluxy-chat/vue): Vue 3 composables.
- [npm svelte](https://www.npmjs.com/package/@fluxy-chat/svelte): Svelte 5 stores.
- [npm create-fluxy-chat](https://www.npmjs.com/package/@fluxy-chat/create-fluxy-chat): Scaffold CLI.

## Optional

- [GitHub](https://github.com/AlessandroFare/fluxychat): Source, MIT.
- [Hosted app](https://fluxychat.com): Console and playground.
- [Pricing](https://fluxychat.com/pricing): Hosted plans. Open beta. Pin versions.
- [Status](https://fluxychat.com/status): Worker /health. Not a fleet SLO.
- [Subprocessors](https://fluxychat.com/subprocessors): Cloudflare, Clerk, Stripe, LLM, Vercel.
- [Cookbook](https://docs.fluxychat.com/docs/cookbook): JWT, RAG, offline.
`;

export function fluxyChatLlmsResponse(): Response {
  return new Response(FLUXYCHAT_LLMS_TXT, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
