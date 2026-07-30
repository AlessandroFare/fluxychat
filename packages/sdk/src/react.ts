/**
 * Transitional React re-export during `@fluxy-chat/react` package split (DX-9.1).
 *
 * Prefer `@fluxy-chat/react` in new apps. This subpath keeps older imports working:
 * `import { useChat } from "@fluxy-chat/sdk/react"`.
 */

export {
  FluxyRealtimeProvider,
  type FluxyRealtimeProviderProps,
  type FluxyAuthTokenResult,
} from "./realtime-provider";

export {
  useFluxyChat,
  useFluxyChatOptional,
  type FluxyRealtimeContextValue,
} from "./use-fluxy-chat";

export {
  useChat,
  type UseChatOptions,
  type UseChatReadOn,
  type UseChatHistoryReplay,
} from "./use-chat";

export {
  useInbox,
  type UseInboxOptions,
  type UseInboxResult,
} from "./use-inbox";

export {
  useFluxyRoomStore,
  useFluxyRoomStoreState,
  INERT_FLUXY_ROOM_SNAPSHOT,
} from "./use-fluxy-room-store";

export {
  useLocation,
  type LocationTrackState,
  type UseLocationOptions,
} from "./use-location";

export {
  useNotifications,
} from "./use-notifications";

export {
  useWebPush,
  type UseWebPushOptions,
  type WebPushPermissionState,
} from "./use-web-push";

export {
  useUserChannel,
  type UseUserChannelOptions,
  type UseUserChannelState,
} from "./use-user-channel";

export type { FluxyInboxItem, FluxyInboxItemKind } from "./inbox-items";
