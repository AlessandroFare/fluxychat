# @fluxy-chat/sdk

## 0.4.0 (2026-06-16)

- Initial public release of the FluxyChat TypeScript SDK.
- `FluxyChatClient` REST helpers: messages, rooms, agents, webhooks, search, inbox, notifications.
- `useChat(roomId)` React hook with `loadMore`, `replay`, `markReadLatest`.
- `FluxyRealtimeProvider` + `useFluxyChat` for app-wide client.
- `FluxyChatRoomConnection` low-level WebSocket connection.
- Peer-dependency: `react` (optional), `zustand` (optional).
