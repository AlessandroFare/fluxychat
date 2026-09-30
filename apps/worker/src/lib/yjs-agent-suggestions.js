/**
 * Agent edit proposals on the room Y.Doc. Humans see `fluxy_agent_suggestions`;
 * accept copies `value` onto `storage[storageKey]`.
 */
import * as Y from "yjs";
import { uint8ToBase64 } from "./yjs-message-list.js";

export const FLUXY_AGENT_SUGGESTIONS_MAP_KEY = "fluxy_agent_suggestions";
export const FLUXY_YJS_STORAGE_MAP_KEY = "storage";

export function serializeAgentSuggestion(record) {
  const status = record.status === "accepted" || record.status === "rejected" ? record.status : "pending";
  return {
    id: String(record.id || ""),
    agentId: String(record.agentId || "").slice(0, 128),
    storageKey: String(record.storageKey || "").slice(0, 64),
    value: record.value,
    comment: record.comment ? String(record.comment).slice(0, 500) : null,
    status,
    approvalId: record.approvalId ? String(record.approvalId) : null,
    createdAt: String(record.createdAt || new Date().toISOString()),
    updatedAt: String(record.updatedAt || record.createdAt || new Date().toISOString()),
  };
}

export function upsertAgentSuggestionInDoc(doc, record) {
  const map = doc.getMap(FLUXY_AGENT_SUGGESTIONS_MAP_KEY);
  const serialized = serializeAgentSuggestion(record);
  if (!serialized.id || !serialized.storageKey) return false;
  map.set(serialized.id, serialized);
  return true;
}

export function readAgentSuggestionFromDoc(doc, id) {
  const map = doc.getMap(FLUXY_AGENT_SUGGESTIONS_MAP_KEY);
  const value = map.get(String(id || ""));
  return value && typeof value === "object" ? serializeAgentSuggestion(value) : null;
}

export function listAgentSuggestionsFromDoc(doc) {
  const map = doc.getMap(FLUXY_AGENT_SUGGESTIONS_MAP_KEY);
  const out = [];
  map.forEach((value) => {
    if (value && typeof value === "object") out.push(serializeAgentSuggestion(value));
  });
  return out.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export function applySuggestionToStorageMap(doc, suggestion) {
  if (!suggestion?.storageKey) return false;
  const storage = doc.getMap(FLUXY_YJS_STORAGE_MAP_KEY);
  storage.set(suggestion.storageKey, suggestion.value);
  return true;
}

export async function syncAgentSuggestionToYjsRoomDoc(yjsSync, roomId, storage, record, broadcastFn, { applyStorage = false } = {}) {
  const doc = await yjsSync.getDoc(roomId, storage);
  const stateVector = Y.encodeStateVector(doc);
  let changed = upsertAgentSuggestionInDoc(doc, record);
  if (applyStorage && record.status === "accepted") {
    changed = applySuggestionToStorageMap(doc, serializeAgentSuggestion(record)) || changed;
  }
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

export async function getAgentSuggestionsCrdtSnapshotPayload(yjsSync, roomId, storage, suggestionId) {
  const doc = await yjsSync.getDoc(roomId, storage);
  const record = suggestionId ? readAgentSuggestionFromDoc(doc, suggestionId) : null;
  return {
    update: uint8ToBase64(Y.encodeStateAsUpdate(doc)),
    roomId,
    suggestionId: suggestionId || null,
    record,
    suggestions: suggestionId ? undefined : listAgentSuggestionsFromDoc(doc),
  };
}

export async function syncAgentSuggestionToRoom(env, { projectId, roomId, userId, record, applyStorage = false }) {
  const { getRoomStubForProject } = await import("./room-shard.js");
  const stub = await getRoomStubForProject(env, projectId, roomId, userId);
  await stub.fetch("https://internal/yjs/agent-suggestions/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ record, applyStorage }),
  });
}
