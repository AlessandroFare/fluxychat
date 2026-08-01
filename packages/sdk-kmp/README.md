# FluxyChat Kotlin Multiplatform SDK

Shared WebSocket + REST client for Android and iOS (Ktor engines).

## Status

- **commonMain** — `FluxyChatClient`, `FluxyRoomWebSocket` (Ktor WS)
- **androidMain** — OkHttp engine
- **iosMain** — Darwin engine
- **jvmMain** — CIO engine (tests/desktop)

## Build

Requires JDK 17+ and Android SDK for `androidTarget`.

```bash
cd packages/sdk-kmp
./gradlew :shared:compileKotlinIosSimulatorArm64
./gradlew :shared:compileDebugKotlinAndroid
./gradlew :shared:jvmTest
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
client.setEventListener { event ->
    when (event) {
        is FluxyWsEvent.Message -> println(event.payload)
        is FluxyWsEvent.Connection -> println(event.status)
        is FluxyWsEvent.Error -> println(event.message)
    }
}
client.connectRoom("general")
client.sendMessage("general", "Hello from KMP")
```

Legacy Android-only SDK: `packages/kotlin-sdk/`.
