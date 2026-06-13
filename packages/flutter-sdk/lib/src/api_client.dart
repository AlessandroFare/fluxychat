import 'dart:convert';
import 'package:http/http.dart' as http;
import 'models.dart';

class ApiClient {
  final String baseUrl;
  final String projectId;
  final String token;
  final Map<String, String> headers;

  ApiClient({
    required this.baseUrl,
    required this.projectId,
    required this.token,
  }) : headers = {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
          'X-Project-Id': projectId,
        };

  Future<T> _request<T>(
    String method,
    String path, {
    Map<String, dynamic>? body,
    T Function(dynamic)? parser,
  }) async {
    final url = '$baseUrl$path';
    final response = await http.Client().send(
      http.Request(method, Uri.parse(url))
        ..headers.addAll(headers)
        ..body = body != null ? jsonEncode(body) : null,
    );

    final responseBody = await response.stream.bytesToString();

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final json = jsonDecode(responseBody);
      return parser != null ? parser(json) : json as T;
    } else {
      final error = jsonDecode(responseBody);
      throw Exception(error['error'] ?? 'HTTP ${response.statusCode}');
    }
  }

  // Rooms
  Future<List<Room>> listRooms({int limit = 25, String? before}) async {
    final params = <String, String>{'limit': limit.toString()};
    if (before != null) params['before'] = before;
    final query = Uri(queryParameters: params).query;
    return _request<List<Room>>(
      'GET',
      '/api/rooms?$query',
      parser: (json) => (json as List).map((r) => Room.fromJson(r)).toList(),
    );
  }

  Future<Room> getRoom(String roomId) async {
    return _request<Room>(
      'GET',
      '/api/rooms/$roomId',
      parser: (json) => Room.fromJson(json),
    );
  }

  Future<Room> createRoom(String name, {String type = 'group'}) async {
    return _request<Room>(
      'POST',
      '/api/rooms',
      body: {'name': name, 'type': type},
      parser: (json) => Room.fromJson(json),
    );
  }

  Future<Room> updateRoom(String roomId, Map<String, dynamic> data) async {
    return _request<Room>(
      'PATCH',
      '/api/rooms/$roomId',
      body: data,
      parser: (json) => Room.fromJson(json),
    );
  }

  Future<void> deleteRoom(String roomId) async {
    await _request<void>('DELETE', '/api/rooms/$roomId');
  }

  // Members
  Future<void> addMember(String roomId, String userId) async {
    await _request<void>(
      'POST',
      '/api/rooms/$roomId/members',
      body: {'userId': userId},
    );
  }

  Future<void> removeMember(String roomId, String userId) async {
    await _request<void>(
      'DELETE',
      '/api/rooms/$roomId/members',
      body: {'userId': userId},
    );
  }

  Future<List<User>> listMembers(String roomId) async {
    return _request<List<User>>(
      'GET',
      '/api/rooms/$roomId/members',
      parser: (json) => (json as List).map((u) => User.fromJson(u)).toList(),
    );
  }

  // Messages
  Future<List<Message>> listMessages(
    String roomId, {
    int limit = 50,
    String? before,
  }) async {
    final params = <String, String>{'limit': limit.toString()};
    if (before != null) params['before'] = before;
    final query = Uri(queryParameters: params).query;
    return _request<List<Message>>(
      'GET',
      '/api/rooms/$roomId/messages?$query',
      parser: (json) => (json as List).map((m) => Message.fromJson(m)).toList(),
    );
  }

  Future<Message> sendMessage(
    String roomId,
    String content, {
    String kind = 'text',
    Map<String, dynamic>? metadata,
  }) async {
    return _request<Message>(
      'POST',
      '/api/rooms/$roomId/messages',
      body: {'content': content, 'kind': kind, 'metadata': metadata},
      parser: (json) => Message.fromJson(json),
    );
  }

  Future<Message> editMessage(
    String roomId,
    String messageId,
    String content,
  ) async {
    return _request<Message>(
      'PATCH',
      '/api/rooms/$roomId/messages/$messageId',
      body: {'content': content},
      parser: (json) => Message.fromJson(json),
    );
  }

  Future<void> deleteMessage(String roomId, String messageId) async {
    await _request<void>('DELETE', '/api/rooms/$roomId/messages/$messageId');
  }

  // Reactions
  Future<void> addReaction(
    String roomId,
    String messageId,
    String emoji,
  ) async {
    await _request<void>(
      'POST',
      '/api/rooms/$roomId/messages/$messageId/reactions',
      body: {'emoji': emoji},
    );
  }

  Future<void> removeReaction(
    String roomId,
    String messageId,
    String emoji,
  ) async {
    await _request<void>(
      'DELETE',
      '/api/rooms/$roomId/messages/$messageId/reactions',
      body: {'emoji': emoji},
    );
  }

  // Presence
  Future<Map<String, dynamic>> getPresence(String roomId) async {
    return _request<Map<String, dynamic>>('GET', '/api/rooms/$roomId/presence');
  }

  // AI
  Future<Message> invokeAgent(
    String roomId,
    String agentId,
    String message,
  ) async {
    return _request<Message>(
      'POST',
      '/api/rooms/$roomId/ai/invoke',
      body: {'agentId': agentId, 'message': message},
      parser: (json) => Message.fromJson(json),
    );
  }

  // Search
  Future<List<Message>> searchMessages(String query, {String? roomId}) async {
    final params = <String, String>{'q': query};
    if (roomId != null) params['roomId'] = roomId;
    final queryStr = Uri(queryParameters: params).query;
    return _request<List<Message>>(
      'GET',
      '/api/search?$queryStr',
      parser: (json) => (json as List).map((m) => Message.fromJson(m)).toList(),
    );
  }
}
