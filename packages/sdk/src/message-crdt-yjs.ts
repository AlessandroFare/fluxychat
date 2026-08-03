import * as Y from "yjs";
import type { FluxyDeliverableMessage } from "./message-delivery";
import { sortMessagesChronological } from "./message-history";

/** Y.Map key inside the room Y.Doc for persisted chat messages. */
export const FLUXY_MESSAGES_MAP_KEY = "fluxy_messages";

export interface YjsMessageRecord {
  id: number;
  roomId: string;
  userId: string;
  senderId?: string;
  content: string;
  createdAt: string;
  parentId?: number | null;
  clientMessageId?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
}

export interface MessageCrdtSnapshot {
  update: string;
  messageCount: number;
  roomId: string;
}

export interface ConflictVersion {
  content: string;
  originInstance: string;
  ts: string;
  userId?: string;
  messageId?: number;
  clientMessageId?: string | null;
}

export interface ConflictCandidate {
  roomId: string;
  messageKey: string;
  parentMessageId?: number | null;
  messageId?: number;
  clientMessageId?: string | null;
  versionA: ConflictVersion;
  versionB: ConflictVersion;
  autoResolvable: boolean;
}

/**
 * Detect a true merge conflict (same logical slot, divergent content, not clear LWW).
 */
export function detectConflictBetweenVersions(
  versionA: ConflictVersion,
  versionB: ConflictVersion,
  context: { roomId: string; messageKey: string; parentMessageId?: number | null },
): ConflictCandidate | null {
  if (versionA.content.trim() === versionB.content.trim()) return null;

  const sameSlot =
    (versionA.clientMessageId &&
      versionB.clientMessageId &&
      versionA.clientMessageId === versionB.clientMessageId) ||
    (versionA.messageId != null &&
      versionB.messageId != null &&
      versionA.messageId === versionB.messageId);
  if (!sameSlot) return null;

  const tsA = Date.parse(versionA.ts) || 0;
  const tsB = Date.parse(versionB.ts) || 0;
  const deltaMs = Math.abs(tsA - tsB);
  const concurrent = deltaMs < 2000;
  const clearWinner =
    !concurrent && tsA !== tsB && versionA.originInstance !== versionB.originInstance;
  if (clearWinner) return null;

  return {
    roomId: context.roomId,
    messageKey: context.messageKey,
    parentMessageId: context.parentMessageId ?? null,
    messageId: versionA.messageId ?? versionB.messageId,
    clientMessageId: versionA.clientMessageId ?? versionB.clientMessageId ?? null,
    versionA,
    versionB,
    autoResolvable: false,
  };
}

/**
 * Compare REST history with Yjs peers before silent LWW — surface ambiguous edits (#48).
 */
export function detectConflictCandidatesFromMerge(
  history: FluxyDeliverableMessage[],
  yjsRecords: YjsMessageRecord[],
  roomId: string,
): ConflictCandidate[] {
  const conflicts: ConflictCandidate[] = [];

  for (const record of yjsRecords) {
    if (record.deletedAt) continue;
    const existing = history.find((row) => {
      const clientId = (row as FluxyDeliverableMessage & { clientMessageId?: string }).clientMessageId;
      if (record.clientMessageId && clientId === record.clientMessageId) return true;
      return row.id === record.id;
    });
    if (!existing || existing.content.trim() === record.content.trim()) continue;
    if (messageVersionTs(record) > messageVersionTs(existing)) continue;

    const messageKey = record.clientMessageId
      ? `c:${record.clientMessageId}`
      : `s:${record.id}`;
    const candidate = detectConflictBetweenVersions(
      {
        content: existing.content,
        originInstance: "rest",
        ts: messageVersionTs(existing),
        userId: existing.userId,
        messageId: existing.id,
        clientMessageId:
          (existing as FluxyDeliverableMessage & { clientMessageId?: string }).clientMessageId ??
          null,
      },
      {
        content: record.content,
        originInstance: "yjs",
        ts: messageVersionTs(record),
        userId: record.userId,
        messageId: record.id,
        clientMessageId: record.clientMessageId ?? null,
      },
      {
        roomId,
        messageKey,
        parentMessageId: existing.parentId ?? record.parentId ?? null,
      },
    );
    if (candidate) conflicts.push(candidate);
  }

  return conflicts;
}

export function messageVersionTs(message: Pick<YjsMessageRecord, "deletedAt" | "editedAt" | "createdAt">): string {
  return String(message.deletedAt || message.editedAt || message.createdAt || "");
}

