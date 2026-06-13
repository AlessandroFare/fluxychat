import 'dart:math';

class MessageDeliveryHelper {
  static int _optimisticIdCounter = 0;

  static String createClientMessageId() {
    return 'cmsg_${DateTime.now().millisecondsSinceEpoch}_${Random().nextInt(999999)}';
  }

  static int nextOptimisticMessageId() {
    _optimisticIdCounter -= 1;
    return _optimisticIdCounter;
  }

  static Map<String, dynamic> createOptimisticMessage({
    required String roomId,
    required String userId,
    required String content,
    required String clientMessageId,
    int? parentId,
  }) {
    return {
      'id': nextOptimisticMessageId(),
      'roomId': roomId,
      'userId': userId,
      'content': content,
      'createdAt': DateTime.now().toIso8601String(),
      'parentId': parentId,
      'clientMessageId': clientMessageId,
      'deliveryStatus': 'pending',
    };
  }

  static List<Map<String, dynamic>> applyServerMessageAck(
    List<Map<String, dynamic>> messages,
    Map<String, dynamic> serverMessage,
    String clientMessageId,
  ) {
    final withoutPending = messages.where((m) => m['clientMessageId'] != clientMessageId).toList();
    final acked = Map<String, dynamic>.from(serverMessage)
      ..['clientMessageId'] = clientMessageId
      ..['deliveryStatus'] = 'sent';
    withoutPending.add(acked);
    withoutPending.sort((a, b) => (a['createdAt'] ?? '').toString().compareTo((b['createdAt'] ?? '').toString()));
    return withoutPending;
  }
}
