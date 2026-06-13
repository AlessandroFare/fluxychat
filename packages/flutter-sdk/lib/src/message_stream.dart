import 'dart:async';
import 'room_connection.dart';
import 'errors.dart';

class FluxyMessageStream {
  final FluxyRoomConnection connection;
  final String agentId;
  final int flushIntervalMs;
  final int? parentId;
  String _buffer = '';
  int? _messageId;
  bool _closed = false;
  bool _started = false;
  Timer? _flushTimer;
  int _lastFlushMs = 0;

  FluxyMessageStream(this.connection, this.agentId, {this.flushIntervalMs = 120, this.parentId});

  int? get activeMessageId => _messageId;

  void push(String chunk) {
    _assertOpen('push');
    if (chunk.isEmpty) return;
    _buffer += chunk;
    if (!_started) {
      _started = true;
      connection.sendJson({'type': 'stream', 'op': 'start', 'userId': agentId, 'content': _buffer, 'parentId': parentId});
    }
    _scheduleFlush();
  }

  void end() {
    _assertOpen('end');
    _closed = true;
    _flushTimer?.cancel();
    if (!_started) return;
    _flush(true);
  }

  void abort() {
    if (_closed) return;
    _closed = true;
    _flushTimer?.cancel();
    if (_messageId == null) return;
    try { connection.sendJson({'type': 'stream', 'op': 'abort', 'userId': agentId, 'messageId': _messageId}); } catch (_) {}
    _messageId = null;
    _buffer = '';
  }

  void _scheduleFlush() {
    if (_closed) return;
    final now = DateTime.now().millisecondsSinceEpoch;
    final elapsed = now - _lastFlushMs;
    if (elapsed >= flushIntervalMs) { _flush(false); return; }
    _flushTimer?.cancel();
    _flushTimer = Timer(Duration(milliseconds: flushIntervalMs - elapsed), () => _flush(false));
  }

  void _flush(bool isFinal) {
    if (!_started || _messageId == null) return;
    try {
      connection.sendJson({'type': 'stream', 'op': isFinal ? 'end' : 'delta', 'userId': agentId, 'messageId': _messageId, 'content': _buffer});
      _lastFlushMs = DateTime.now().millisecondsSinceEpoch;
    } catch (_) {}
    if (isFinal) { _buffer = ''; _messageId = null; _started = false; }
  }

  void _assertOpen(String op) { if (_closed) throw FluxySendError('Cannot call $op() on a closed FluxyMessageStream.'); }
  void dispose() { _flushTimer?.cancel(); }
}
