# FluxyChat Kotlin SDK (starter)

JVM/Android REST client for FluxyChat rooms and messages. WebSocket subscribe uses the same JWT as `@fluxy-chat/sdk` — wire with OkHttp WebSocket on Android.

## Gradle (included build)

```kotlin
dependencies {
    implementation(project(":kotlin-sdk")) // or publish artifact when available
}
```

## Usage

```kotlin
import chat.fluxy.sdk.FluxyChatClient
import chat.fluxy.sdk.FluxyChatConfig

val client = FluxyChatClient(
    FluxyChatConfig(
        apiUrl = "https://your-worker.workers.dev",
        wsUrl = "wss://your-worker.workers.dev",
        projectId = "your-project-id",
        token = memberJwt,
    ),
)

val historyJson = client.listMessages("room-demo", limit = 50)
val sentJson = client.sendMessage("room-demo", "Hello from Kotlin")
client.setToken(refreshedJwt)
```

## WebSocket (realtime)

```kotlin
client.connectRoom("room-demo", object : WebSocketEventListener {
    override fun onEvent(type: String, rawJson: String) {
        if (type == "message") { /* parse JSON */ }
    }
    override fun onStatusChange(status: ConnectionStatus) {
        // CONNECTED, RECONNECTING, …
    }
})
client.webSocket.sendMessage("Hello over WS")
client.disconnectRoom()
```

Uses OkHttp with ping + exponential reconnect (max 10 attempts).

## UI example

Copy-paste Jetpack Compose chat screen: [`examples/MinimalChatScreen.kt`](examples/MinimalChatScreen.kt)

## Status

Starter package: REST + WebSocket (OkHttp). Compose/SwiftUI UI TBD.

## Test

```bash
cd packages/kotlin-sdk && ./gradlew test
```

On Windows without Gradle wrapper, install Gradle 8+ or use Android Studio import.
