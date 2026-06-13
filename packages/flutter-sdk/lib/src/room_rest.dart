class RoomRestHelper {
  static const int kFluxyMaxMessageLength = 10000;

  static Map<String, dynamic> normalizeRoomMember(Map<String, dynamic> raw) {
    return {
      'userId': raw['userId'] ?? raw['user_id'] ?? '',
      'role': raw['role'] ?? 'member',
      if (raw['joined_at'] != null) 'joined_at': raw['joined_at'],
      if (raw['joinedAt'] != null) 'joinedAt': raw['joinedAt'],
      if (raw['notifyEnabled'] != null) 'notifyEnabled': raw['notifyEnabled'],
      if (raw['preferences'] != null) 'preferences': raw['preferences'],
    };
  }

  static List<Map<String, dynamic>> normalizeRoomMembers(List<dynamic> raw) {
    return raw.whereType<Map<String, dynamic>>().map(normalizeRoomMember).toList();
  }
}