export function readMessagesFromDoc(doc: Y.Doc): YjsMessageRecord[] {
  const map = doc.getMap(FLUXY_MESSAGES_MAP_KEY);
  const out: YjsMessageRecord[] = [];
  map.forEach((value) => {
    if (value && typeof value === "object" && !(value as YjsMessageRecord).deletedAt) {
      out.push(value as YjsMessageRecord);
    }
  });
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function upsertMessageInDoc(doc: Y.Doc, message: YjsMessageRecord): void {
  const map = doc.getMap(FLUXY_MESSAGES_MAP_KEY);
  const key = message.clientMessageId ? `c:${message.clientMessageId}` : `s:${message.id}`;
  const existing = map.get(key) as YjsMessageRecord | undefined;
  if (existing && messageVersionTs(message) < messageVersionTs(existing)) return;
  map.set(key, message);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function applyCrdtSnapshotUpdate(doc: Y.Doc, updateBase64: string): void {
  Y.applyUpdate(doc, base64ToUint8Array(updateBase64), "remote");
}

function yjsRecordToMessage(record: YjsMessageRecord): FluxyDeliverableMessage {
  return {
    id: record.id,
    roomId: record.roomId,
    userId: record.userId,
    senderId: record.senderId ?? record.userId,
    content: record.content,
    createdAt: record.createdAt,
    parentId: record.parentId ?? null,
    editedAt: record.editedAt ?? null,
    deletedAt: record.deletedAt ?? null,
    ...(record.clientMessageId ? { clientMessageId: record.clientMessageId } : {}),
  };
}

/**
 * Merge paginated REST history with Yjs message-list state (LWW on content/edits).
 * REST rows win for attachment-rich fields; Yjs fills gaps from offline peers.
 */
export function mergeRestHistoryWithYjsRecords(
  history: FluxyDeliverableMessage[],
  yjsRecords: YjsMessageRecord[],
): FluxyDeliverableMessage[] {
  const byId = new Map<number, FluxyDeliverableMessage>();
  const byClientId = new Map<string, FluxyDeliverableMessage>();

  for (const row of history) {
    byId.set(row.id, row);
    const clientId = (row as FluxyDeliverableMessage & { clientMessageId?: string }).clientMessageId;
    if (clientId?.trim()) byClientId.set(clientId, row);
  }

  for (const record of yjsRecords) {
    if (record.deletedAt) {
      byId.delete(record.id);
      if (record.clientMessageId) byClientId.delete(record.clientMessageId);
      continue;
    }
    const candidate = yjsRecordToMessage(record);
    const existing =
      (record.clientMessageId ? byClientId.get(record.clientMessageId) : undefined) ??
      byId.get(record.id);
    if (!existing) {
      byId.set(candidate.id, candidate);
      if (candidate.clientMessageId) byClientId.set(candidate.clientMessageId, candidate);
      continue;
    }
    if (messageVersionTs(record) >= messageVersionTs(existing)) {
      const merged = { ...existing, ...candidate };
      byId.set(merged.id, merged);
      if (merged.clientMessageId) byClientId.set(merged.clientMessageId, merged);
    }
  }

  return sortMessagesChronological([...byId.values()]);
}

export function mergeRestHistoryWithYjsDoc(
  history: FluxyDeliverableMessage[],
  doc: Y.Doc,
): FluxyDeliverableMessage[] {
  return mergeRestHistoryWithYjsRecords(history, readMessagesFromDoc(doc));
}

const roomDocs = new Map<string, Y.Doc>();

const TAB_ID =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `tab-${Math.random().toString(36).slice(2)}`;

export function getRoomMessageCrdtDoc(roomId: string): Y.Doc {
  const trimmed = roomId.trim();
  let doc = roomDocs.get(trimmed);
  if (!doc) {
    doc = new Y.Doc();
    roomDocs.set(trimmed, doc);
  }
  return doc;
}

export function resetRoomMessageCrdtDocsForTests(): void {
  roomDocs.clear();
}

export function trackInboundMessageInCrdtDoc(
  roomId: string,
  message: FluxyDeliverableMessage & { clientMessageId?: string },
): void {
  const doc = getRoomMessageCrdtDoc(roomId);
  upsertMessageInDoc(doc, {
    id: message.id,
    roomId: message.roomId,
    userId: message.userId,
    senderId: message.senderId ?? message.userId,
    content: message.content,
    createdAt: message.createdAt,
    parentId: message.parentId ?? null,
    clientMessageId: message.clientMessageId ?? null,
    editedAt: message.editedAt ?? null,
    deletedAt: message.deletedAt ?? null,
  });
}

/**
 * Sync message-list Y.Doc across browser tabs via BroadcastChannel (same origin).
 */
export function subscribeMessageCrdtMultiTabSync(
  roomId: string,
  onPeerUpdate: () => void,
): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};

  const trimmed = roomId.trim();
  const doc = getRoomMessageCrdtDoc(trimmed);
  const channel = new BroadcastChannel(`fluxy-crdt-messages:${trimmed}`);

  const onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === "remote-tab") return;
    channel.postMessage({ tabId: TAB_ID, update: Array.from(update) });
  };

  doc.on("update", onDocUpdate);

  channel.onmessage = (event: MessageEvent<{ tabId?: string; update?: number[] }>) => {
    const data = event.data;
    if (!data?.update?.length || data.tabId === TAB_ID) return;
    Y.applyUpdate(doc, new Uint8Array(data.update), "remote-tab");
    onPeerUpdate();
  };

  return () => {
    doc.off("update", onDocUpdate);
    channel.close();
  };
}
