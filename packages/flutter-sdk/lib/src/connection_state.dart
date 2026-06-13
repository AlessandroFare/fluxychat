enum FluxyChatTransport { websocket, sse, polling, none }
enum FluxyConnectionStateStatus { connected, connecting, reconnecting, polling, sse, disconnected }

class FluxyConnectionState {
  final FluxyConnectionStateStatus status;
  final Object? lastError;
  final int retryAttempt;
  final DateTime? nextRetryAt;
  final FluxyChatTransport transport;
  FluxyConnectionState({required this.status, this.lastError, this.retryAttempt = 0, this.nextRetryAt, required this.transport});
}

FluxyConnectionState buildFluxyConnectionState({
  required FluxyConnectionStateStatus status,
  Object? lastError,
  int retryAttempt = 0,
  int? reconnectDelayMs,
  FluxyChatTransport? transport,
}) {
  DateTime? nextRetryAt;
  if (status == FluxyConnectionStateStatus.reconnecting) {
    final delay = reconnectDelayMs ?? computeReconnectBackoffMs(retryAttempt > 0 ? retryAttempt : 1);
    if (delay > 0) nextRetryAt = DateTime.now().add(Duration(milliseconds: delay));
  }
  return FluxyConnectionState(
    status: status,
    lastError: lastError,
    retryAttempt: retryAttempt,
    nextRetryAt: nextRetryAt,
    transport: transport ?? _transportFromStatus(status),
  );
}

FluxyChatTransport _transportFromStatus(FluxyConnectionStateStatus status) {
  switch (status) {
    case FluxyConnectionStateStatus.sse: return FluxyChatTransport.sse;
    case FluxyConnectionStateStatus.polling: return FluxyChatTransport.polling;
    case FluxyConnectionStateStatus.connected:
    case FluxyConnectionStateStatus.connecting:
    case FluxyConnectionStateStatus.reconnecting: return FluxyChatTransport.websocket;
    default: return FluxyChatTransport.none;
  }
}
