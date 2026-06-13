class FluxyAuthError implements Exception {
  final String message;
  FluxyAuthError([this.message = 'Authentication or room access failed (WebSocket close 1008).']);
  @override
  String toString() => 'FluxyAuthError: $message';
}

class FluxyConnectionError implements Exception {
  final int code;
  final String reason;
  final String message;
  FluxyConnectionError(this.code, [this.reason = '', String? message])
      : message = message ?? 'WebSocket closed unexpectedly (code $code${reason.isNotEmpty ? ': $reason' : ''}).';
  @override
  String toString() => 'FluxyConnectionError: $message';
}

class FluxySendError implements Exception {
  final String message;
  FluxySendError([this.message = 'Cannot send: WebSocket is not open.']);
  @override
  String toString() => 'FluxySendError: $message';
}

class FluxyTimeoutError implements Exception {
  final int timeoutMs;
  final String message;
  FluxyTimeoutError(this.timeoutMs) : message = 'Operation timed out after ${timeoutMs}ms';
  @override
  String toString() => 'FluxyTimeoutError: $message';
}

const int kFluxyWsCloseNormal = 1000;
const int kFluxyWsClosePolicy = 1008;

int computeReconnectBackoffMs(int attempt, {int baseMs = 500, int maxMs = 20000}) {
  final capped = attempt.clamp(0, 6);
  return maxMs > baseMs * (1 << capped) ? baseMs * (1 << capped) : maxMs;
}
