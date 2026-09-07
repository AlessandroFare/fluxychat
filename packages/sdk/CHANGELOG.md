# @fluxy-chat/sdk

## 0.6.12 (2026-09-07)

### Fixed

- History merge no longer lets an empty local streaming stub overwrite a REST row that already has the agent reply.
- WebSocket `message` frames with the same id as a streaming stub are still delivered when they carry content, so the completing bubble is not dropped.

## 0.6.11 (2026-09-07)

### Added

- `createCapabilityClient().snapshot(roomId)` — live counts for attendance, consent, checkpoints, risk flags, stage.

### Changed

- `PLATFORM_READINESS` marks IoT, fleet, game, edu, stream, voice, spatial, health, finance, event, continuity, marketplace, web3 as `production` on the free path. Copy still excludes HIPAA BAA, unpublished voice SLA, MQTT, and SFU.

## 0.6.10 (2026-09-07)

### Fixed

- History replay on reconnect keeps live messages and pending/failed rows (`mergeHistoryWithPendingDelivery`). Optimistic sends no longer vanish when `fetchMessages` returns.

### Changed

- `PLATFORM_READINESS` matches the product: kernel chat + Yjs are `production`; stream/game/IoT/fleet/edu/marketplace/web3/chatbot-builder are `beta`; voice/spatial/health/event/finance/continuity stay `labs`. Hosted remains open beta.

## 0.6.9 (2026-09-04)

### Added

- `useThread`, `listRoomThreads` (`GET /rooms/:id/threads` with opaque `nextCursor`), inbox `kind: "thread"`.
- `ThreadDepthExceededError` when a reply is more than 8 hops from the root.

## 0.6.8 (2026-09-02)

### Added

- `connectInbox()` → `GET /ws/inbox`. `useInbox` prefers this socket.
- `getRoomExtensions` / `setRoomExtension` for room kv/counter snapshots (max 5).

## 0.6.7 (2026-08-31)

### Added

- `FluxyRealtimeProvider` `publishableKey` (`pk_`). Creates the client immediately and mints an anonymous guest JWT. No `useEffect` in the app. Public rooms only.
- Under the provider, `useChat` and `useLiveCursors` share one JSON WebSocket (`sessionScope` default `app`). Pass a distinct `sessionScope` for a second widget on the same room.

## 0.6.6 (2026-08-31)

### Added

- `publishableKey` (`pk_`) on `FluxyChatClient` and `joinPublicRoomAsGuest`. Cannot mint member JWTs.
- Dev warning when `sendClientEvent` looks like a pointer (`sendCursor` instead).

## 0.6.5 (2026-08-27)

### Added

- `FluxyChatClient.setToken` / `updateToken` — swap JWT or clear credentials without recreating the client.
- `FluxyYjsProvider` `authTokenProvider` and nesting under `FluxyRealtimeProvider`.
- Guest-friendly token refresh on the realtime provider.

### Changed

- Peer consumers should pin `@fluxy-chat/sdk@^0.6.5`.

## 0.6.4 (2026-08-27)

### Added

- `createWorkerFluxyGameClient().listLeaderboard()` — D1 skill-rating table via `GET /games/leaderboard`.

## 0.6.3 (2026-08-25)

### Added

- `stopAgentStream()` on `useChat` / room session — cooperative stop of an in-flight agent stream (keeps tokens already shown).
- Stream offset resume, group cipher / attestation helpers, nested agent workspace steps.

## 0.5.0 (2026-07-28)

### Added

- `@fluxy-chat/sdk/testing` — Vitest/Jest matchers and spy adapters for integration tests.
- `@fluxy-chat/sdk/react` transitional re-export for hooks migrating from monolithic SDK.
- `FluxyChatError` hierarchy: `FluxyRateLimitError`, `FluxyLockError`, `FluxyNotImplementedError`.
- `getConnectionStatusLabel()` for connection UI copy.
- `FinalizationRegistry` leak warning in `room-session-handle` (dev builds).

### Changed

- Worker-runtime and testing subpath exports validated in publish manifest CI.
- README bundle size guidance (tree-shaken imports vs full `dist/index.js`).

## 0.4.0 (2026-06-16)

- Initial public release of the FluxyChat TypeScript SDK.
- `FluxyChatClient` REST helpers: messages, rooms, agents, webhooks, search, inbox, notifications.
- `useChat(roomId)` React hook with `loadMore`, `replay`, `markReadLatest`.
- `FluxyRealtimeProvider` + `useFluxyChat` for app-wide client.
- `FluxyChatRoomConnection` low-level WebSocket connection.
- Peer-dependency: `react` (optional), `zustand` (optional).
