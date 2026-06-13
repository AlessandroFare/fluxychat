class MessageHistoryHelper {
  static List<T> sortMessagesChronological<T extends Map<String, dynamic>>(List<T> messages) {
    final sorted = List<T>.from(messages);
    sorted.sort((a, b) => (a['createdAt'] ?? '').toString().compareTo((b['createdAt'] ?? '').toString()));
    return sorted;
  }

  static List<T> mergeMessagesChronological<T extends Map<String, dynamic>>(List<T> existing, List<T> incoming) {
    final byId = <int, T>{};
    for (final msg in [...incoming, ...existing]) {
      final id = msg['id'];
      if (id is! int) continue;
      final prev = byId[id];
      byId[id] = prev != null ? {...prev, ...msg} as T : msg;
    }
    return sortMessagesChronological(byId.values.toList());
  }

  static int clampHistoryLimit(int? limit, {int defaultLimit = 50, int maxLimit = 500}) {
    final n = limit ?? defaultLimit;
    if (n < 1) return defaultLimit;
    return n > maxLimit ? maxLimit : n;
  }
}
