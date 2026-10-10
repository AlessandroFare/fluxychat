/**
 * Room kernel entry (`@fluxy-chat/sdk/room`).
 * Chat client, attach bag, occupancy, cursors, locks, presence.
 * No IoT / edu / finance verticals.
 */
export * from "./core";
export {
  bindFluxyRoom,
  type FluxyBoundRoom,
  type FluxyRoomOccupancy,
} from "./fluxy-room";
export { bindRoomTyping, type FluxyRoomTyping } from "./room-typing";
export { bindRoomReactions, type FluxyRoomReactions } from "./room-reactions";
export {
  bindRoomPresence,
  presenceEventsFromWire,
  type FluxyRoomPresence,
  type FluxyPresenceChatEvent,
} from "./room-presence";
export {
  bindRoomMembers,
  type FluxyRoomMembers,
  type FluxySpaceMember,
} from "./room-members";
export { bindRoomLocations, type FluxyRoomLocations } from "./room-locations";
export { bindRoomMessages, type FluxyRoomMessages } from "./room-messages";
export { useTyping } from "./use-typing";
export { useRoomReactions } from "./use-room-reactions";
export { useRoomStatus } from "./use-room-status";
export { useChatConnection } from "./use-chat-connection";
export { useChatClient } from "./use-chat-client";
export { usePresence } from "./use-presence-room";
export { useMessages } from "./use-messages";
export { usePresenceListener } from "./use-presence-listener";
export { useLocks } from "./use-locks";
export { useLock } from "./use-lock";
export { useLocations } from "./use-locations";
export { useCursors } from "./use-cursors";
export { useMembers } from "./use-members";
export { bindRoomObjects, type FluxyRoomObjects } from "./room-objects";
export { bindRoomCursors, type FluxyRoomCursors } from "./room-cursors";
export { FluxyRoomProvider, useRoom } from "./fluxy-room-provider";
export {
  fetchMessageHistoryPage,
  type FluxyHistoryParams,
  type FluxyPaginatedResult,
} from "./paginated-messages";
export {
  attachStatusFromConnection,
  roomStatusFn,
  type FluxyRoomAttachStatus,
  type FluxyRoomStatusHandle,
} from "./room-status";
export {
  occupancyFromLive,
  occupancyFromEvent,
  occupancyEventFromData,
  watchingFromOccupancyCounts,
  type FluxyOccupancyData,
  type FluxyOccupancyEvent,
} from "./occupancy";
export {
  type FluxyClientConnection,
  type FluxyClientConnectionStatus,
  type FluxyClientConnectionStatusChange,
} from "./client-connection";
export { useOccupancy } from "./use-occupancy";
export {
  bindRoomLocks,
  type FluxyRoomLocks,
  type FluxyLockRecord,
  type FluxyLockEvent,
  type FluxyLockStatus,
  type FluxyLockAttributes,
} from "./room-locks";
export {
  createCursorBatcher,
  createCursorDispenser,
  shouldSendCursor,
  parseLiveCursorEvent,
  type LiveCursor,
  type LiveCursorPublishInput,
} from "./live-cursors";
export {
  parsePresencePatchEvent,
  type FluxyPresence,
  type FluxyUiLocation,
} from "./presence-patch";
export {
  classifyPresenceAvatars,
  selfFromMembers,
  rememberLeaver,
  forgetLeaver,
  pruneLeavers,
  FLUXY_LEAVER_TTL_MS,
  type FluxyPresenceAvatar,
  type FluxyLeaver,
} from "./presence-avatars";
export { createRoomFrameLog, type FluxyFrameLogEntry } from "./room-frame-log";
