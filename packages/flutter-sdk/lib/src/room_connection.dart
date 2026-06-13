import 'dart:async';
import 'dart:convert';
import 'errors.dart';
import 'url_utils.dart';

typedef MessageHandler = void Function(Map<String, dynamic> event);

class FluxyRoomConnectionOptions {
  final int maxReconnectAttempts;
  final int baseBackoffMs;
  final int maxBackoffMs;
  final bool replayHistoryOnReconnect;
  final int historyLimit;
  final int heartbeatIntervalMs;
  final int heartbeatTimeoutMs;
  final int maxOutboundQueue;
  final int maxOutboundQueueAgeMs;
  final void Function(FluxyAuthError)? onAuthError;
  final void Function(Object)? onConnectionError;
  final void Function(String status)? onStatusChange;
  final void Function()? onReconnectFailed;

  const FluxyRoomConnectionOptions({
    this.maxReconnectAttempts = 8,
    this.baseBackoffMs = 500,
    this.maxBackoffMs = 20000,
    this.replayHistoryOnReconnect = true,
    this.historyLimit = 50,
    this.heartbeatIntervalMs = 25000,
    this.heartbeatTimeoutMs = 45000,
    this.maxOutboundQueue = 100,
    this.maxOutboundQueueAgeMs = 300000,
    this.onAuthError,
    this.onConnectionError,
    this.onStatusChange,
    this.onReconnectFailed,
  });
}

class FluxyRoomConnection {
  final String baseUrl;
  final String roomId;
  final String token;
  final String userId;
  final FluxyRoomConnectionOptions options;
  WebSocket? _ws;
  String _status = 'idle';
  int _reconnectAttempt = 0;
  Timer? _reconnectTimer;
  bool _intentionallyClosed = false;
  bool _hasConnectedOnce = false;
  bool _pendingHistoryReplay = false;
  Object? _lastError;
  Timer? _heartbeatTimer;
  DateTime? _lastPongAt;
  final List<MessageHandler> _listeners = [];
  final List<MessageHandler> _anyListeners = [];
  final List<Map<String, dynamic>> _outboundQueue = [];
  final Set<int> _seenIds = {};

  String get connectionStatus => _status;
  int get reconnectAttempts => _reconnectAttempt;
  Object? get lastError => _lastError;
  int get outboundQueueDepth => _outboundQueue.length;

  FluxyRoomConnection({
    required this.baseUrl,
    required this.roomId,
    required this.token,
    required this.userId,
    this.options = const FluxyRoomConnectionOptions(),
  });

  void addEventListener(MessageHandler handler) => _listeners.add(handler);
  void removeEventListener(MessageHandler handler) => _listeners.remove(handler);
  void onAnyEvent(MessageHandler handler) => _anyListeners.add(handler);
  void offAnyEvent(MessageHandler handler) => _anyListeners.remove(handler);

  void connect() { _intentionallyClosed = false; _openSocket(); }

  void close() {
    _intentionallyClosed = true;
    _clearReconnectTimer();
    _stopHeartbeat();
    _outboundQueue.clear();
    _ws?.sink.close();
    _ws = null;
    _setStatus('disconnected');
  }

  void sendJson(Map<String, dynamic> payload) {
    if (_canSendImmediately()) {
      _ws!.sink.add(jsonEncode(payload));
      return;
    }
    if (_canQueueOutbound()) {
      _outboundQueue.add({'payload': payload, 'enqueuedAt': DateTime.now().millisecondsSinceEpoch});
      if (_outboundQueue.length > options.maxOutboundQueue) _outboundQueue.removeAt(0);
      return;
    }
    throw FluxySendError();
  }

