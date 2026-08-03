import * as Y from "yjs";

/** Y.Map key inside the room Y.Doc for persisted chat messages. */
export const FLUXY_MESSAGES_MAP_KEY = "fluxy_messages";

export function messageMapKey(message) {
  if (message.clientMessageId) return `c:${message.clientMessageId}`;
  return `s:${message.id}`;
}

export function messageVersionTs(message) {
  return String(message.deletedAt || message.editedAt || message.createdAt || "");
}

export function shouldPreferYjsRecord(existing, incoming) {
  return messageVersionTs(incoming) >= messageVersionTs(existing);
}

export function serializeMessageForYjs(message) {
  return {
    id: Number(message.id),
    roomId: String(message.roomId ?? ""),
    userId: String(message.userId ?? message.senderId ?? ""),
    senderId: String(message.senderId ?? message.userId ?? ""),
    content: String(message.content ?? ""),
    createdAt: String(message.createdAt ?? new Date().toISOString()),
    parentId: message.parentId ?? null,
    clientMessageId: message.clientMessageId ?? null,
    editedAt: message.editedAt ?? null,
    deletedAt: message.deletedAt ?? null,
  };
}

export function upsertMessageInDoc(doc, message) {
  const map = doc.getMap(FLUXY_MESSAGES_MAP_KEY);
  const key = messageMapKey(message);
  const next = serializeMessageForYjs(message);
  const existing = map.get(key);
  if (existing && !shouldPreferYjsRecord(existing, next)) return false;
  map.set(key, next);
  return true;
}

export function readMessagesFromDoc(doc) {
  const map = doc.getMap(FLUXY_MESSAGES_MAP_KEY);
  /** @type {ReturnType<typeof serializeMessageForYjs>[]} */
  const out = [];
  map.forEach((value) => {
    if (value && typeof value === "object" && !value.deletedAt) {
      out.push(value);
    }
  });
  return out.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export function encodeMessageCrdtSnapshot(doc) {
  return Y.encodeStateAsUpdate(doc);
}

export function uint8ToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8(base64) {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/**
 * @param {import("./yjs-sync.js").YjsSyncHandler} yjsSync
 * @param {string} roomId
 * @param {import("@cloudflare/workers-types").DurableObjectStorage} storage
 * @param {Record<string, unknown>} message
 */
export async function syncMessageToYjsRoomDoc(yjsSync, roomId, storage, message, broadcastFn) {
  const doc = await yjsSync.getDoc(roomId, storage);
  const stateVector = Y.encodeStateVector(doc);
  const changed = upsertMessageInDoc(doc, message);
  if (changed && typeof broadcastFn === "function") {
    const update = Y.encodeStateAsUpdate(doc, stateVector);
    if (update.byteLength > 0) {
      const frame = new Uint8Array(1 + update.byteLength);
      frame[0] = 1;
      frame.set(update, 1);
      broadcastFn(frame);
    }
  }
  return changed;
}

/**
 * @param {import("./yjs-sync.js").YjsSyncHandler} yjsSync
 * @param {string} roomId
 * @param {import("@cloudflare/workers-types").DurableObjectStorage} storage
 * @param {Record<string, unknown>} message
 */
export async function syncMessageEditToYjsRoomDoc(yjsSync, roomId, storage, message, broadcastFn) {
  const doc = await yjsSync.getDoc(roomId, storage);
  const stateVector = Y.encodeStateVector(doc);
  const changed = upsertMessageInDoc(doc, {
    ...message,
    editedAt: message.editedAt ?? new Date().toISOString(),
  });
  if (changed && typeof broadcastFn === "function") {
    const update = Y.encodeStateAsUpdate(doc, stateVector);
    if (update.byteLength > 0) {
      const frame = new Uint8Array(1 + update.byteLength);
      frame[0] = 1;
      frame.set(update, 1);
      broadcastFn(frame);
    }
  }
  return changed;
}

/**
 * @param {import("./yjs-sync.js").YjsSyncHandler} yjsSync
 * @param {string} roomId
 * @param {import("@cloudflare/workers-types").DurableObjectStorage} storage
 * @param {Record<string, unknown>} message
 */
export async function syncMessageDeleteToYjsRoomDoc(yjsSync, roomId, storage, message, broadcastFn) {
  const doc = await yjsSync.getDoc(roomId, storage);
  const stateVector = Y.encodeStateVector(doc);
  const changed = upsertMessageInDoc(doc, {
    ...message,
    content: message.content ?? "[deleted]",
    deletedAt: message.deletedAt ?? new Date().toISOString(),
  });
  if (changed && typeof broadcastFn === "function") {
    const update = Y.encodeStateAsUpdate(doc, stateVector);
    if (update.byteLength > 0) {
      const frame = new Uint8Array(1 + update.byteLength);
      frame[0] = 1;
      frame.set(update, 1);
      broadcastFn(frame);
    }
  }
  return changed;
}

/**
 * @param {import("./yjs-sync.js").YjsSyncHandler} yjsSync
 * @param {string} roomId
 * @param {import("@cloudflare/workers-types").DurableObjectStorage} storage
 */
export async function getMessageCrdtSnapshotPayload(yjsSync, roomId, storage) {
  const doc = await yjsSync.getDoc(roomId, storage);
  const update = encodeMessageCrdtSnapshot(doc);
  const messages = readMessagesFromDoc(doc);
  return {
    update: uint8ToBase64(update),
    messageCount: messages.length,
    roomId,
  };
}
