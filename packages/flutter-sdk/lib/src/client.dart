import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'models.dart';
import 'api_client.dart';
import 'websocket_client.dart';
import 'errors.dart';
import 'jwt_utils.dart';
import 'url_utils.dart';
import 'message_delivery.dart';
import 'message_history.dart';
import 'room_rest.dart';

class FluxyChatClient {
  final FluxyChatConfig config;
  late final ApiClient api;
  late final WebSocketClient ws;
  String? _currentRoomId;
  final Map<String, Room> _rooms = {};
  final Map<String, List<Message>> _messages = {};
  final Map<String, String> _e2eKeys = {};
  WebSocket? _userWs;
  final Map<String, Set<EventHandler>> _userHandlers = {};

  FluxyChatClient({required this.config})
      : api = ApiClient(baseUrl: config.apiUrl, projectId: config.projectId, token: config.token),
        ws = WebSocketClient(wsUrl: config.wsUrl, projectId: config.projectId, token: config.token, debug: config.debug);

  // Connection
  Future<void> connect(String roomId) async { _currentRoomId = roomId; ws.connect(roomId); }
  void disconnect() { ws.disconnect(); _currentRoomId = null; }
  ConnectionStatus get connectionStatus => ws.status;

  // Events
  void on(String event, EventHandler handler) => ws.on(event, handler);
  void off(String event, EventHandler handler) => ws.off(event, handler);
  void onStatusChange(void Function(ConnectionStatus) handler) => ws.onStatusChange(handler);

  // Rooms
  Future<List<Room>> listRooms({int limit = 25, String? before}) async {
    final rooms = await api.listRooms(limit: limit, before: before);
    for (final room in rooms) { _rooms[room.id] = room; }
    return rooms;
  }
  Future<Room> getRoom(String roomId) async { final room = await api.getRoom(roomId); _rooms[room.id] = room; return room; }
  Future<Room> createRoom(String name, {String type = 'group'}) async { final room = await api.createRoom(name, type: type); _rooms[room.id] = room; return room; }
  Future<Room> updateRoom(String roomId, Map<String, dynamic> data) async { final room = await api.updateRoom(roomId, data); _rooms[room.id] = room; return room; }
  Future<void> deleteRoom(String roomId) async { await api.deleteRoom(roomId); _rooms.remove(roomId); _messages.remove(roomId); }

  // Members
  Future<void> addMember(String roomId, String userId) async { await api.addMember(roomId, userId); }
  Future<void> removeMember(String roomId, String userId) async { await api.removeMember(roomId, userId); }
  Future<List<User>> listMembers(String roomId) async { return api.listMembers(roomId); }

  // Messages
  Future<List<Message>> loadMessages(String roomId, {int limit = 50, String? before}) async {
    final l = MessageHistoryHelper.clampHistoryLimit(limit);
    final messages = await api.listMessages(roomId, limit: l, before: before);
    _messages.putIfAbsent(roomId, () => []).addAll(messages);
    return messages;
  }

  Future<Message> sendMessage(String roomId, {required String content, String kind = 'text', Map<String, dynamic>? metadata, int? parentId}) async {
    final message = await api.sendMessage(roomId, content, kind: kind, metadata: metadata);
    _messages.putIfAbsent(roomId, () => []).add(message);
    return message;
  }

  Map<String, dynamic> sendOptimisticMessage(String roomId, String userId, String content, {int? parentId}) {
    return MessageDeliveryHelper.createOptimisticMessage(roomId: roomId, userId: userId, content: content, clientMessageId: MessageDeliveryHelper.createClientMessageId(), parentId: parentId);
  }

  Future<Message> editMessage(String roomId, String messageId, String content) async { return api.editMessage(roomId, messageId, content); }
  Future<void> deleteMessage(String roomId, String messageId) async { await api.deleteMessage(roomId, messageId); _messages[roomId]?.removeWhere((m) => '${m.id}' == messageId); }
  List<Message> getMessages(String roomId) => _messages[roomId] ?? [];

