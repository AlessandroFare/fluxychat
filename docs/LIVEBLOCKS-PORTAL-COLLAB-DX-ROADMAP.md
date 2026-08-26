# Liveblocks + Portal — Collab DX & agent-ready product roadmap

> Date: 2026-08-26  
> Liveblocks clone: `docs/research/liveblocks-main` (gitignored) = [liveblocks/liveblocks](https://github.com/liveblocks/liveblocks) · site [liveblocks.io](https://liveblocks.io/)  
> Portal clones: `docs/research/portal-sdk-main` (SDK) · `docs/research/portal` · public [useportal.co](https://useportal.co/) · hackathon archive (35 builds)  
> Companion: [PORTAL-HACKATHON-ROADMAP-2026.md](./PORTAL-HACKATHON-ROADMAP-2026.md) (`PH-*`) · [BEAT-PORTAL-ROADMAP.md](./BEAT-PORTAL-ROADMAP.md) · [PORTAL-PARITY-ANALYSIS.md](./PORTAL-PARITY-ANALYSIS.md) · [CLOUDFLARE-AGENTS-VS-FLUXYCHAT-ROADMAP.md](./CLOUDFLARE-AGENTS-VS-FLUXYCHAT-ROADMAP.md) (`CF-A-*`) · [FEATURE_ROADMAP.md](./FEATURE_ROADMAP.md)

**ID prefix:** `LB-` (Liveblocks/Portal collab DX). Do not reuse `PH-`, `CF-A-`, `CP-`, `NW-`.

**License rule:** follow **patterns and public Apache/MIT client code**. Do **not** copy `packages/liveblocks-server` or `tools/liveblocks-cli` (**AGPL-3.0**). Apache-2.0: `@liveblocks/client`, `react`, `react-ui`, `yjs`, editor adapters. Portal SDK: MIT.

**Definition of done (every LB-*):** code + tests + Fumadocs page + `llms.txt` / `AGENTS.md` mention + (if user-facing) example runnable via `npx @fluxy-chat/create-fluxy-chat@latest --example <name>`. An item is **not** done if an AI agent still invents MQTT/HIPAA/netcode to use it.

---

## 0. Thesis (read first)

| Vendor | Unit | AI role | DX that wins hackathons | What we keep |
|--------|------|---------|-------------------------|--------------|
| **Portal** | Channel + presence + agent on one WS | Agent as peer in the channel | API key, live cursors guide, anonymous, inbox, 48h demos | JWT multi-tenant + Worker |
| **Liveblocks** | Room + **typed Presence** + **Storage CRDT** + comments | Copilot **on shared data** (`RegisterAiKnowledge`) | `create-liveblocks-app --example … --api-key`, 84 examples, `<Cursors />` | Room as kernel, not a doc SaaS |
| **Cloudflare Agents** | Agent Durable Object | Agent OS | `npm create cloudflare` template | Agents *join* our room |
| **FluxyChat** | Room DO + D1 + JWT project | Agent **member** + tools/MCP/quorum | Must match Portal time-to-first-pixel **and** Liveblocks example gallery | Self-host MIT, omnichannel, attestation |

**Liveblocks sentence:** people and AI edit the same document without breaking concurrency.  
**Portal sentence:** people and AI share one realtime channel (cursors, presence, events).  
**Ours:** people and AI share one **governed room** (timeline, tools, quorum, channels). The collab layer (presence, cursors, Yjs, comments-on-canvas) must feel like Liveblocks; the agent layer must stay ours.

**Strategic rule:** absorb the **entire Liveblocks catalog** (primitives + collaboration features) as FluxyChat surfaces on the room kernel — not a subset (“just cursors”). Portal supplies hackathon DX (anonymous, inbox, time-to-pixel). Cloudflare Agents remains the agent-OS competitor ([CF-A roadmap](./CLOUDFLARE-AGENTS-VS-FLUXYCHAT-ROADMAP.md)). Do not rebrand as “Liveblocks on Cloudflare”. Do not copy AGPL server code.

---

## 0.1 Liveblocks product catalog — take all of it

Source of truth: [liveblocks.io](https://liveblocks.io/) nav + clone `docs/research/liveblocks-main/docs/pages/concepts.mdx` (Projects → Rooms → **Primitives** → **Features**).

Liveblocks splits the world into **primitives** (sync engine) and **collaboration features** (productized UX). We implement **both layers**. Cursors are one field of Presence, not the product.

### Primitives (Realtime infrastructure)

| Liveblocks | What it is | Follow in clone | FluxyChat target | ID |
|------------|------------|-----------------|------------------|-----|
| **Presence** | Ephemeral per-connection JSON: online users, **cursors**, **selections**, custom keys. Throttled. Lost on disconnect. | `useMyPresence` / `useOthers` / `useSelf` (`liveblocks-react/src/index.ts`, `room.tsx`). UI: `Cursors.tsx` `DEFAULT_PRESENCE_KEY = "cursor"`. Config: `examples/nextjs-live-cursors/liveblocks.config.ts`. Docs: storage.mdx “Presence” section. | Typed presence map on Room DO; `useMyPresence` / `useOthers`; `<Cursors />` + selection overlay. Dedicated `cursor` WS frame already started — generalize to presence patches. **Not** `client_event`. | `LB-PRES-*` |
| **Broadcast** | Temporary event signals (not stored). Fire-and-forget to the room. | `useBroadcastEvent` / `useEventListener` (`index.ts`). Portal: ephemeral client events. | Keep `client_event` for sparse signals; document vs presence; skip webhooks on high-rate names; `useBroadcastEvent` alias. | `LB-BC-*` |
| **Storage** | Permanent CRDT room state: `LiveObject`, `LiveList`, `LiveMap`, `LiveFile` (file refs). Built for Figma/Spline-style tools. Also **Yjs** path. | Docs: `collaboration-features/multiplayer/sync-engine/liveblocks-storage.mdx`. Hooks: `useStorage`, `useMutableStorage`, `useMutation`. History: `useHistory`, `useUndo`/`useRedo`, `useHistoryVersions`. Packages: `liveblocks-yjs`. Our code: `apps/worker/src/lib/yjs-sync.js`. | (1) Yjs on existing WS as default sync engine. (2) JSON CRDT API (`useStorage`) wrapping Y.Map/Y.Array **or** LiveObject-shaped helpers so agents can copy Liveblocks snippets. (3) R2 `LiveFile` = attachment refs on the CRDT. | `LB-STOR-*` |
| **Feeds** (beta) | Realtime message/activity lists **inside a room**, often written from the **backend** (`@liveblocks/node` `createFeed` / `send` message). Multi-agent orchestration UI. | Docs: `collaboration-features/ai-collaboration.mdx`. Hooks: `useFeeds`, `useFeedMessages`, `useCreateFeed`, `useCreateFeedMessage`, … (`index.ts`). | D1 `room_feeds` + `room_feed_messages`; Worker REST + `server_event` fan-out; React hooks with the same names. Distinct from main chat timeline (chat = `messages`; feeds = activity / agent traces / automation). | `LB-FEED-*` |
| **Threads** | Contextual conversation **objects** (not the chat log): thread id, metadata, comments, resolved. Powers Comments feature. | `useThreads`, `useCreateThread`, `useCreateComment`, `useEditThreadMetadata`, `useMarkThreadAsResolved`, `useSubscribeToThread`. UI: `Thread.tsx`, `Comment.tsx`. | Extend D1 message threads with `metadata` JSON (x, y, sceneId, quote). Hooks matching Liveblocks. Chat threads stay; **contextual threads** are the product. | `LB-THRD-*` |

### Collaboration features

| Liveblocks | What it is | Follow in clone | FluxyChat target | ID |
|------------|------------|-----------------|------------------|-----|
| **Multiplayer** | “Anything multiplayer”: editors, whiteboards, forms, sheets. Storage + Presence + history + editor SDKs (Tiptap, Lexical, BlockNote) + Zustand/Redux. | `docs/pages/collaboration-features/multiplayer.mdx`. Packages: `liveblocks-react-tiptap`, `lexical`, `blocknote`, `zustand`, `redux`, `codemirror`. | One flagship Tiptap+Yjs example, then whiteboard (Y.Doc + presence). Zustand/Redux bindings optional after hooks exist. | `LB-MP-*` |
| **Comments** | Productized commenting: mentions, resolution, **text/video/canvas annotations**, default components. | `docs/pages/collaboration-features/comments.mdx`. UI: `CommentPin`, `FloatingComposer`, `FloatingThread`. `useSearchComments`, `resolveUsers` / `resolveMentionSuggestions` in examples skill. | Pin comments + mentions + resolve. `@fluxy-chat/ui` components. `resolveUsers` on `FluxyRealtimeProvider`. | `LB-CMT-*` |
| **Notifications** | Inbox tray, mark-read, aggregated **email** (`@liveblocks/emails`), auto from comments/editors. | `docs/pages/collaboration-features/notifications.mdx`. Hooks: `useInboxNotifications`, `useNotificationSettings`, `useUnreadInboxNotificationsCount`. UI: `InboxNotification`, `InboxNotificationList`. | Map to `useInbox` + kinds (`thread`, `mention`, `comment`, `custom`). Email digest via existing email paths. Components in ui-kit. | `LB-NOTIF-*` |
| **AI Copilots** | **Individual** assistants: chats, toolbars, knowledge of **app state**, default `<AiChat />`. | `docs/pages/collaboration-features/ai-copilots.mdx`. `ai.tsx` `RegisterAiKnowledge` / `RegisterAiTool`. Hooks: `useAiChat`, `useSendAiMessage`, `useAiChatMessages`, `useCreateAiChat`. UI: `AiChat`, `AiTool`. | Copilot **and** room-peer agent. Knowledge layer + `<AiChat />` + room `invokeAgent`. Keyless mock like their AI examples. | `LB-AI-*` |
| **AI Collaboration** | Agents update Feeds + Presence from **any workflow** (n8n, LangChain). Mention-in-comment → feed. | `ai-collaboration.mdx` + node `createFeed`. | Worker APIs so external workflows POST into feeds; agent presence (`presence.agentStatus`). | `LB-AICOLL-*` |

**Mental model for agents (put this in `llms.txt`):**

```
Presence  = now (cursors, selections, who is here)     — not stored
Broadcast = pulse (one-shot events)                    — not stored
Storage   = the document (CRDT / Yjs / files)          — stored
Feeds     = activity / agent logs in the room          — stored, not main chat
Threads   = contextual comment threads                 — stored, metadata
Chat      = FluxyChat timeline (messages + tools)      — stored, our wedge
Copilot   = AI that reads Storage/Presence/Knowledge   — Liveblocks-shaped
Room agent= AI that speaks on the chat timeline        — our wedge
```

---

## 1. What we actually read

### 1.1 Liveblocks repo inventory

Monorepo `pnpm` + turbo. Examples are **outside** the workspace (depend on *published* packages). `AGENTS.md` is the coding-agent contract (`CLAUDE.md` → `AGENTS.md`).

| Path in clone | Role | Follow when implementing |
|---------------|------|--------------------------|
| `AGENTS.md` | Agent-facing repo map, example rules, docs registration | `LB-DX-001` |
| `.agents/skills/create-example/SKILL.md` | Gallery conventions, `--example`, two-tab help, `database.ts`, `liveblocks.config.ts` | `LB-EX-001` |
| `.agents/skills/write-docs/SKILL.md` | API ref + feature page + routes.json | `LB-DX-002` |
| `packages/liveblocks-react/src/index.ts` | `useMyPresence`, `useOthers`, `useStorage`, `useThreads`, `useBroadcastEvent`, `RoomProvider` | `LB-PRES-001` |
| `packages/liveblocks-react/src/room.tsx` | Room context, presence/storage subscriptions | `LB-PRES-001` |
| `packages/liveblocks-react/src/ai.tsx` | `RegisterAiKnowledge`, `RegisterAiTool` | `LB-AI-001` |
| `packages/liveblocks-react-ui/src/components/Cursors.tsx` | Default presence key `"cursor"`, spring, `useUpdateMyPresence` | `LB-UI-001` |
| `packages/liveblocks-react-ui/src/components/Cursor.tsx` | Single cursor glyph | `LB-UI-001` |
| `packages/liveblocks-react-ui/src/index.ts` | `Cursors`, `AvatarStack`, `Thread`, `Comment`, `Composer`, `InboxNotification`, `AiChat` | `LB-UI-*` |
| `examples/nextjs-live-cursors/` | Minimal presence cursor app + `liveblocks.config.ts` | `LB-EX-010` |
| `examples/nextjs-live-cursors-advanced/` | Scroll + chat overlay | `LB-EX-011` |
| `examples/javascript-live-cursors/` | Vanilla JS | `LB-EX-012` |
| `docs/pages/index.mdx` + `docs/routes.json` | Homepage = Get started + Browse examples | `LB-DX-002` |
| `starter-kits/nextjs-starter-kit` | Full kit | `LB-EX-020` |
| Editor pkgs | `liveblocks-yjs`, `liveblocks-react-tiptap`, `lexical`, `blocknote`, `codemirror` | `LB-ED-001` |

**Do not implement from:** `packages/liveblocks-server`, `tools/liveblocks-cli` (AGPL).

**Liveblocks presence model (copy this contract, not their bytes):**

```ts
// examples/nextjs-live-cursors/liveblocks.config.ts
Presence: { cursor: { x: number; y: number } | null }
UserMeta: { id: string; info: { name: string; color: string; avatar: string } }
```

Cursors are **not** a webhooked `client_event`. They are **presence fields**, throttled on the provider (`throttle={16}` in example `providers.tsx`). `<Cursors />` reads `useOthersConnectionIds` + `useOther` + `useUpdateMyPresence`.

### 1.2 Portal (SDK + hackathon)

| Source | Follow |
|--------|--------|
| `docs/research/portal-sdk-main` | Inbox `onItem`, `readOn`, inert snapshot, `useSyncExternalStore` — see [PORTAL-PARITY-ANALYSIS.md](./PORTAL-PARITY-ANALYSIS.md) |
| Portal docs (live cursors / ephemeral events / anonymous) | First-class **guide** + ephemeral fan-out without D1 |
| 35 hackathon builds | [PORTAL-HACKATHON-ROADMAP-2026.md](./PORTAL-HACKATHON-ROADMAP-2026.md) — room as OS: agents as peers, ingest, quorum, IoT 20-line, war room |

Portal wins **time-to-first-pixel** (publishable key, anonymous upgrade, cursor cookbook). Liveblocks wins **collab product** (storage, comments UI, 84 demos). We must win **both** plus agent governance.

### 1.3 FluxyChat already (do not redo)

| Piece | Where | Note |
|-------|--------|------|
| Room WS + presence + typing | `apps/worker/src/durable-objects/room-do.js`, SDK `useChat` | Production |
| `client_event` | Room DO, `CLIENT_EVENT_MAX_PER_MINUTE = 10` | **Too slow for cursors**; fires webhooks — do not use for pointers |
| Yjs binary on same WS | `yjs-sync.js`, dashboard collab | Labs-shaped; needs Tiptap example |
| Inbox | `useInbox` | Exists; Portal `onItem` polish still in PH/CP docs |
| Agents + MCP + quorum | Worker + SDK | Our wedge vs Liveblocks copilots |
| `cursor` WS frame (in progress) | Protocol `FLUXY_*_EVENT_TYPES`, Room DO handler, `packages/sdk/src/live-cursors.ts`, `use-live-cursors.ts` | **🟨** — finish as presence *or* keep dedicated frame but expose Liveblocks-shaped hooks + `<Cursors />` |

---

## 2. Execution waves

Ship in this order. Later waves assume earlier DX exists so an agent can compose them. **Every Liveblocks nav item has a wave** — cursors are not a substitute for Storage/Feeds/Threads/Comments/Notifications/Copilots.

| Wave | IDs | Outcome |
|------|-----|---------|
| **A — Agent can onboard** | `LB-DX-001` … `003` | `llms.txt`, docs home, coding-agents page, gold path only |
| **B — Presence + Broadcast** | `LB-PRES-*`, `LB-BC-*`, `LB-UI-001` | Online users, cursors, **selections**; `useBroadcastEvent`; `<Cursors />` |
| **C — Gallery** | `LB-EX-001`, `010`–`016` | `--example live-cursors` (then war-room, IoT, draw) |
| **D — Threads + Comments + Notifications** | `LB-THRD-*`, `LB-CMT-*`, `LB-NOTIF-*` | Contextual threads, pin comments, inbox kinds + UI |
| **E — Storage + files + Multiplayer editor** | `LB-STOR-*`, `LB-MP-*`, `LB-ED-001` | Yjs + `useStorage` shape; R2 file refs; Tiptap example |
| **F — Feeds + AI Copilots + AI Collaboration** | `LB-FEED-*`, `LB-AI-*`, `LB-AICOLL-*` | Activity feeds; `<AiChat />` + knowledge; workflow POST into feeds |
| **G — Verticals on the same bus** | `LB-VERT-001` | Game/IoT/voice use presence + `server_event`, not fake product names |

---

## 3. Wave A — Coding-agent contract

### LB-DX-001 — Public `llms.txt` + repo `AGENTS.md` for integrators

**Status:** 🟩 playbook + sitemap in `apps/docs/lib/llms-txt.ts` (concepts, recipes, JWT curl `POST /auth/token`, provider props, `server_event` names, UI kit). Routes `/llms.txt` and `/docs/llms.txt`. `docs/llms.txt` points at the hosted catalog.

**Follow:** Liveblocks `AGENTS.md` (structure: packages, examples rules, docs registration). Not their product claims.

**Implement:**

1. Canonical text in `apps/docs/lib/llms-txt.ts` (gold path `npx @fluxy-chat/create-fluxy-chat@latest`, JWT mint curl, `useChat`, presence/cursors, agents on same WS, MCP, **what not to invent**: MQTT-native, HIPAA checkbox, P95 voice, FluxyHealth=FDA).
2. Routes: `apps/docs/app/llms.txt/route.ts` and `apps/docs/app/docs/llms.txt/route.ts` (`text/plain`).
3. Dashboard: `apps/dashboard/app/docs/llms.txt/route.ts` redirect to docs origin **or** same body (layout already expects `/docs/llms.txt`).
4. Docs `<link rel="llms" href="/llms.txt" />` in `apps/docs/app/layout.tsx`.
5. Root `docs/llms.txt` + `AGENTS.md` section “Integrators / coding agents” pointing at docs.fluxychat.com/llms.txt.
6. Sync script must **not** overwrite Fumadocs `meta.json` (`docs:sync --force` only).

**Tests:** fetch route returns `FluxyChat` + `create-fluxy-chat` + `useChat`.

### LB-DX-002 — Docs homepage = Get started + Browse examples

**Status:** 🟩 Concepts + What to build + primitive cards + gallery + `/llms.txt` (Liveblocks-shaped IA, FluxyChat copy).

**Follow:** `docs/research/liveblocks-main/docs/pages/index.mdx` (hero + examples CTA + feature cards). `write-docs` skill: register routes, repeat mentions.

**Implement:** homepage cards: Choose path, Quickstart, **For coding agents**, **Live cursors**, Hackathon cookbooks, API. Link `/llms.txt`. GA vs remaining verticals: name APIs that exist; do not dump internal FEATURE_ROADMAP files into the sidebar (already burned once).

### LB-DX-003 — `getting-started/for-coding-agents.mdx`

**Status:** 🟩 full gallery examples, Concepts / What to build links, provider + JWT notes.

**Follow:** Liveblocks get-started pages under `docs/pages/get-started/*` (hidden routes + one canonical). Portal: anonymous → auth upgrade story.

**Implement:** single page: hosted CLI, self-host Worker, SDK-only; env vars; “open two tabs”; pointer to examples. Register in `getting-started/meta.json`.

---

## 4. Wave B — Presence (copy Liveblocks contract)

### LB-PRES-001 — Typed room presence (cursors, selections, custom JSON)

**Status:** 🟨 `useMyPresence` / `useOthers` / `useBroadcastEvent` + `useChat().sendCursor` / `liveCursors`; selections still ⬜

**Follow (mandatory read before coding):**

1. `examples/nextjs-live-cursors/liveblocks.config.ts` — `Presence.cursor`
2. `packages/liveblocks-react-ui/src/components/Cursors.tsx` — `DEFAULT_PRESENCE_KEY = "cursor"`, pointermove → `updateMyPresence`, others → positioned cursors, window blur → `null`
3. `packages/liveblocks-react/src/index.ts` exports `useMyPresence`, `useUpdateMyPresence`, `useOthers`, `useOther`, `useOthersMapped`, `useOthersConnectionIds`, `useSelf`
4. Example `providers.tsx` `throttle={16}` (≈60 Hz cap)

**Wire protocol (FluxyChat):**

- Prefer **dedicated** `type: "cursor"` (already in `@fluxy-chat/protocol`) for pointer XY: no D1, no webhooks, `excludeWebSocket` sender, `CURSOR_MAX_PER_MINUTE = 600` in `apps/worker/src/lib/room-presence.js`.
- Generalize to **presence patch**: outbound `{ type: "presence_patch", data: { cursor, selection, … } }` OR keep `cursor` + allow extra keys on the same frame. Do **not** send 60 Hz through `client_event` (10/min + webhooks).
- Inbound: fan-out `{ type: "presence_state" | "cursor", userId, … }`. Map in SDK to a `Presence` object per `userId` (Liveblocks `User` + `connectionId` — we can use `socketId` already on the store).
- Readonly/spectator sockets: receive yes, send no (`ws-readonly.js`).

**SDK (mirror Liveblocks names so agents copy-paste mentally):**

| Liveblocks | FluxyChat |
|------------|-----------|
| `liveblocks.config.ts` `Presence` | `fluxy.config.ts` or `fluxy-presence.ts` module augmentation |
| `useMyPresence()` | `useMyPresence()` in `@fluxy-chat/sdk` / react |
| `useUpdateMyPresence` | same or `updateMyPresence` from `useChat` |
| `useOthers()` | `useOthers()` from live cursor + presence map |
| `RoomProvider` `throttle` | `createCursorThrottle(16)` already in `live-cursors.ts` — apply to all presence patches |

**Finish in-progress files:** export `useLiveCursors` from `packages/sdk/src/index.ts` + `@fluxy-chat/react`; dispose throttle on session teardown in `room-session.ts`; `useChat` returns `sendCursor` + `liveCursors`; Room DO test already sketched in `room-do.test.js`.

### LB-PRES-004 — Selections (Presence field, not a new WS type)

**Status:** 🟨 `presence_patch` + `<Selections />`; editor ranges still optional

**Follow:** Liveblocks presence JSON (`selection`, `focus`, editor ranges). Same throttle as cursors.

**Implement:** `updateMyPresence({ selection })` on the presence patch / cursor-adjacent frame. Overlay in `<Cursors />` or `<Selections />`. Readonly sockets receive only.

### LB-BC-001 — Broadcast = `client_event` (Liveblocks `useBroadcastEvent`)

**Status:** 🟨 `useBroadcastEvent` / `useEventListener`; `client-ephemeral-*` skips webhooks

**Follow:** Portal ephemeral events; Liveblocks `useBroadcastEvent` / `useEventListener`.

**Implement:** keep `client_event` for sparse signals (knock, “highlight object”). Export `useBroadcastEvent` / `useEventListener` aliases. Document: **cursors/selections = presence; one-shot = broadcast**. Skip webhooks for `client-ephemeral-*` prefix. Do not raise to 60 Hz.

### LB-PRES-003 — Anonymous / guest then upgrade (Portal)

**Status:** ◐ guest JWT exists (`guest-public-session.js`)

**Follow:** Portal identity persist + upgrade to authenticated user without new room.

**Implement:** docs + example “two tabs as guests”; `llms.txt` mentions guest path. Do not require Clerk for the live-cursors example.

---

## 5. Wave C — UI kit + examples (this is how they look “strong”)

### LB-UI-001 — `<Cursors />` + `<Cursor />` in `@fluxy-chat/ui` or `ui-kit`

**Status:** ✅ `packages/ui/src/cursors.tsx` + damped spring (`cursor-spring.ts`, `prefers-reduced-motion`)

**Follow:** `liveblocks-react-ui/src/components/Cursors.tsx` + `Cursor.tsx` (spring in `cursor-spring.ts` — reimplement, don’t paste if license-uncertain; logic is Apache). Default presence key `cursor`. `pointer-events: none`. Hide self. Color from `UserMeta` / presence.

**Implement:** components + Story/docs. Hook them to `useOthers` + `useUpdateMyPresence`.

### LB-UI-002 — `AvatarStack` (others in room)

**Status:** ✅ `@fluxy-chat/ui` `AvatarStack` bound in `--example war-room`

**Follow:** `AvatarStack.tsx` in react-ui. Bind to `presenceMembers` / `useOthers`.

### LB-EX-001 — `create-fluxy-chat --example <name>` gallery contract

**Status:** ✅ `--example live-cursors` `live-cursors-chat` `javascript-live-cursors` `tiptap-room` `war-room` `iot-panel` `draw` `deal-room` `fleet-panel` `game-tick` `voice-stage` `comments-board` `whiteboard`

**Follow:** `.agents/skills/create-example/SKILL.md` **verbatim as process**:

- Examples depend on **published** `@fluxy-chat/*` (or workspace in monorepo `examples/` with note).
- README: one-liner, `npx @fluxy-chat/create-fluxy-chat@latest --example <name>`, “open two tabs”.
- `fluxy-presence.ts` types (like `liveblocks.config.ts`).
- Help button: 3–4 lines how to try multiplayer.
- `.env.example`: Worker URL + JWT or hosted key.
- Auth route that mints member JWT (our equivalent of `/api/liveblocks-auth`).

**CLI:** `--example live-cursors` copies `packages/create-fluxy-chat/templates/live-cursors` (Vite; Liveblocks analogue `nextjs-live-cursors`).

### Flagship examples (hackathon + Liveblocks)

Ship these first (names stable for `--example`):

| ID | Example | Follow | Portal/LB analogue |
|----|---------|--------|-------------------|
| `LB-EX-010` | `nextjs-live-cursors` | `examples/nextjs-live-cursors` | LB + Portal cursors |
| `LB-EX-011` | `nextjs-live-cursors-chat` | `nextjs-live-cursors-chat` | cursors + `useChat` |
| `LB-EX-012` | `javascript-live-cursors` | `javascript-live-cursors` | vanilla |
| `LB-EX-013` | `nextjs-war-room` | PH-103 / AI War Room | agents + presence + stream |
| `LB-EX-014` | `nextjs-draw-vs-ai` | Pict-Portal | strokes as presence or Yjs |
| `LB-EX-015` | `nextjs-iot-panel` | PH-122 Nexora | `server_event` + IoT HTTP ingest (not fake MQTT) |
| `LB-EX-016` | `nextjs-deal-room` | PH-103 + CF-A-044 | cross-org + quorum + export |

Each example **must** work against hosted **or** `wrangler dev` Worker. Keyless mock agent if no LLM key (Liveblocks AI examples do this).

---

## 6. Wave D — Threads, Comments, Notifications (Liveblocks collaboration features)

### LB-THRD-001 — Contextual threads (not the chat log)

**Status:** ✅ D1 `room_comment_threads` + `useThreads` + REST + `--example comments-board`

**Follow:** `useThreads`, `useCreateThread`, `useCreateComment`, `useEditThreadMetadata`, `useMarkThreadAsResolved`, `useSubscribeToThread`. UI `Thread.tsx` / `Comment.tsx`.

**Implement:** `metadata` JSON on threads (`x`, `y`, `sceneId`, `quote`, `resolved`). Hooks with Liveblocks names in `@fluxy-chat/sdk`. Chat replies stay on `parentId`; contextual threads are a distinct list in the room.

### LB-CMT-001 — Comments product (pins, mentions, resolve)

**Status:** ✅ pins + resolve + `FloatingComposer` / `Thread` (`--example comments-board`); mentions reuse chat

**Follow:** `docs/pages/collaboration-features/comments.mdx`. `CommentPin`, `FloatingComposer`, `FloatingThread`. `resolveUsers` / `resolveMentionSuggestions`.

**Implement:** overlay pins + composer. `resolveUsers` on `FluxyRealtimeProvider`. Mentions already exist in chat — reuse for comments.

### LB-UI-003 — Comment / Thread / CommentPin in `@fluxy-chat/ui`

**Status:** ✅ `CommentPin` + `Thread` + `FloatingComposer` + `InboxNotification`

**Follow:** `liveblocks-react-ui` Comment, Thread, CommentPin, Composer.

### LB-NOTIF-001 — Collab notifications (inbox kinds + email)

**Status:** ✅ kinds `thread`/`comment`/`custom` + `<InboxNotification />` + daily email digest includes thread comments (`runDailyDigest`, `RESEND_API_KEY` / Email binding)

**Follow:** `useInboxNotifications`, `useUnreadInboxNotificationsCount`, `InboxNotification` UI, `@liveblocks/emails`.

**Implement:** kinds `thread` | `mention` | `comment` | `custom`. Map to existing inbox. Email digest via Worker email paths. `<InboxNotification />` in ui-kit.

---

## 6b. Wave E — Storage, files, Multiplayer

### LB-STOR-001 — Synced CRDT room state (`useStorage`)

**Status:** ✅ `useStorage` / `useMutation` / `useUndo` / `useRedo` on `@fluxy-chat/sdk/yjs` wrapping `Y.Map("storage")`

**Follow:** `liveblocks-storage.mdx`; `useStorage`, `useMutation`, `useUndo` / `useRedo`, `useHistoryVersions`. Types: LiveObject / LiveList / LiveMap.

**Implement:** Yjs as the engine. SDK helpers `useStorage` / `useMutation` wrapping Y.Map / Y.Array so agents can copy Liveblocks snippets. Persist on the existing Yjs WS path. Do not invent a second CRDT.

### LB-STOR-002 — File storage (`LiveFile`)

**Status:** ✅ JSON ref `{ liveFile, id, name, mime, size, url }` via `uploadLiveFile` → existing `POST /upload`

**Follow:** Liveblocks `LiveFile` (reference in Storage, bytes in their file service).

**Implement:** R2 object + JSON ref `{ id, name, mime, size }` on the Y.Doc / attachment table. Upload via existing Worker attachment APIs.

### LB-MP-001 — Multiplayer as “Storage + Presence + editor”

**Status:** ✅ Tiptap + `--example whiteboard` (Y.Array strokes + cursors on the room Yjs map)

**Follow:** `collaboration-features/multiplayer.mdx`. One editor first (`LB-ED-001`), then whiteboard. Zustand/Redux/Lexical/BlockNote **after** Tiptap example is copy-pasteable.

### LB-ED-001 — Tiptap + Yjs on the room WS

**Status:** ✅ Vite `--example tiptap-room` (`Collaboration` + `field: "prosemirror"`)

**Follow:** `@liveblocks/react-tiptap` / `liveblocks-yjs`. Our `yjs-sync.js` + `createYjsCollabPort`.

**Implement:** example `nextjs-tiptap-room` / Vite equivalent. Undo/redo = Tiptap. No Lexical+BlockNote+CodeMirror until this ships.

---

## 6c. Wave F — Feeds + AI Copilots + AI Collaboration

### LB-FEED-001 — Room feeds (activity / agent logs)

**Status:** ✅ D1 `room_feeds` / `room_feed_messages`; REST + `feed.created` / `feed.message`; `useFeeds`

**Follow:** `ai-collaboration.mdx`; `useFeeds`, `useFeedMessages`, `useCreateFeed`, `useCreateFeedMessage`. Node `createFeed`.

**Implement:** D1 `room_feeds` + `room_feed_messages`; REST + `server_event` fan-out. Distinct from `messages`. Backend (n8n, agents) POST into a feed.

### LB-AI-001 — `RegisterAiKnowledge` / `RegisterAiTool` + `<AiChat />`

**Status:** ✅ `RegisterAiKnowledge` / `RegisterAiTool` / `useAiChat` / `<AiChat />` keyless mock

**Follow:** `ai.tsx`; `useAiChat`, `useSendAiMessage`, `useAiChatMessages`. UI `AiChat`, `AiTool`. Docs `ai-copilots.mdx`.

**Implement:** knowledge layer from UI state; tools wrap Worker/MCP registry; `<AiChat />` for **individual** copilots. Room `invokeAgent` remains the **peer on the timeline**. Keyless mock when no LLM key.

### LB-AICOLL-001 — Agents update Feeds + Presence from any workflow

**Status:** ✅ API-key POST to feeds; `presence_patch.agentStatus`; docs Copilot vs room-peer vs feed writer

**Follow:** AI Collaboration (mention in comment → feed). Node SDK `createFeed`.

**Implement:** Worker token for automation POST; `presence.agentStatus`; docs: Copilot vs room-peer vs feed writer.

---

## 7. Wave G — Verticals on the same bus (no peanuts)

Verticals stay, but they **must** use presence + `server_event` + the example gallery. Naming FluxyIoT without MQTT is fine if docs say **HTTP ingest + device shadow** (`apps/worker/src/lib/fluxy-iot.js`).

### LB-VERT-001 — Readiness = example + llms.txt + same ops bar as chat

**Status:** 🟨 collab + IoT + fleet + game promoted (gallery + docs + llms). Voice AI / huddles / stream / health stay labs (no latency/netcode/HIPAA/WHIP claims). Deal-room `LB-EX-016` shipped as Vite `--example deal-room`. Voice signaling: `--example voice-stage`.

For each of: collab, voice, game, iot, fleet, stream:

1. One `--example`
2. One Fumadocs guide with curl + hook
3. Line in `llms.txt`
4. Dashboard route **visible** only when that bar is met (today `DASHBOARD_LAB_HREFS` hides them — promote when example is real, don’t promote empty `/health` HIPAA)

**Voice:** flagship report in `docs/VOICE-LOAD-TEST-REPORT.md` (SDK bench + optional Worker HTTP + k6 + LiveKit script). Product SLO P95 ≤ 300ms realtime via `/admin/voice-ai/stats`.

---

## 9. Mapping to existing PH-* / CF-A-* (do not duplicate work)

| Existing | Relates to LB-* |
|----------|-----------------|
| PH-100 room MCP | Agent enters plaza — keep; add to `llms.txt` |
| PH-110 quorum | Deal-room example `LB-EX-016` |
| PH-120–124 templates | Become `LB-EX-013`–`015` |
| PH-140 docs/GTM | `LB-DX-002` |
| CF-A-044 enterprise default | Deal-room + attestation docs |
| CP-021 inbox | Portal parity — parallel to AvatarStack |

---

## 10. Acceptance test (the one you already ran)

Give an AI agent **only**:

- https://fluxychat.com  
- https://docs.fluxychat.com  
- https://docs.fluxychat.com/llms.txt  
- https://github.com/AlessandroFare/fluxychat  

Ask: *Build a live-cursors canvas and a war room with an agent in the same room.*

**Pass:** agent uses `create-fluxy-chat --example` or `useMyPresence` + `useChat` + documented JWT. Does not invent Liveblocks keys, Portal channels, MQTT, or a custom socket fleet.

**Fail:** agent reads FluxyHealth/FluxyGame names and promises HIPAA/netcode.

Until pass: we are **not** ready. Until then, Liveblocks/Portal remain easier to “feed to an agent”.

---

## 11. Suggested implementation order (next PRs)

1. `LB-DX-001` + `LB-DX-002` + `LB-DX-003` (agent sees the truth)  
2. Finish `LB-PRES-001` / `LB-PRES-004` + `LB-BC-001` + `LB-UI-001`  
3. `LB-EX-001` + `LB-EX-010` (`--example live-cursors`)  
4. `LB-THRD-001` + `LB-CMT-001` + `LB-NOTIF-001`  
5. `LB-STOR-001` + `LB-STOR-002` + `LB-ED-001`  
6. `LB-FEED-001` + `LB-AI-001` + `LB-AICOLL-001`  
7. `LB-EX-013` war-room + remaining examples + `LB-VERT-001`

Do not start 12 editor adapters or HIPAA verticals before step 3. **Do not ship “just cursors” and call the Liveblocks catalog done.**
