/** Canonical agent-facing catalog (LB-DX-001). Served at /llms.txt and /docs/llms.txt. */

export const FLUXYCHAT_LLMS_TXT = `# FluxyChat

> Multi-tenant realtime rooms on Cloudflare Workers (Durable Objects + D1). MIT self-host + hosted beta.
> Instruction for agents: read this file, then Concepts and What to build. Scaffold with create-fluxy-chat. Do not invent MQTT, Liveblocks secret keys, HIPAA, netcode, or a second socket fleet.

## Gold path

npx @fluxy-chat/create-fluxy-chat@latest my-app --mode hosted -y

npx @fluxy-chat/create-fluxy-chat@latest my-cursors --example live-cursors
npx @fluxy-chat/create-fluxy-chat@latest my-cursors-chat --example live-cursors-chat
npx @fluxy-chat/create-fluxy-chat@latest my-vanilla --example javascript-live-cursors
npx @fluxy-chat/create-fluxy-chat@latest my-war --example war-room
npx @fluxy-chat/create-fluxy-chat@latest my-iot --example iot-panel
npx @fluxy-chat/create-fluxy-chat@latest my-doc --example tiptap-room
npx @fluxy-chat/create-fluxy-chat@latest my-draw --example draw
npx @fluxy-chat/create-fluxy-chat@latest my-deal --example deal-room
npx @fluxy-chat/create-fluxy-chat@latest my-fleet --example fleet-panel
npx @fluxy-chat/create-fluxy-chat@latest my-game --example game-tick
npx @fluxy-chat/create-fluxy-chat@latest my-stage --example voice-stage
npx @fluxy-chat/create-fluxy-chat@latest my-comments --example comments-board
npx @fluxy-chat/create-fluxy-chat@latest my-board --example whiteboard

Docs: https://docs.fluxychat.com
This file: https://docs.fluxychat.com/llms.txt
GitHub: https://github.com/AlessandroFare/fluxychat
npm: @fluxy-chat/sdk @fluxy-chat/react @fluxy-chat/ui

Always use npx @fluxy-chat/create-fluxy-chat@latest (bare create-fluxy-chat 404s).
Open two browser tabs for anything collaborative.

## Concepts (mental model)

Project  = tenant. API keys fc_… are server-only. Rooms, agents, quotas.
Room     = one Durable Object + one WebSocket. Map roomId to your artifact (doc, board, deal, classroom, dispatch).
Users    = humans (member JWT or guest) and AI (copilot, room peer, workflow).

Presence  = now (cursors, selections, who is here) — not stored
Broadcast = pulse (one-shot events) — not stored
Storage   = the document (Yjs / LiveFile) — stored on the room DO
Feeds     = activity / agent / n8n logs — useFeeds, not chat messages
Threads   = contextual comments — useThreads + comment-threads REST
Chat      = timeline + tools — useChat (our wedge)
Copilot   = side-panel AI — RegisterAiKnowledge + AiChat (keyless mock; does not write the timeline)
Room agent= AI that speaks on the chat timeline — invokeAgent
Workflow  = API key POST …/feeds/…/messages → feed + server_event

## Primitive → API

Presence  useChat: sendCursor, liveCursors, presenceMembers, useMyPresence / presence_patch. WS type "cursor".
Broadcast useChat: sendClientEvent, lastClientEvent { eventName, data, userId }. useBroadcastEvent(store). Prefix client-ephemeral-* skips webhooks. Other client_event: 10/min + webhooks.
Storage   FluxyYjsProvider + useStorage / useMutation / useYjsDoc from @fluxy-chat/sdk/yjs (Y.Map "storage"). LiveFile = uploadLiveFile then JSON ref. Tiptap field "prosemirror". Whiteboard: Y.Array strokes.
Feeds     useFeeds, useFeedMessages. REST /rooms/:id/feeds. Fan-out feed.message.
Threads   useThreads. REST /rooms/:id/comment-threads. Fan-out comment.thread, comment.created, comment.thread.updated. Pins: metadata x,y.
Chat      useChat messages, sendMessage, invokeAgent. Replies use parentId (not threads).
Inbox     useInbox. Kinds: mention, unread, thread, comment, custom. commentEventToInboxItem.
Digest    GET/PATCH /digest/preferences. Cron DAILY_DIGEST_ENABLED. Includes yesterday's comments, not chat-only.

## Providers (do not mix props)

FluxyRealtimeProvider: workerUrl + authTokenProvider (+ userId). Optional connectUrl for hosted mint. NEVER token= or config={{ baseUrl, token }}.
FluxyYjsProvider: token (JWT string) + workerUrl / room. Nested inside realtime provider for whiteboard/tiptap.
FluxyChatClient: { baseUrl, userId, token }. Guest: FluxyChatClient.joinPublicRoomAsGuest(workerUrl, publicRoomId).
Do not mount useChat and useLiveCursors without the same sessionScope (two sockets).

UI: Cursors (rAF spring; prefers-reduced-motion snaps), Cursor, AvatarStack, CommentPin, Thread, ThreadComposer, FloatingComposer, AiChat, InboxNotification from @fluxy-chat/ui.

## Recipes (idea → --example)

Live cursors / who is here          Presence                         live-cursors
Cursors + chat overlay              Presence + Chat                  live-cursors-chat
Vanilla JS pointers                 Presence (connect + type cursor) javascript-live-cursors
Google-Docs-style editor            Storage + Presence               tiptap-room
Figma-like board                    Storage Y.Array + Presence       whiteboard
Stamp / ephemeral dots              Broadcast + Presence             draw
Contextual review comments          Threads + Thread UI              comments-board
Agent war room                      Chat + invokeAgent + Presence    war-room
Quorum / export deal                Chat decisions + export REST     deal-room
Device telemetry                    HTTP ingest + iot.reading        iot-panel
GPS / fleet                         POST /fleet/gps + fleet.gps_update  fleet-panel
Match lobby ticks                   Game HTTP + game.tick            game-tick
Speaker / listener roster           joinVoiceStage                   voice-stage
n8n / LangChain log                 Feeds + API key                  docs/core/feeds
Side-panel assistant                Copilot AiChat                   docs/core/copilots
Inbox + email catch-up              Inbox + digest prefs             docs/core/notifications

Cross-org rooms: REST /cross-org/… (server), not in Vite apps.

## JWT mint (server only)

POST {WORKER_URL}/auth/token
Header: X-Fluxy-Api-Key: fc_…
Body: { "userId": "alice", "roles": ["member"], "ttlSeconds": 3600 }
Never put fc_… in the browser. Pass returned token as authTokenProvider or FluxyChatClient.token.

## Live cursors

import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/react";

<FluxyRealtimeProvider workerUrl={workerUrl} authTokenProvider={memberJwt} userId={userId}>
  <Room />
</FluxyRealtimeProvider>

const { liveCursors, sendCursor, connected } = useChat({ roomId, replay: "request" });
// pointermove → sendCursor({ x, y, color, label })
// render Object.values(liveCursors); hide self

## Storage (Yjs)

import { FluxyYjsProvider, useStorage, useMutation, useYjsDoc } from "@fluxy-chat/sdk/yjs";

const title = useStorage((root) => String(root.title ?? ""));
const setTitle = useMutation((storage, next: string) => { storage.set("title", next); }, []);
// Tiptap: Collaboration.configure({ document: useYjsDoc(), field: "prosemirror" })
// LiveFile: uploadLiveFile(client, roomId, file) then storage.set("hero", live)
// Same DO binary protocol as dashboard collab (byte0: 0=sync, 1=update). Do not add another CRDT.

## Feeds vs copilot vs room agent

Feeds: useFeeds({ roomId }); workflows POST /rooms/:id/feeds/:feedId/messages with X-Fluxy-Api-Key.
Copilot: FluxyAiCopilotProvider + RegisterAiKnowledge + <AiChat /> (no timeline write).
Room peer: invokeAgent on useChat.
Workflow presence: optional useUpdateMyPresence({ agentStatus }).

## server_event names (fan-out on the room WS)

iot.reading          HTTP ingest
fleet.gps_update     POST /fleet/gps (optional roomId)
game.tick            after startMatch (need 2 players)
feed.message         feed writes
comment.thread, comment.created, comment.thread.updated
collab.crdt_update   Yjs activity
poll.created         polls

Deal: createDecision / ackDecision / exportRoomMarkdown on the SDK. Voice: joinVoiceStage is signaling, not WebRTC.

## Voice latency (do not invent)

Product SLO: OpenAI Realtime P95 ≤ 300ms; chunked ≤ 500ms; barge-in ≤ 500ms.
Source: GET /admin/voice-ai/stats in prod. Bench: docs/VOICE-LOAD-TEST-REPORT.md (SDK tick + SLO tracker).
/voice-ai stays labs until prod stats are populated. Health is not HIPAA. Stream/HLS stays labs.

## What not to invent

- MQTT as native transport (IoT/fleet = HTTP ingest + room fan-out)
- HIPAA / FDA product claims
- Liveblocks secret keys, Portal channels, or a custom socket fleet
- client_event / broadcast for mouse pointers (use sendCursor)
- Mixing Feeds with messages, or Threads with chat parentId
- Game netcode / rollback (use game.tick)
- WebRTC huddles from joinVoiceStage without LiveKit
- P95 numbers other than the voice report / admin stats

## Docs sitemap (https://docs.fluxychat.com)

/docs
/docs/concepts
/docs/getting-started
/docs/getting-started/what-to-build
/docs/getting-started/gallery
/docs/getting-started/for-coding-agents
/docs/getting-started/choose-your-path
/docs/getting-started/quickstart
/docs/getting-started/client-setup
/docs/getting-started/self-hosting
/docs/core
/docs/core/use-chat
/docs/core/presence-typing
/docs/core/broadcast
/docs/core/storage
/docs/core/comments
/docs/core/feeds
/docs/core/copilots
/docs/core/ai-collaboration
/docs/core/agents
/docs/core/inbox
/docs/core/notifications
/docs/core/voice-huddles
/docs/packages/sdk
/docs/packages/react
/docs/api-reference
/docs/operations/voice-load-test-report
/docs/cookbook
`;

export function fluxyChatLlmsResponse(): Response {
  return new Response(FLUXYCHAT_LLMS_TXT, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
