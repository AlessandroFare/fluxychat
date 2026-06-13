# fluxychat_sdk

Flutter SDK for FluxyChat - realtime chat infrastructure for SaaS.

## Installation

Add to your `pubspec.yaml`:

```yaml
dependencies:
  fluxychat_sdk:
    path: ../packages/flutter-sdk
```

## Quick Start

```dart
import 'package:fluxychat_sdk/fluxychat_sdk.dart';

final client = FluxyChatClient(
  config: FluxyChatConfig(
    apiUrl: 'https://your-worker.workers.dev',
    wsUrl: 'wss://your-worker.workers.dev',
    projectId: 'your-project-id',
    token: 'your-jwt-token',
  ),
);

// Connect to a room
await client.connect('room_123');

// Listen for messages
client.on('message', (event) {
  final message = event.data as Message;
  print('New message: ${message.content}');
});

// Send a message
await client.sendMessage(
  'room_123',
  content: 'Hello from Flutter!',
);

// Load messages
final messages = await client.loadMessages('room_123');
```

## API

### FluxyChatClient

```dart
final client = FluxyChatClient(
  config: FluxyChatConfig(
    apiUrl: 'https://api.example.com',
    wsUrl: 'wss://api.example.com',
    projectId: 'proj_123',
    token: 'jwt_token',
    debug: false,
  ),
);
```

### Methods

- `connect(roomId)` - Connect to a room via WebSocket
- `disconnect()` - Disconnect from current room
- `listRooms()` - List all rooms
- `createRoom(name, type)` - Create a new room
- `sendMessage(roomId, content)` - Send a message
- `loadMessages(roomId)` - Load message history
- `sendTyping(roomId, typing)` - Send typing indicator
- `addReaction(roomId, messageId, emoji)` - Add reaction
- `invokeAgent(roomId, agentId, message)` - Invoke AI agent
- `searchMessages(query)` - Search messages

### Events

- `message` - New message received
- `typing` - User typing indicator
- `presence` - User presence change
- `read` - Read receipt
- `reaction` - Message reaction

## Features

- REST API client for rooms, messages, members
- WebSocket with auto-reconnect and exponential backoff
- Typing indicators and presence
- Read receipts
- Message reactions
- AI agent invocation
- Message search

## Testing

```bash
flutter test test/protocol_contract_test.dart
```

Protocol parity is validated against `packages/protocol/protocol-events.json`.

## License

MIT
