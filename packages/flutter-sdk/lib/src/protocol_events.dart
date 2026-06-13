/// Wire protocol event types shared with `@fluxychat/protocol`.
/// Keep in sync with `packages/protocol/protocol-events.json`.
const String fluxyProtocolVersion = '1.0.0';

const List<String> fluxyInboundEventTypes = [
  'message',
  'message_edit',
  'message_delete',
  'message_expired',
  'typing',
  'subscription_succeeded',
  'subscription_count',
  'member_joined',
  'member_left',
  'client_event',
  'agentTyping',
  'tool_call',
  'tool_result',
  'tool_error',
  'agentRun',
  'presence',
  'cache_snapshot',
  'server_event',
  'user_event',
  'user_subscription_succeeded',
  'state_change',
  'stream',
  'pong',
  'error',
];

const List<String> fluxyOutboundEventTypes = [
  'ping',
  'message',
  'stream',
  'edit',
  'reaction',
  'read',
  'delete',
  'typing',
  'client_event',
  'agentTyping',
];

bool isFluxyInboundEvent(Map<String, dynamic> event) {
  final type = event['type'];
  return type is String && fluxyInboundEventTypes.contains(type);
}

bool isFluxyOutboundEvent(Map<String, dynamic> event) {
  final type = event['type'];
  return type is String && fluxyOutboundEventTypes.contains(type);
}
