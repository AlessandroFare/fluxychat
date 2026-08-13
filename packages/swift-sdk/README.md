# FluxyChat Swift SDK (starter)

iOS/macOS REST client for FluxyChat. Realtime uses `URLSessionWebSocketTask` against `{wsUrl}/ws?roomId=&token=`.

## Swift Package Manager

```swift
// Package.swift dependency (local path during development)
.package(path: "../packages/swift-sdk")
```

Or add in Xcode: **File → Add Package Dependencies → Add Local**.

## Usage

```swift
import FluxyChatSDK

var config = FluxyChatConfig(
    apiUrl: "https://your-worker.workers.dev",
    wsUrl: "wss://your-worker.workers.dev",
    projectId: "your-project-id",
    token: memberJwt
)
let client = FluxyChatClient(config: config)

let history = try await client.listMessages(roomId: "room-demo")
let sent = try await client.sendMessage(roomId: "room-demo", content: "Hello from Swift")
client.setToken(refreshedJwt)
```

Decode JSON with `JSONDecoder` into your app models or extend `FluxyMessage`.

## WebSocket (realtime)

```swift
final class RoomListener: WebSocketEventListener {
    func onEvent(type: String, rawJson: String) {
        if type == "message" { /* decode */ }
    }
    func onStatusChange(_ status: ConnectionStatus) { }
}

let listener = RoomListener()
client.connectRoom("room-demo", listener: listener)
try await client.webSocket.sendMessage("Hello over WS")
client.disconnectRoom()
```

`URLSessionWebSocketTask` with ping loop + reconnect backoff.

## UI example

Copy-paste SwiftUI chat view: [`examples/MinimalChatView.swift`](examples/MinimalChatView.swift)

## Test

```bash
cd packages/swift-sdk && swift test
```

## Status

Starter package: REST + WebSocket. SwiftUI chat UI TBD.
