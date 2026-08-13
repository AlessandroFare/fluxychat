# FluxyChat Unity SDK (skeleton)

Minimal C# client for Unity games. REST and WebSocket parity with `@fluxy-chat/sdk`.

## Status

Skeleton: connect, list rooms, send/receive messages. Extend for voice stage and push when shipping a game vertical.

## Quick start

1. Copy `Runtime/` into your Unity project under `Assets/FluxyChat/`.
2. Set `FluxyChatConfig` on `FluxyChatClient` (API URL, WS URL, project ID, JWT).
3. Call `ConnectRoom(roomId)` and subscribe to `OnMessage`.

## Example

```csharp
var client = new FluxyChatClient(new FluxyChatConfig {
    ApiUrl = "https://worker.example.com",
    WsUrl = "wss://worker.example.com",
    ProjectId = "your-project-id",
    Token = memberJwt,
});
client.OnMessage += msg => Debug.Log(msg.Content);
await client.ConnectRoomAsync("room-id");
await client.SendMessageAsync("room-id", "Hello from Unity");
```

## License

MIT, same as FluxyChat monorepo.