  Future<Map<String, dynamic>> waitFor(bool Function(Map<String, dynamic>) predicate, {Duration timeout = const Duration(seconds: 30)}) {
    if (_status != 'connected') return Future.error(FluxySendError('Not connected'));
    final completer = Completer<Map<String, dynamic>>();
    final timer = Timer(timeout, () { if (!completer.isCompleted) completer.completeError(FluxyTimeoutError(timeout.inMilliseconds)); });
    _listeners.add((event) {
      if (!completer.isCompleted && predicate(event)) { timer.cancel(); completer.complete(event); }
    });
    return completer.future;
  }

  bool _canSendImmediately() => _ws != null;
  bool _canQueueOutbound() => _status == 'connecting' || _status == 'reconnecting';

  void _setStatus(String next) {
    if (_status == next) return;
    _status = next;
    if (next == 'connected') { _lastPongAt = DateTime.now(); }
    options.onStatusChange?.(next);
  }

  void _clearReconnectTimer() { _reconnectTimer?.cancel(); _reconnectTimer = null; }
  void _stopHeartbeat() { _heartbeatTimer?.cancel(); _heartbeatTimer = null; }

  void _startHeartbeat() {
    _stopHeartbeat();
    if (options.heartbeatIntervalMs <= 0) return;
    _lastPongAt = DateTime.now();
    _heartbeatTimer = Timer.periodic(Duration(milliseconds: options.heartbeatIntervalMs), (_) {
      if (_ws == null) return;
      if (_lastPongAt != null && DateTime.now().difference(_lastPongAt!).inMilliseconds > options.heartbeatTimeoutMs) {
        _ws?.sink.close(4000, 'heartbeat_timeout');
        return;
      }
      sendJson({'type': 'ping'});
    });
  }

  void _handleInboundRaw(String raw) {
    try {
      final data = jsonDecode(raw) as Map<String, dynamic>;
      final type = data['type'] as String?;
      if (type == 'pong') { _lastPongAt = DateTime.now(); return; }
      for (final handler in _listeners) { try { handler(data); } catch (_) {} }
      for (final handler in _anyListeners) { try { handler(data); } catch (_) {} }
    } catch (_) {}
  }

  void _openSocket() {
    _clearReconnectTimer();
    _setStatus(_hasConnectedOnce && _reconnectAttempt > 0 ? 'reconnecting' : 'connecting');
    final wsUrl = baseUrl.replaceFirst('http', 'ws');
    final url = '$wsUrl/ws/room/${Uri.encodeComponent(roomId)}?token=${Uri.encodeComponent(token)}&userId=${Uri.encodeComponent(userId)}';
    _ws = WebSocket(Uri.parse(url));
    _ws!.stream.listen(
      (data) { _handleInboundRaw(data is String ? data : utf8.decode(data)); },
      onDone: () {
        _ws = null;
        _stopHeartbeat();
        if (_intentionallyClosed) { _setStatus('disconnected'); return; }
        _scheduleReconnect();
      },
      onError: (error) {
        _lastError = error;
        options.onConnectionError?.(error);
      },
    );
    _hasConnectedOnce = true;
    _reconnectAttempt = 0;
    _setStatus('connected');
    _startHeartbeat();
    _flushOutboundQueue();
  }

  void _flushOutboundQueue() {
    while (_outboundQueue.isNotEmpty && _canSendImmediately()) {
      final frame = _outboundQueue.removeAt(0);
      _ws!.sink.add(jsonEncode(frame['payload']));
    }
  }

  void _scheduleReconnect() {
    _pendingHistoryReplay = true;
    _reconnectAttempt += 1;
    if (_reconnectAttempt > options.maxReconnectAttempts) {
      _setStatus('disconnected');
      options.onReconnectFailed?.();
      return;
    }
    _setStatus('reconnecting');
    final delay = computeReconnectBackoffMs(_reconnectAttempt, baseMs: options.baseBackoffMs, maxMs: options.maxBackoffMs);
    _reconnectTimer = Timer(Duration(milliseconds: delay), () {
      _reconnectTimer = null;
      if (!_intentionallyClosed) _openSocket();
    });
  }
}
