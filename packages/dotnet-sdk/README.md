# FluxyChat .NET SDK — **unpublished stub**

> Not a supported product surface. Not on NuGet. Do not list this in marketing as a shipping SDK.
> Gold path: `npx @fluxy-chat/create-fluxy-chat@latest` and `@fluxy-chat/sdk`.



Cross-platform .NET client for server apps, Unity headless, and MAUI. Mirrors `@fluxy-chat/sdk` REST and user-channel WebSocket.

## Status

Skeleton: rooms, messages, inbox summary, push device registration.

## Install

```bash
dotnet add package FluxyChat.Sdk   # when published; for now reference the project
```

## Example

```csharp
using FluxyChat;

var client = new FluxyChatClient(new FluxyChatOptions {
    BaseUrl = "https://worker.example.com",
    ProjectId = "project-uuid",
    Token = memberJwt,
});

var rooms = await client.ListRoomsAsync();
var messages = await client.ListMessagesAsync("room-id");
await client.SendMessageAsync("room-id", "Hello from .NET");
var inbox = await client.GetInboxAsync();
```

## License

MIT
