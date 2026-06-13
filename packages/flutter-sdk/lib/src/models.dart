class FluxyChatConfig {
  final String apiUrl;
  final String wsUrl;
  final String projectId;
  final String token;
  final bool debug;
  const FluxyChatConfig({required this.apiUrl, required this.wsUrl, required this.projectId, required this.token, this.debug = false});
}

class Message {
  final int id;
  final String roomId;
  final String userId;
  final String? senderId;
  final String content;
  final String kind;
  final Map<String, dynamic>? metadata;
  final int? parentId;
  final String? editedAt;
  final String? deletedAt;
  final DateTime createdAt;
  final bool? streaming;
  final String? clientMessageId;
  final String? deliveryStatus;
  final String? audioUrl;
  final String? audioMimeType;
  final int? audioSizeBytes;
  final int? durationMs;
  final String? transcription;
  final String? transcriptionStatus;
  final List<Map<String, dynamic>>? attachments;

  const Message({
    required this.id,
    required this.roomId,
    required this.userId,
    this.senderId,
    required this.content,
    this.kind = 'text',
    this.metadata,
    this.parentId,
    this.editedAt,
    this.deletedAt,
    required this.createdAt,
    this.streaming,
    this.clientMessageId,
    this.deliveryStatus,
    this.audioUrl,
    this.audioMimeType,
    this.audioSizeBytes,
    this.durationMs,
    this.transcription,
    this.transcriptionStatus,
    this.attachments,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] is int ? json['id'] : int.tryParse('${json['id']}') ?? 0,
      roomId: json['roomId'] ?? json['room_id'] ?? '',
      userId: json['userId'] ?? json['user_id'] ?? '',
      senderId: json['senderId'] ?? json['sender_id'],
      content: json['content'] ?? '',
      kind: json['kind'] ?? 'text',
      metadata: json['metadata'],
      parentId: json['parentId'] ?? json['parent_id'],
      editedAt: json['editedAt'] ?? json['edited_at'],
      deletedAt: json['deletedAt'] ?? json['deleted_at'],
      createdAt: DateTime.tryParse(json['createdAt'] ?? json['created_at'] ?? '') ?? DateTime.now(),
      streaming: json['streaming'],
      clientMessageId: json['clientMessageId'],
      deliveryStatus: json['deliveryStatus'],
      audioUrl: json['audioUrl'],
      audioMimeType: json['audioMimeType'],
      audioSizeBytes: json['audioSizeBytes'],
      durationMs: json['durationMs'],
      transcription: json['transcription'],
      transcriptionStatus: json['transcriptionStatus'],
      attachments: json['attachments'] != null ? List<Map<String, dynamic>>.from(json['attachments']) : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id, 'roomId': roomId, 'userId': userId, 'senderId': senderId,
    'content': content, 'kind': kind, 'metadata': metadata, 'parentId': parentId,
    'editedAt': editedAt, 'deletedAt': deletedAt, 'createdAt': createdAt.toIso8601String(),
    'streaming': streaming, 'clientMessageId': clientMessageId, 'deliveryStatus': deliveryStatus,
    'audioUrl': audioUrl, 'transcription': transcription, 'transcriptionStatus': transcriptionStatus,
    'attachments': attachments,
  };
}

class Room {
  final String id;
  final String projectId;
  final String name;
  final String? description;
  final String type;
  final int memberCount;
  final String? lastMessageAt;
  final DateTime createdAt;
  const Room({required this.id, required this.projectId, required this.name, this.description, required this.type, this.memberCount = 0, this.lastMessageAt, required this.createdAt});
  factory Room.fromJson(Map<String, dynamic> json) => Room(
    id: json['id'] ?? '', projectId: json['projectId'] ?? json['project_id'] ?? '',
    name: json['name'] ?? '', description: json['description'],
    type: json['type'] ?? 'group', memberCount: json['memberCount'] ?? json['member_count'] ?? 0,
    lastMessageAt: json['lastMessageAt'] ?? json['last_message_at'],
    createdAt: DateTime.tryParse(json['createdAt'] ?? json['created_at'] ?? '') ?? DateTime.now(),
  );
}

class User {
  final String id;
  final String? displayName;
  final String? avatarUrl;
  final String status;
  final String? lastSeenAt;
  const User({required this.id, this.displayName, this.avatarUrl, this.status = 'offline', this.lastSeenAt});
  factory User.fromJson(Map<String, dynamic> json) => User(
    id: json['id'] ?? '', displayName: json['displayName'] ?? json['display_name'],
    avatarUrl: json['avatarUrl'] ?? json['avatar_url'],
    status: json['status'] ?? 'offline', lastSeenAt: json['lastSeenAt'] ?? json['last_seen_at'],
  );
}

enum ConnectionStatus { connecting, connected, disconnected, reconnecting }

class ChatEvent {
  final String type;
  final dynamic data;
  final String? roomId;
  final DateTime timestamp;
  const ChatEvent({required this.type, required this.data, this.roomId, required this.timestamp});
}

typedef EventHandler = void Function(ChatEvent event);