  // Reactions
  Future<void> addReaction(String roomId, String messageId, String emoji) async { await api.addReaction(roomId, messageId, emoji); }
  Future<void> removeReaction(String roomId, String messageId, String emoji) async { await api.removeReaction(roomId, messageId, emoji); }

  // Typing
  void sendTyping(String roomId, bool typing) { ws.sendTyping(roomId, typing); }

  // Presence
  Future<Map<String, dynamic>> getPresence(String roomId) async { return api.getPresence(roomId); }
  void sendPresence(String roomId, String status) { ws.sendPresence(roomId, status); }

  // Read receipts
  void sendReadReceipt(String roomId, String messageId) { ws.sendReadReceipt(roomId, messageId); }

  // AI
  Future<Message> invokeAgent(String roomId, String agentId, String message) async { return api.invokeAgent(roomId, agentId, message); }

  // Search
  Future<List<Message>> searchMessages(String query, {String? roomId}) async { return api.searchMessages(query, roomId: roomId); }

  // --- E2E ---
  void setE2eKey(String roomId, String key) { _e2eKeys[roomId] = key; }
  String? getE2eKey(String roomId) => _e2eKeys[roomId];

  Future<Map<String, dynamic>?> getRoomE2eKey(String roomId) async {
    try {
      final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/rooms/${Uri.encodeComponent(roomId)}/e2e-key'),
          headers: {'Authorization': 'Bearer ${config.token}'});
      if (res.statusCode != 200) return null;
      return jsonDecode(res.body);
    } catch (_) { return null; }
  }

  // --- User Channel ---
  void connectUser([String? userId]) {
    final uid = userId ?? decodeFluxyJwtPayload(config.token).sub;
    if (uid == null) return;
    final wsBase = config.wsUrl.replaceFirst('http', 'ws');
    final url = Uri.parse('$wsBase/ws/user/${Uri.encodeComponent(uid)}?token=${Uri.encodeComponent(config.token)}&userId=${Uri.encodeComponent(uid)}');
    _userWs = WebSocket(url);
    _userWs!.stream.listen((data) {
      try {
        final event = ChatEvent(type: 'user_event', data: jsonDecode(data), timestamp: DateTime.now());
        _userHandlers[event.type]?.forEach((h) => h(event));
      } catch (_) {}
    });
  }

  void onUserEvent(String event, EventHandler handler) {
    _userHandlers.putIfAbsent(event, () => {}).add(handler);
  }

  void disconnectUser() { _userWs?.sink.close(); _userWs = null; }

  // --- Notifications ---
  Future<List<Map<String, dynamic>>> getNotifications({int limit = 50}) async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/notifications?limit=$limit'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return [];
    final body = jsonDecode(res.body);
    return List<Map<String, dynamic>>.from(body['notifications'] ?? []);
  }

  Future<void> markNotificationRead(int notificationId) async {
    await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/notifications/$notificationId/read'),
        headers: {'Authorization': 'Bearer ${config.token}'});
  }

  // --- Digest ---
  Future<Map<String, dynamic>?> getDigestPreferences() async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/digest/preferences'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body)['preferences'];
  }

  // --- Quiet Hours ---
  Future<Map<String, dynamic>?> getQuietHoursPreferences() async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/notifications/quiet-hours'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  // --- Inbox ---
  Future<Map<String, dynamic>?> getInbox() async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/inbox'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  // --- Room REST ---
  Future<List<Map<String, dynamic>>> fetchRoomMembers(String roomId) async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/rooms/${Uri.encodeComponent(roomId)}/members'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return [];
    return List<Map<String, dynamic>>.from(jsonDecode(res.body)['members'] ?? []);
  }

  Future<Map<String, dynamic>?> getRoomLive(String roomId) async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/rooms/${Uri.encodeComponent(roomId)}/live'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  // --- Templates ---
  Future<List<Map<String, dynamic>>> listMessageTemplates() async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/templates'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return [];
    return List<Map<String, dynamic>>.from(jsonDecode(res.body)['templates'] ?? []);
  }

  // --- Voice Messages ---
  Future<Message?> sendVoiceMessage(String roomId, List<int> audioBytes, {String? parentId, int? durationMs}) async {
    final request = http.MultipartRequest('POST', Uri.parse('${trimTrailingSlashes(config.apiUrl)}/messages/voice'));
    request.headers['Authorization'] = 'Bearer ${config.token}';
    request.files.add(http.MultipartFile.fromBytes('audio', audioBytes, filename: 'voice.webm'));
    request.fields['roomId'] = roomId;
    if (parentId != null) request.fields['parentId'] = '$parentId';
    if (durationMs != null) request.fields['durationMs'] = '$durationMs';
    final streamed = await request.send();
    final res = await http.Response.fromStream(streamed);
    if (res.statusCode != 200) return null;
    final body = jsonDecode(res.body);
    return body['message'] != null ? Message.fromJson(body['message']) : null;
  }

  // --- Reply Suggestions ---
  Future<List<String>> suggestReplies(String roomId, {String? parentId}) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/messages/suggest-replies'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'roomId': roomId, if (parentId != null) 'parentId': parentId}));
    if (res.statusCode != 200) return [];
    return List<String>.from(jsonDecode(res.body)['suggestions'] ?? []);
  }

  // --- Thread Summary ---
  Future<Map<String, dynamic>?> summarizeThread(String messageId, String roomId) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/messages/${Uri.encodeComponent(messageId)}/summary'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'roomId': roomId}));
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  // --- Watchlist ---
  Future<List<Map<String, dynamic>>> getWatchlist() async {
    final uid = decodeFluxyJwtPayload(config.token).sub;
    if (uid == null) return [];
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/users/${Uri.encodeComponent(uid)}/watchlist'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return [];
    return List<Map<String, dynamic>>.from(jsonDecode(res.body)['targets'] ?? []);
  }

  Future<bool> addWatchlistTarget(String type, String targetId) async {
    final uid = decodeFluxyJwtPayload(config.token).sub;
    if (uid == null) return false;
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/users/${Uri.encodeComponent(uid)}/watchlist'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'type': type, 'targetId': targetId}));
    return res.statusCode == 200;
  }

  Future<bool> removeWatchlistTarget(String type, String targetId) async {
    final uid = decodeFluxyJwtPayload(config.token).sub;
    if (uid == null) return false;
    final res = await http.delete(
        Uri.parse('${trimTrailingSlashes(config.apiUrl)}/users/${Uri.encodeComponent(uid)}/watchlist?type=${Uri.encodeComponent(type)}&targetId=${Uri.encodeComponent(targetId)}'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    return res.statusCode == 200;
  }

  // --- Sign In (API key JWT minting) ---
  Future<Map<String, dynamic>?> signIn({String? userId, List<String>? roles, int? ttlSeconds}) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/auth/signin'),
        headers: {'Content-Type': 'application/json', 'X-Fluxy-Api-Key': config.token},
        body: jsonEncode({'userId': userId ?? config.userId, if (roles != null) 'roles': roles, if (ttlSeconds != null) 'ttlSeconds': ttlSeconds}));
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  // --- Trigger Events ---
  Future<Map<String, dynamic>> triggerEvents({required List<String> roomIds, String? name, dynamic data}) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/events'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'roomIds': roomIds, if (name != null) 'name': name, if (data != null) 'data': data}));
    if (res.statusCode != 200) return {'ok': false, 'triggered': <String>[]};
    return jsonDecode(res.body);
  }

  // --- User Events ---
  Future<bool> triggerUserEvent(String targetUserId, {required String name, dynamic data}) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/users/${Uri.encodeComponent(targetUserId)}/events'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'name': name, if (data != null) 'data': data}));
    return res.statusCode == 200;
  }

  Future<bool> terminateUserConnections(String targetUserId) async {
    final res = await http.delete(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/users/${Uri.encodeComponent(targetUserId)}/connections'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    return res.statusCode == 200;
  }

  // --- Template CRUD ---
  Future<Map<String, dynamic>?> createMessageTemplate(String name, String body) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/templates'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'name': name, 'body': body}));
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body)['template'];
  }

  Future<Map<String, dynamic>?> updateMessageTemplate(String templateId, {String? name, String? body}) async {
    final res = await http.patch(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/templates/${Uri.encodeComponent(templateId)}'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({if (name != null) 'name': name, if (body != null) 'body': body}));
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body)['template'];
  }

  Future<bool> deleteMessageTemplate(String templateId) async {
    final res = await http.delete(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/templates/${Uri.encodeComponent(templateId)}'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    return res.statusCode == 200;
  }

  Future<String?> renderMessageTemplate({String? templateId, String? body, Map<String, dynamic>? vars}) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/templates/render'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'templateId': templateId, 'body': body, 'vars': vars, 'templateVars': vars}));
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body)['content']?.toString();
  }

  // --- Activities ---
  Future<List<Map<String, dynamic>>> listActivities({int? limit, String? roomId}) async {
    final params = <String, String>{};
    if (limit != null) params['limit'] = '$limit';
    if (roomId != null) params['roomId'] = roomId;
    final uri = Uri.parse('${trimTrailingSlashes(config.apiUrl)}/activities').replace(queryParameters: params);
    final res = await http.get(uri, headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return [];
    return List<Map<String, dynamic>>.from(jsonDecode(res.body)['activities'] ?? []);
  }

  // --- Member Preferences ---
  Future<Map<String, dynamic>?> updateMemberPreferences(String roomId, {bool? notifyEnabled, Map<String, dynamic>? preferences}) async {
    final res = await http.patch(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/rooms/${Uri.encodeComponent(roomId)}/members/me/preferences'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({if (notifyEnabled != null) 'notifyEnabled': notifyEnabled, if (preferences != null) 'preferences': preferences}));
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body)['member'];
  }

  // --- REST message helpers ---
  Future<Message?> createMessage(String roomId, String content, {int? replyTo}) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/messages'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'roomId': roomId, 'content': content, 'replyTo': replyTo}));
    if (res.statusCode != 200) return null;
    final body = jsonDecode(res.body);
    return body['message'] != null ? Message.fromJson(body['message']) : null;
  }

  Future<void> editMessageRest(int messageId, String content) async {
    await http.patch(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/messages/$messageId'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'content': content}));
  }

  Future<void> deleteMessageRest(int messageId) async {
    await http.delete(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/messages/$messageId'),
        headers: {'Authorization': 'Bearer ${config.token}'});
  }

  Future<void> sendReactionRest(int messageId, String emoji, {bool remove = false}) async {
    if (remove) {
      await http.delete(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/messages/$messageId/reactions'),
          headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
          body: jsonEncode({'emoji': emoji}));
    } else {
      await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/messages/$messageId/reactions'),
          headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
          body: jsonEncode({'emoji': emoji}));
    }
  }

  Future<void> markReadRest(String roomId, int messageId) async {
    await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/rooms/${Uri.encodeComponent(roomId)}/read'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'messageId': messageId}));
  }

  // --- Inbox operations ---
  Future<Map<String, dynamic>> snoozeRoom(String roomId, {String? until, int? minutes, int? hours}) async {
    final res = await http.put(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/inbox/rooms/${Uri.encodeComponent(roomId)}/snooze'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({if (until != null) 'until': until, if (minutes != null) 'minutes': minutes, if (hours != null) 'hours': hours}));
    if (res.statusCode != 200) return {'ok': false};
    return jsonDecode(res.body);
  }

  Future<bool> unsnoozeRoom(String roomId) async {
    final res = await http.delete(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/inbox/rooms/${Uri.encodeComponent(roomId)}/snooze'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    return res.statusCode == 200;
  }

  Future<Map<String, dynamic>> createInboxFollowUp({required String roomId, int? messageId, String? note, String? dueAt}) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/inbox/follow-ups'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'roomId': roomId, if (messageId != null) 'messageId': messageId, if (note != null) 'note': note, if (dueAt != null) 'dueAt': dueAt}));
    if (res.statusCode != 200) return {'ok': false, 'id': ''};
    return jsonDecode(res.body);
  }

  Future<bool> completeInboxFollowUp(String id) async {
    final res = await http.patch(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/inbox/follow-ups/${Uri.encodeComponent(id)}'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'status': 'done'}));
    return res.statusCode == 200;
  }

  // --- Agent Queue ---
  Future<Map<String, dynamic>?> getAgentQueue({String? status, String? assignee, int? limit}) async {
    final params = <String, String>{};
    if (status != null) params['status'] = status;
    if (assignee != null) params['assignee'] = assignee;
    if (limit != null) params['limit'] = '$limit';
    final uri = Uri.parse('${trimTrailingSlashes(config.apiUrl)}/agent-queue').replace(queryParameters: params);
    final res = await http.get(uri, headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  Future<Map<String, dynamic>?> createAgentTask(String roomId, {String? note, int? priority}) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/agent-queue'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'roomId': roomId, if (note != null) 'note': note, if (priority != null) 'priority': priority}));
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  Future<bool> claimAgentTask(String taskId) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/agent-queue/${Uri.encodeComponent(taskId)}/claim'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    return res.statusCode == 200;
  }

  Future<bool> resolveAgentTask(String taskId, {required String status, String? disposition}) async {
    final res = await http.patch(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/agent-queue/${Uri.encodeComponent(taskId)}'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'status': status, if (disposition != null) 'disposition': disposition}));
    return res.statusCode == 200;
  }

  // --- Room Handoff ---
  Future<Map<String, dynamic>?> getRoomHandoff(String roomId) async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/rooms/${Uri.encodeComponent(roomId)}/handoff'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  Future<bool> requestRoomHandoff(String roomId, {String? agentId, String? note}) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/rooms/${Uri.encodeComponent(roomId)}/handoff'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({if (agentId != null) 'agentId': agentId, if (note != null) 'note': note}));
    return res.statusCode == 200;
  }

  // --- Feature Flags ---
  Future<Map<String, dynamic>> getFeatureFlags() async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/client/feature-flags'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return {'flags': <String, bool>{}, 'reconnectBackoff': {'baseBackoffMs': 500, 'maxBackoffMs': 20000}};
    return jsonDecode(res.body);
  }

  // --- Upload ---
  Future<Map<String, dynamic>?> uploadFile(String roomId, List<int> fileBytes, {required String fileName, required String mimeType}) async {
    final request = http.MultipartRequest('POST', Uri.parse('${trimTrailingSlashes(config.apiUrl)}/upload'));
    request.headers['Authorization'] = 'Bearer ${config.token}';
    request.headers['X-File-Name'] = fileName.length > 255 ? fileName.substring(0, 255) : fileName;
    request.headers['X-Room-Id'] = roomId;
    request.files.add(http.MultipartFile.fromBytes('file', fileBytes, filename: fileName));
    final streamed = await request.send();
    final res = await http.Response.fromStream(streamed);
    if (res.statusCode != 200) return null;
    final body = jsonDecode(res.body);
    final f = body['file'];
    if (f == null || f['url'] == null) return null;
    return {'kind': 'file', 'url': f['url'], 'name': (f['name'] ?? fileName).toString().substring(0, 255), 'sizeBytes': f['size'] ?? fileBytes.length};
  }

  // --- Room Utilities ---
  Future<Map<String, dynamic>> getRoomCatchUp(String roomId) async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/rooms/${Uri.encodeComponent(roomId)}/unread'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return {'unreadCount': 0, 'lastReadMessageId': 0, 'firstUnreadMessageId': null};
    return jsonDecode(res.body);
  }

  Future<bool> pinMessage(String roomId, int? messageId) async {
    final res = await http.patch(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/rooms/${Uri.encodeComponent(roomId)}/pin'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'messageId': messageId}));
    return res.statusCode == 200;
  }

  // --- Notifications (with options) ---
  Future<List<Map<String, dynamic>>> listNotifications({int? limit, bool? unreadOnly}) async {
    final params = <String, String>{};
    if (limit != null) params['limit'] = '$limit';
    if (unreadOnly == true) params['unreadOnly'] = '1';
    final uri = Uri.parse('${trimTrailingSlashes(config.apiUrl)}/notifications').replace(queryParameters: params);
    final res = await http.get(uri, headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return [];
    return List<Map<String, dynamic>>.from(jsonDecode(res.body)['notifications'] ?? []);
  }

  // --- Digest/QuietHours update ---
  Future<bool> updateDigestPreferences({bool? enabled, String? email}) async {
    final res = await http.patch(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/digest/preferences'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({if (enabled != null) 'enabled': enabled, if (email != null) 'email': email}));
    return res.statusCode == 200;
  }

  Future<bool> updateQuietHoursPreferences({bool? enabled, String? timezone, String? quietStart, String? quietEnd}) async {
    final res = await http.patch(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/notifications/quiet-hours'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({if (enabled != null) 'enabled': enabled, if (timezone != null) 'timezone': timezone, if (quietStart != null) 'quietStart': quietStart, if (quietEnd != null) 'quietEnd': quietEnd}));
    return res.statusCode == 200;
  }

  Future<Map<String, dynamic>> flushNotificationBatch() async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/notifications/flush-batch'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return {'ok': false, 'flushed': 0};
    return jsonDecode(res.body);
  }

  // --- Room Participants ---
  Future<List<Map<String, dynamic>>> getRoomParticipants(String roomId) async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/rooms/${Uri.encodeComponent(roomId)}/participants'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return [];
    return List<Map<String, dynamic>>.from(jsonDecode(res.body)['participants'] ?? []);
  }

  // --- Agent Queue extras ---
  Future<bool> releaseAgentTask(String taskId) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/agent-queue/${Uri.encodeComponent(taskId)}/release'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    return res.statusCode == 200;
  }

  Future<List<Map<String, dynamic>>> getAgentDispositions() async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/agent-queue/dispositions'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return [];
    return List<Map<String, dynamic>>.from(jsonDecode(res.body)['dispositions'] ?? []);
  }

  Future<Map<String, dynamic>> getAgentQueueStats() async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/agent-queue/stats'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return {'total': 0, 'pending': 0, 'assigned': 0, 'resolved': 0};
    return jsonDecode(res.body);
  }

  // --- Room Handoff extras ---
  Future<bool> resolveRoomHandoff(String roomId, {String? disposition, String? note}) async {
    final res = await http.patch(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/rooms/${Uri.encodeComponent(roomId)}/handoff'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({if (disposition != null) 'disposition': disposition, if (note != null) 'note': note}));
    return res.statusCode == 200;
  }

  // --- Custom Domains ---
  Future<List<Map<String, dynamic>>> listCustomDomains() async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/custom-domains'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return [];
    return List<Map<String, dynamic>>.from(jsonDecode(res.body)['domains'] ?? []);
  }

  Future<Map<String, dynamic>?> createCustomDomain(String hostname) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/custom-domains'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'hostname': hostname}));
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body)['domain'];
  }

  Future<bool> updateCustomDomain(String id, {String? hostname}) async {
    final res = await http.patch(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/custom-domains/${Uri.encodeComponent(id)}'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({if (hostname != null) 'hostname': hostname}));
    return res.statusCode == 200;
  }

  Future<bool> deleteCustomDomain(String id) async {
    final res = await http.delete(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/custom-domains/${Uri.encodeComponent(id)}'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    return res.statusCode == 200;
  }

  // --- Host Config ---
  Future<Map<String, dynamic>?> getPublicHostConfig() async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/host-config'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  // --- Embed Config ---
  Future<Map<String, dynamic>?> getEmbedConfig() async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/embed/config'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  Future<bool> updateEmbedConfig(Map<String, dynamic> input) async {
    final res = await http.patch(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/embed/config'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode(input));
    return res.statusCode == 200;
  }

  Future<Map<String, dynamic>?> getPublicEmbedConfig() async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/embed/public-config'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  // --- Room Draft ---
  Future<Map<String, dynamic>?> getRoomDraft(String roomId) async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/rooms/${Uri.encodeComponent(roomId)}/draft'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  Future<bool> putRoomDraft(String roomId, String content) async {
    final res = await http.put(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/rooms/${Uri.encodeComponent(roomId)}/draft'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'content': content}));
    return res.statusCode == 200;
  }

  // --- Room Health ---
  Future<Map<String, dynamic>> getRoomHealth(String roomId) async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/rooms/${Uri.encodeComponent(roomId)}/health'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return {};
    return jsonDecode(res.body);
  }

  // --- Terminate Room Connection ---
  Future<bool> terminateRoomConnection(String roomId) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/rooms/${Uri.encodeComponent(roomId)}/terminate'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    return res.statusCode == 200;
  }

  // --- Polls ---
  Future<Map<String, dynamic>?> createPoll(String roomId, String question, List<String> options, {String? expiresAt, bool? multipleChoice, bool? anonymous}) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/polls'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'roomId': roomId, 'question': question, 'options': options, if (expiresAt != null) 'expiresAt': expiresAt, if (multipleChoice != null) 'multipleChoice': multipleChoice, if (anonymous != null) 'anonymous': anonymous}));
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  Future<bool> votePoll(int messageId, int optionIndex) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/polls/$messageId/vote'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'optionIndex': optionIndex}));
    return res.statusCode == 200;
  }

  Future<Map<String, dynamic>> getPoll(int messageId) async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/polls/$messageId'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return {};
    return jsonDecode(res.body);
  }

  // --- Blocks ---
  Future<List<Map<String, dynamic>>> listBlocks() async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/blocks'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return [];
    return List<Map<String, dynamic>>.from(jsonDecode(res.body)['blocks'] ?? []);
  }

  Future<bool> blockUser(String userId) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/blocks'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'userId': userId}));
    return res.statusCode == 200;
  }

  Future<bool> unblockUser(String userId) async {
    final res = await http.delete(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/blocks/${Uri.encodeComponent(userId)}'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    return res.statusCode == 200;
  }

  // --- Channel Authorization ---
  Future<Map<String, dynamic>> authorizeChannel(String channelName, {Map<String, dynamic>? authData}) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/channels/authorize'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'channelName': channelName, if (authData != null) 'authData': authData}));
    if (res.statusCode != 200) return {'authorized': false};
    return jsonDecode(res.body);
  }

  // --- Translation ---
  Future<Map<String, dynamic>?> translateMessage(int messageId, String targetLanguage) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/messages/$messageId/translate'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'targetLanguage': targetLanguage}));
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  // --- Delivery Tracking ---
  Future<bool> markMessageDelivered(int messageId) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/messages/$messageId/deliver'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    return res.statusCode == 200;
  }

  Future<List<Map<String, dynamic>>> getMessageDeliveries(int messageId) async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/messages/$messageId/deliveries'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return [];
    return List<Map<String, dynamic>>.from(jsonDecode(res.body)['deliveries'] ?? []);
  }

  // --- Push Devices ---
  Future<Map<String, dynamic>?> registerPushDevice(String token, String platform, {String? userId}) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/push-devices'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'token': token, 'platform': platform, if (userId != null) 'userId': userId}));
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  Future<bool> unregisterPushDevice(String deviceId) async {
    final res = await http.delete(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/push-devices/${Uri.encodeComponent(deviceId)}'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    return res.statusCode == 200;
  }

  Future<String?> getVapidPublicKey() async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/web-push/vapid-public-key'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body)['publicKey'];
  }

  Future<List<Map<String, dynamic>>> listWebPushSubscriptions() async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/web-push/subscriptions'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return [];
    return List<Map<String, dynamic>>.from(jsonDecode(res.body)['subscriptions'] ?? []);
  }

  Future<List<Map<String, dynamic>>> listPushDevices() async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/push-devices'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return [];
    return List<Map<String, dynamic>>.from(jsonDecode(res.body)['devices'] ?? []);
  }

  // --- Contact Sync ---
  Future<bool> syncSentContact(String contactId, {String? email, String? phone, String? name}) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/contacts/${Uri.encodeComponent(contactId)}/sync'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({if (email != null) 'email': email, if (phone != null) 'phone': phone, if (name != null) 'name': name}));
    return res.statusCode == 200;
  }

  // --- Compliance ---
  Future<Map<String, dynamic>> getRoomComplianceExport(String roomId) async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/rooms/${Uri.encodeComponent(roomId)}/compliance-export'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return {};
    return jsonDecode(res.body);
  }

  Future<String> exportRoomMarkdown(String roomId) async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/rooms/${Uri.encodeComponent(roomId)}/export/markdown'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return '';
    return jsonDecode(res.body)['markdown'] ?? '';
  }

  // --- Scheduled Messages ---
  Future<List<Map<String, dynamic>>> listScheduledMessages(String roomId) async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/rooms/${Uri.encodeComponent(roomId)}/scheduled-messages'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return [];
    return List<Map<String, dynamic>>.from(jsonDecode(res.body)['scheduled'] ?? []);
  }

  Future<Map<String, dynamic>?> scheduleMessage(String roomId, String content, String scheduledAt) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/rooms/${Uri.encodeComponent(roomId)}/scheduled-messages'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'content': content, 'scheduledAt': scheduledAt}));
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  Future<void> cancelScheduledMessage(String roomId, String scheduleId) async {
    await http.delete(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/rooms/${Uri.encodeComponent(roomId)}/scheduled-messages/${Uri.encodeComponent(scheduleId)}'),
        headers: {'Authorization': 'Bearer ${config.token}'});
  }

  // --- Agents ---
  Future<List<Map<String, dynamic>>> listAgents() async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/agents'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return [];
    return List<Map<String, dynamic>>.from(jsonDecode(res.body)['agents'] ?? []);
  }

  Future<Map<String, dynamic>?> invokeAgentRest(String agentId, String message, {String? roomId, Map<String, dynamic>? context}) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/agents/${Uri.encodeComponent(agentId)}/invoke'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'roomId': roomId, 'message': message, if (context != null) 'context': context}));
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  Future<List<Map<String, dynamic>>> getAgentRuns(String agentId, {int limit = 50}) async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/agents/${Uri.encodeComponent(agentId)}/runs?limit=$limit'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return [];
    return List<Map<String, dynamic>>.from(jsonDecode(res.body)['runs'] ?? []);
  }

  Future<Map<String, dynamic>?> getAgent(String agentId) async {
    final res = await http.get(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/agents/${Uri.encodeComponent(agentId)}'),
        headers: {'Authorization': 'Bearer ${config.token}'});
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  Future<Map<String, dynamic>?> createAgent(String name, String systemPrompt, {String? kind, Map<String, dynamic>? config_}) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/agents'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'name': name, 'systemPrompt': systemPrompt, if (kind != null) 'kind': kind, if (config_ != null) 'config': config_}));
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  Future<Map<String, dynamic>?> updateAgent(String agentId, Map<String, dynamic> body) async {
    final res = await http.patch(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/agents/${Uri.encodeComponent(agentId)}'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode(body));
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  Future<void> deleteAgent(String agentId) async {
    await http.delete(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/agents/${Uri.encodeComponent(agentId)}'),
        headers: {'Authorization': 'Bearer ${config.token}'});
  }

  // --- Webhooks ---
  Future<Map<String, dynamic>?> registerWebhook(String url, {List<String>? eventTypes, String? secret}) async {
    final res = await http.post(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/webhooks'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({'url': url, if (eventTypes != null) 'eventTypes': eventTypes, if (secret != null) 'secret': secret}));
    if (res.statusCode != 200) return null;
    return jsonDecode(res.body);
  }

  Future<bool> updateWebhook(String webhookId, {String? url, List<String>? eventTypes, String? secret}) async {
    final res = await http.patch(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/webhooks/${Uri.encodeComponent(webhookId)}'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${config.token}'},
        body: jsonEncode({if (url != null) 'url': url, if (eventTypes != null) 'eventTypes': eventTypes, if (secret != null) 'secret': secret}));
    return res.statusCode == 200;
  }

  Future<void> deleteWebhook(String webhookId) async {
    await http.delete(Uri.parse('${trimTrailingSlashes(config.apiUrl)}/webhooks/${Uri.encodeComponent(webhookId)}'),
        headers: {'Authorization': 'Bearer ${config.token}'});
  }
}
