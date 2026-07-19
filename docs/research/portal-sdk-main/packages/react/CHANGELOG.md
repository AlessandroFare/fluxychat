# @portalsdk/react

All notable changes to this package are documented here. This package is versioned
independently of the other `@portalsdk` packages.

## 0.1.0

- `PortalProvider` — supplies the `Portal` client via context, with an optional `token` prop
  forwarded to `client.setToken` (login/logout); a fresh inline callback each render does not
  reconnect.
- `useChannel` — subscribes to a channel through `useSyncExternalStore`, drives the
  connection refcount from mount/unmount, and exposes the channel surface (messages, send,
  history, presence, activity, read state, status). Supports `readOn`
  (`"mount" | "visible" | "manual"`, including the visibility wiring) and `onMention` /
  `onError`.
- `useInbox` — subscribes to the inbox: `channels`, `items`, global `counter`, filtered
  `unseen`, `markAllRead`, and `status`, with an optional query.
- Client-only: the hooks fail loudly outside a browser (no SSR / RSC in v1). Ships
  `"use client"`.
