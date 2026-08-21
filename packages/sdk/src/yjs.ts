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
