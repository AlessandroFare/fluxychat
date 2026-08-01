# Kotlin Multiplatform mobile SDK

Shared WebSocket client for Android and iOS — same protocol as `@fluxy-chat/sdk`.

## Current state

| Package | Status |
|---------|--------|
| `packages/sdk-kmp/` | **Active** — Ktor WS, Android / iOS / JVM |
| `packages/kotlin-sdk/` | Legacy Android starter |
| `packages/swift-sdk/` | Legacy iOS starter |

## Layout

```
packages/sdk-kmp/
  shared/src/commonMain/kotlin/   FluxyChatClient, FluxyRoomWebSocket
  shared/src/androidMain/         OkHttp engine
  shared/src/iosMain/             Darwin engine
  shared/src/jvmMain/             CIO engine (tests)
```

## Build locally

Requires JDK 17+.

```bash
cd packages/sdk-kmp
gradle :shared:jvmTest
gradle :shared:compileDebugKotlinAndroid
```

CI uses `gradle/actions/setup-gradle@v4` (no local wrapper required).

## Usage

```kotlin
val config = FluxyChatConfig(
    apiUrl = "https://api.example.com",
    wsUrl = FluxyChatConfig.wsUrlFromApi("https://api.example.com"),
    projectId = "your-project-uuid",
    token = memberJwt,
)
val client = FluxyChatClient(config)
client.connectRoom("general")
client.sendMessage("general", "Hello from KMP")
```

## Publish to Maven Central

Tag `sdk-v*` triggers `.github/workflows/publish-sdk-kmp.yml`.

**Full setup (Sonatype, GPG, GitHub secrets):** [maven-central-publish.md](./maven-central-publish.md)

Coordinates: `com.fluxychat:shared`

## iOS

XCFramework zip attached to GitHub Release on each `sdk-v*` tag. Embed in Xcode per [Kotlin Apple framework docs](https://kotlinlang.org/docs/apple-framework.html).

## References

- [maven-central-publish.md](./maven-central-publish.md)
- `packages/sdk-kmp/README.md`
- TS SDK: `packages/sdk/src/`
