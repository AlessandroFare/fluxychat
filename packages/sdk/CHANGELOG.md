# @fluxy-chat/sdk

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
