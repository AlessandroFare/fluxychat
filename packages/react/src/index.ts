/**
 * React bindings for FluxyChat.
 * Implementation lives in `@fluxy-chat/sdk` during the transitional split.
 */
export {
  FluxyRealtimeProvider,
  type FluxyRealtimeProviderProps,
  type FluxyAuthTokenResult,
} from "@fluxy-chat/sdk";

export {
  useFluxyChat,
  useFluxyChatOptional,
  type FluxyRealtimeContextValue,
} from "@fluxy-chat/sdk";

export {
  useChat,
  type UseChatOptions,
  type UseChatReadOn,
  type UseChatHistoryReplay,
} from "@fluxy-chat/sdk";

export {
  useVoice,
  type UseVoiceOptions,
  type UseVoiceResult,
} from "@fluxy-chat/sdk";

export {
  useLiveKitToken,
  type UseLiveKitTokenOptions,
  type UseLiveKitTokenResult,
  type LiveKitTokenResponse,
} from "@fluxy-chat/sdk";

export {
  useInbox,
  type UseInboxOptions,
  type UseInboxResult,
} from "@fluxy-chat/sdk";

export {
  useFluxyRoomStore,
  useFluxyRoomStoreState,
  INERT_FLUXY_ROOM_SNAPSHOT,
} from "@fluxy-chat/sdk";

export {
  useLocation,
  type LocationTrackState,
  type UseLocationOptions,
} from "@fluxy-chat/sdk";

export {
  useServerEvents,
  type ServerEventLogEntry,
  type UseServerEventsOptions,
  type UseServerEventsResult,
} from "@fluxy-chat/sdk";

export {
  useNotifications,
} from "@fluxy-chat/sdk";

export {
  useWebPush,
  type UseWebPushOptions,
  type WebPushPermissionState,
} from "@fluxy-chat/sdk";

export {
  useUserChannel,
  type UseUserChannelOptions,
  type UseUserChannelState,
} from "@fluxy-chat/sdk";

export type { FluxyInboxItem, FluxyInboxItemKind } from "@fluxy-chat/sdk";

export {
  useLiveCursors,
  type UseLiveCursorsOptions,
  type UseLiveCursorsResult,
  parseLiveCursorEvent,
  buildCursorOutbound,
  createCursorThrottle,
  type LiveCursor,
  type LiveCursorPublishInput,
  useOthers,
  useMyPresence,
  useUpdateMyPresence,
  useBroadcastEvent,
  useEventListener,
  othersFromRoomState,
  type FluxyPresence,
  type FluxyPresenceOther,
  useThreads,
  type UseThreadsOptions,
  type UseThreadsResult,
  type FluxyComment,
  type FluxyCommentThread,
  type FluxyCommentThreadMetadata,
  useFeeds,
  useFeedMessages,
  useCreateFeed,
  useCreateFeedMessage,
  type UseFeedsOptions,
  type UseFeedsResult,
  type UseFeedMessagesOptions,
  type UseFeedMessagesResult,
  type FluxyFeed,
  type FluxyFeedMessage,
  FluxyAiCopilotProvider,
  RegisterAiKnowledge,
  RegisterAiTool,
  useAiChat,
  useSendAiMessage,
  useAiChatMessages,
  type UseAiChatResult,
  type AiChatMessage,
} from "@fluxy-chat/sdk";
