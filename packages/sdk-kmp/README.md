# FluxyChat Kotlin Multiplatform SDK

Shared WebSocket + REST client for Android and iOS (Ktor engines).

## Status

- **commonMain** — `FluxyChatClient`, `FluxyRoomWebSocket` (Ktor WS)
- **androidMain** — OkHttp engine
- **iosMain** — Darwin engine
- **jvmMain** — CIO engine (tests/desktop)
- **CI** — `.github/workflows/publish-sdk-kmp.yml` on tags `sdk-v*`

## Build

Requires JDK 17+ and Android SDK for `androidTarget`.

```bash
cd packages/sdk-kmp
gradle :shared:jvmTest
gradle :shared:compileDebugKotlinAndroid
```

## Publish

Maven Central: see [docs/integrations/maven-central-publish.md](../../docs/integrations/maven-central-publish.md).

```bash
git tag sdk-v1.0.0 && git push origin sdk-v1.0.0
```

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

Legacy Android-only SDK: `packages/kotlin-sdk/`.
