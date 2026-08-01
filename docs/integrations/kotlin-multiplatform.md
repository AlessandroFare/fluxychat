# Kotlin Multiplatform mobile SDK

Long-term mobile strategy: **one KMP module** shared between Android and iOS, wrapping the same WebSocket protocol as `@fluxy-chat/sdk`.

## Current state

| Package | Status |
|---------|--------|
| `packages/kotlin-sdk/` | Android starter (separate) |
| `packages/swift-sdk/` | iOS starter (separate) |
| `packages/sdk-kmp/` | **Planned** — PG-ZB-12 scaffold |

## Target layout (PG-ZB-12)

```
packages/sdk-kmp/
  shared/
    src/commonMain/kotlin/
      FluxyChatClient.kt      # WS connect, auth, heartbeat
      FluxyMessage.kt         # parity with TS FluxyChatMessage
      FluxyRoomApi.kt         # join, send, history cursor
    src/androidMain/kotlin/   # OkHttp engine
    src/iosMain/kotlin/       # Darwin engine
  androidApp/                 # sample Compose chat
  iosApp/                     # sample SwiftUI shell + KMP framework
```

## Protocol port checklist

Port from `packages/sdk/src/`:

- JWT / API key auth headers on WebSocket upgrade
- Event types: `message`, `typing`, `presence`, `reaction`
- Cursor pagination for history (`before` / `after` message id)
- Reconnect with exponential backoff (match `FluxyChatClient` TS behavior)

## Apple framework export

Follow [Kotlin Apple framework](https://kotlinlang.org/docs/apple-framework.html):

```bash
./gradlew :shared:linkReleaseFrameworkIosArm64
```

Embed `shared.framework` in Xcode; SwiftUI calls `FluxyChatClient` from Kotlin.

## References

- [Kotlin Multiplatform](https://kotlinlang.org/docs/multiplatform.html)
- TS SDK: `packages/sdk/src/client.ts`
- Mobile starters: `packages/kotlin-sdk/`, `packages/swift-sdk/`
