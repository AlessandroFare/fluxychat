import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'models.dart';

typedef EventHandler = void Function(ChatEvent event);

class WebSocketClient {
  final String wsUrl;
  final String projectId;
  final String token;
  final bool debug;

  WebSocketChannel? _channel;
  final Map<String, Set<EventHandler>> _eventHandlers = {};
  final Set<void Function(ConnectionStatus)> _statusHandlers = {};
  ConnectionStatus _status = ConnectionStatus.disconnected;
  int _reconnectAttempts = 0;
  final int _maxReconnectAttempts = 10;
  Timer? _reconnectTimer;
  Timer? _pingTimer;
  String? _currentRoomId;

  WebSocketClient({
    required this.wsUrl,
    required this.projectId,
    required this.token,
    this.debug = false,
  });

  ConnectionStatus get status => _status;

  void connect(String roomId) {
    _currentRoomId = roomId;
    _setStatus(ConnectionStatus.connecting);

    final url = '$wsUrl/ws?roomId=$roomId&token=$token&projectId=$projectId';
    _channel = WebSocketChannel.connect(Uri.parse(url));

    _channel!.stream.listen(
      (data) {
        try {
          final json = jsonDecode(data as String);
          _handleMessage(json);
        } catch (e) {
          _log('Failed to parse message: $e');
        }
      },
      onDone: () {
        _log('WebSocket closed');
        _stopPing();
        if (_reconnectAttempts < _maxReconnectAttempts) {
          _attemptReconnect();
        } else {
          _setStatus(ConnectionStatus.disconnected);
        }
      },
      onError: (error) {
        _log('WebSocket error: $error');
        _channel?.sink.close();
      },
    );

    _setStatus(ConnectionStatus.connected);
    _reconnectAttempts = 0;
    _startPing();
  }

  void disconnect() {
    _stopPing();
    _reconnectTimer?.cancel();
    _reconnectAttempts = _maxReconnectAttempts;
    _channel?.sink.close(1000, 'Client disconnect');
    _channel = null;
    _setStatus(ConnectionStatus.disconnected);
  }

  void send(Map<String, dynamic> data) {
    if (_channel != null) {
      _channel!.sink.add(jsonEncode(data));
    } else {
      _log('Cannot send, WebSocket not connected');
    }
  }

  void sendTyping(String roomId, bool typing) {
    send({'type': 'typing', 'roomId': roomId, 'typing': typing});
  }

  void sendPresence(String roomId, String status) {
    send({'type': 'presence', 'roomId': roomId, 'status': status});
  }

  void sendReadReceipt(String roomId, String messageId) {
    send({'type': 'read', 'roomId': roomId, 'messageId': messageId});
  }

  void on(String event, EventHandler handler) {
    _eventHandlers.putIfAbsent(event, () => {}).add(handler);
  }

  void off(String event, EventHandler handler) {
    _eventHandlers[event]?.remove(handler);
  }

  void onStatusChange(void Function(ConnectionStatus) handler) {
    _statusHandlers.add(handler);
  }

  void _handleMessage(Map<String, dynamic> data) {
    final event = ChatEvent(
      type: data['type'],
      data: data['data'],
      roomId: data['roomId'],
      timestamp: DateTime.parse(data['timestamp'] ?? DateTime.now().toIso8601String()),
    );

    _eventHandlers[data['type']]?.forEach((handler) => handler(event));
    _eventHandlers['*']?.forEach((handler) => handler(event));
  }

  void _attemptReconnect() {
    _setStatus(ConnectionStatus.reconnecting);
    final delay = Duration(milliseconds: (1000 * (1 << _reconnectAttempts)).clamp(1000, 30000));
    _log('Reconnecting in ${delay.inMilliseconds}ms (attempt ${_reconnectAttempts + 1})');

    _reconnectTimer = Timer(delay, () {
      _reconnectAttempts++;
      if (_currentRoomId != null) connect(_currentRoomId!);
    });
  }

  void _startPing() {
    _pingTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      send({'type': 'ping'});
    });
  }

  void _stopPing() {
    _pingTimer?.cancel();
    _pingTimer = null;
  }

  void _setStatus(ConnectionStatus status) {
    _status = status;
    _statusHandlers.forEach((handler) => handler(status));
  }

  void _log(String message) {
    if (debug) {
      print('[FluxyChat WS] $message');
    }
  }
}
