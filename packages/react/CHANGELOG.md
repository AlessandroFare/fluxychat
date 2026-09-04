# Changelog

## [0.1.7] - 2026-09-04

### Added

- Re-export `useThread` from `@fluxy-chat/sdk@0.6.9`. Peer is `^0.6.9`.

## [0.1.6] - 2026-08-31

### Added

- Re-export: `FluxyRealtimeProvider` accepts `publishableKey` from `@fluxy-chat/sdk@0.6.7`. Peer is `^0.6.7`.

## [0.1.5] - 2026-08-31

### Changed

- Peer `@fluxy-chat/sdk` is `^0.6.5` (republish so npm matches the repo; 0.1.4 still advertised 0.6.4).

## [0.1.4] - 2026-08-26

### Added

- Re-exports collab hooks from the SDK: `useLiveCursors`, presence (`useOthers` / `useMyPresence` / `useBroadcastEvent`), `useThreads`, `useFeeds` / `useFeedMessages`, and copilot (`useAiChat` / `FluxyAiCopilotProvider`).
- Subpath `@fluxy-chat/react/yjs` for Yjs storage / Tiptap without pulling the full chat surface.

## [0.1.3] - 2026-08-25

### Added

- `useChat().stopAgentStream` (from `@fluxy-chat/sdk@0.6.3`). Peer is `@fluxy-chat/sdk@^0.6.3`.

## [0.1.2] - 2026-08-19

### Fixed

- Peer/dependency on `@fluxy-chat/sdk@^0.6.2` so consumers do not nest an incomplete 0.6.0/0.6.1 tarball.
