const int kFluxyMaxMessageLength = 10000;

class AgentOutboundValidationResult {
  final bool valid;
  final String? error;
  final String? content;
  final int? parentId;
  const AgentOutboundValidationResult({required this.valid, this.error, this.content, this.parentId});
}

AgentOutboundValidationResult validateAgentOutboundMessage({
  required String userId,
  required String content,
  int? parentId,
  List<dynamic>? attachments,
}) {
  final trimmedUserId = userId.trim();
  if (trimmedUserId.isEmpty) return AgentOutboundValidationResult(valid: false, error: 'userId is required');
  if (trimmedUserId.length > 128) return AgentOutboundValidationResult(valid: false, error: 'userId exceeds maximum length');
  if (content.isEmpty) return AgentOutboundValidationResult(valid: false, error: 'content cannot be empty');
  final trimmed = content.trim();
  if (trimmed.isEmpty) return AgentOutboundValidationResult(valid: false, error: 'content cannot be empty');
  if (trimmed.length > kFluxyMaxMessageLength) return AgentOutboundValidationResult(valid: false, error: 'content exceeds maximum length of $kFluxyMaxMessageLength characters');
  int? validParentId;
  if (parentId != null) {
    if (parentId < 1) return AgentOutboundValidationResult(valid: false, error: 'parentId must be a positive message id');
    validParentId = parentId;
  }
  if (attachments != null && attachments.length > 20) return AgentOutboundValidationResult(valid: false, error: 'attachments cannot exceed 20 items');
  return AgentOutboundValidationResult(valid: true, content: trimmed, parentId: validParentId);
}

Map<String, dynamic> buildAgentOutboundWsPayload({
  required String userId,
  required String content,
  int? parentId,
  List<dynamic>? attachments,
}) {
  final validated = validateAgentOutboundMessage(userId: userId, content: content, parentId: parentId, attachments: attachments);
  if (!validated.valid) throw Exception(validated.error ?? 'Invalid agent outbound message');
  return {'type': 'message', 'userId': userId.trim(), 'content': validated.content, 'parentId': validated.parentId, 'attachments': attachments ?? []};
}
