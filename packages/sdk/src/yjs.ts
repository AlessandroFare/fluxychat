/**
 * Optional Yjs CRDT helpers for collab / multi-tab message lists.
 * Prefer `@fluxy-chat/sdk/yjs` so chat-only and bot clients avoid the yjs graph
 * unless they opt in (or use createFluxyRoomSession with crdtMessageList).
 */
export {
  FLUXY_MESSAGES_MAP_KEY,
  applyCrdtSnapshotUpdate,
  getRoomMessageCrdtDoc,
  mergeRestHistoryWithYjsDoc,
  mergeRestHistoryWithYjsRecords,
  detectConflictBetweenVersions,
  detectConflictCandidatesFromMerge,
  readMessagesFromDoc,
  subscribeMessageCrdtMultiTabSync,
  trackInboundMessageInCrdtDoc,
  upsertMessageInDoc,
  type MessageCrdtSnapshot,
  type YjsMessageRecord,
  type ConflictCandidate,
  type ConflictVersion,
} from "./message-crdt-yjs";

export {
  createYjsCollabPort,
  YJS_SNAPSHOT_POLICY,
  type YjsCollabPort,
  type YjsSnapshotPolicy,
} from "./yjs-collab";

export {
  decodeYjsFrame,
  encodeYjsFrame,
  YJS_MSG_AWARENESS,
  YJS_MSG_SYNC,
  YJS_MSG_UPDATE,
} from "./yjs-binary";

export {
  applyStoragePatch,
  FLUXY_YJS_EDITOR_FRAGMENT,
  FLUXY_YJS_STORAGE_MAP,
  isLiveFile,
  jsonToYValue,
  liveFileFromAttachment,
  storageMapToJson,
  uploadLiveFile,
  yValueToJson,
  type FluxyLiveFile,
  type StorageJson,
} from "./yjs-storage";

export {
  FluxyYjsProvider,
  useMutation,
  useRedo,
  useStorage,
  useUndo,
  useYjsContext,
  useYjsDoc,
  type FluxyYjsContextValue,
  type FluxyYjsProviderProps,
} from "./use-storage";
