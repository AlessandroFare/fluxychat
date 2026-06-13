import 'dart:async';
import 'models.dart';
import 'connection_state.dart';

typedef StateListener = void Function(RoomStoreState state);

class RoomStoreState {
  final List<Message> messages;
  final bool hasMore;
  final bool isLoadingMore;
  final bool historyLoaded;
  final int online;
  final Map<String, bool> typingUsers;
  final List<Map<String, dynamic>> presenceMembers;
  final int subscriptionCount;
  final String? socketId;
  final bool connected;
  final String connectionStatus;
  final FluxyConnectionState connectionState;
  final int reconnectAttempt;
  final Object? connectionError;
  final bool agentTyping;
  final List<Map<String, dynamic>> toolThreadEvents;

  const RoomStoreState({
    this.messages = const [],
    this.hasMore = false,
    this.isLoadingMore = false,
    this.historyLoaded = false,
    this.online = 0,
    this.typingUsers = const {},
    this.presenceMembers = const [],
    this.subscriptionCount = 0,
    this.socketId,
    this.connected = false,
    this.connectionStatus = 'connecting',
    required this.connectionState,
    this.reconnectAttempt = 0,
    this.connectionError,
    this.agentTyping = false,
    this.toolThreadEvents = const [],
  });

  RoomStoreState copyWith({
    List<Message>? messages,
    bool? hasMore,
    bool? isLoadingMore,
    bool? historyLoaded,
    int? online,
    Map<String, bool>? typingUsers,
    List<Map<String, dynamic>>? presenceMembers,
    int? subscriptionCount,
    String? socketId,
    bool? connected,
    String? connectionStatus,
    FluxyConnectionState? connectionState,
    int? reconnectAttempt,
    Object? connectionError,
    bool? agentTyping,
    List<Map<String, dynamic>>? toolThreadEvents,
  }) {
    return RoomStoreState(
      messages: messages ?? this.messages,
      hasMore: hasMore ?? this.hasMore,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      historyLoaded: historyLoaded ?? this.historyLoaded,
      online: online ?? this.online,
      typingUsers: typingUsers ?? this.typingUsers,
      presenceMembers: presenceMembers ?? this.presenceMembers,
      subscriptionCount: subscriptionCount ?? this.subscriptionCount,
      socketId: socketId ?? this.socketId,
      connected: connected ?? this.connected,
      connectionStatus: connectionStatus ?? this.connectionStatus,
      connectionState: connectionState ?? this.connectionState,
      reconnectAttempt: reconnectAttempt ?? this.reconnectAttempt,
      connectionError: connectionError ?? this.connectionError,
      agentTyping: agentTyping ?? this.agentTyping,
      toolThreadEvents: toolThreadEvents ?? this.toolThreadEvents,
    );
  }
}

class FluxyRoomStore {
  RoomStoreState _state;
  final Set<StateListener> _listeners = {};

  FluxyRoomStore()
      : _state = RoomStoreState(
          connectionState: buildFluxyConnectionState(status: FluxyConnectionStateStatus.connecting),
        );

  RoomStoreState get state => _state;

  void setState(RoomStoreState Function(RoomStoreState) updater) {
    _state = updater(_state);
    for (final listener in _listeners) { try { listener(_state); } catch (_) {} }
  }

  StreamSubscription<StateListener> subscribe(StateListener listener) {
    _listeners.add(listener);
    return Stream.empty().listen((_) {}); // placeholder
  }

  void dispose() { _listeners.clear(); }
}
