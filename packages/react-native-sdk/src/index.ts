export {
  FluxyAuthError,
  FluxyConnectionError,
  FluxySendError,
  FluxyTimeoutError,
  FLUXY_WS_CLOSE_NORMAL,
  FLUXY_WS_CLOSE_POLICY,
  computeReconnectBackoffMs,
  mapWebSocketCloseToError,
} from './errors';

export {
  decodeFluxyJwtPayload,
  jwtRefreshDelayMs,
  type DecodedFluxyJwt,
} from './jwt-utils';

export { trimTrailingSlashes } from './url-utils';

export {
  buildFluxyConnectionState,
  type FluxyChatTransport,
  type FluxyConnectionState,
  type FluxyConnectionStateStatus,
} from './connection-state';

export {
  createClientMessageId,
  createOptimisticMessage,
  applyServerMessageAck,
  markMessageDeliveryFailed,
  tryMatchPendingByInbound,
  type FluxyChatMessageWithDelivery,
  type FluxyDeliverableMessage,
  type FluxyMessageDeliveryFields,
  type FluxyMessageDeliveryStatus,
} from './message-delivery';

export {
  sortMessagesChronological,
  mergeMessagesChronological,
  clampHistoryLimit,
  MAX_HISTORY_LIMIT,
  type HistoryMessage,
} from './message-history';

export {
  validateAgentOutboundMessage,
  buildAgentOutboundWsPayload,
  type AgentOutboundMessageInput,
  type AgentOutboundValidationResult,
} from './agent-outbound';

export {
  FLUXY_MAX_MESSAGE_LENGTH,
  normalizeRoomMember,
  normalizeRoomMembers,
  type FluxyRoomMember,
} from './room-rest';

export {
  isE2eContentEnvelope,
  encryptE2eContent,
  decryptE2eContent,
  type FluxyE2eEnvelope,
} from './room-e2e';

export {
  createStreamingEditBatcher,
  type StreamingEditUpdate,
  type StreamingEditBatcherOptions,
} from './streaming-edit-batcher';

export {
  renderMessageTemplate,
  extractTemplateVarNames,
  type FluxyMessageTemplate,
  type FluxySendMessageOptions,
  type FluxyPresenceIntent,
  type FluxyProjectActivity,
} from './message-template';

export {
  FluxyRoomConnection,
  FLUXY_WS_CLOSE_HEARTBEAT,
  type FluxyRoomConnectionOptions,
  type FluxyRoomConnectionStatus,
  type FluxyWaitForOptions,
} from './room-connection';

export {
  createFluxyRoomStore,
  syncRoomConnectionState,
  type FluxyRoomStore,
  type FluxyRoomStoreState,
  type FluxyUseChatConnectionStatus,
  type FluxyToolThreadEvent,
} from './room-store';

export { FluxyMessageStream, type FluxyMessageStreamOptions } from './message-stream';

export { useFluxyChat, useFluxyChatOptional, type FluxyRealtimeContextValue } from './use-fluxy-chat';
export { useFluxyRoomStore, useFluxyRoomStoreState } from './use-fluxy-room-store';
export { FluxyRealtimeProvider, type FluxyRealtimeProviderProps, type FluxyAuthTokenResult } from './realtime-provider';

export { useChat, type UseChatOptions, type UseChatHistoryReplay } from './use-chat';
export { useUserChannel, type UseUserChannelOptions, type UseUserChannelState } from './use-user-channel';
export { useRooms } from './use-rooms';
export { useNotifications } from './use-notifications';
export { useWebPush, type WebPushPermissionState, type UseWebPushOptions } from './use-web-push';

export { FluxyChatClient } from './client';
export { ApiClient } from './api-client';
export { WebSocketClient, type ConnectionStatus } from './websocket-client';

export type {
  FluxyChatConfig,
  Message,
  FluxyChatMessage,
  Room,
  FluxyChatRoom,
  User,
  PresenceState,
  ChatEvent,
  FluxyChatEvent,
  EventHandler,
  SendMessageOptions,
  PaginationOptions,
  FluxyInAppNotification,
  FluxyChatAgentRun,
  FluxyChatAttachment,
  FluxyWebSocketConnectOptions,
} from './types';
