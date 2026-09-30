/**
 * MCP App shared state on the room Y.Doc (same LWW map pattern as game checkpoints).
 * HTTP still uses KV JSON merge. Yjs clients see `fluxy_mcp_app_state`.
 */
import * as Y from "yjs";
import { uint8ToBase64 } from "./yjs-message-list.js";

export const FLUXY_MCP_APP_STATE_MAP_KEY = "fluxy_mcp_app_state";

export function shouldPreferMcpAppState(existing, incoming) {
  const existingVersion = Number(existing?.version ?? 0);
  const incomingVersion = Number(incoming?.version ?? 0);
  if (incomingVersion !== existingVersion) return incomingVersion > existingVersion;
  return String(incoming?.updatedAt ?? "") >= String(existing?.updatedAt ?? "");
}

export function serializeMcpAppStateForYjs(record) {
  return {
    appId: String(record.appId ?? ""),
    state: record.state && typeof record.state === "object" && !Array.isArray(record.state) ? record.state : {},
    version: Number(record.version ?? 0),
    updatedAt: String(record.updatedAt ?? new Date().toISOString()),
    updatedBy: record.updatedBy ? String(record.updatedBy) : null,
  };
}

export function upsertMcpAppStateInDoc(doc, record) {
  const map = doc.getMap(FLUXY_MCP_APP_STATE_MAP_KEY);
  const serialized = serializeMcpAppStateForYjs(record);
  if (!serialized.appId) return false;
  const existing = map.get(serialized.appId);
  if (existing && !shouldPreferMcpAppState(existing, serialized)) return false;
  map.set(serialized.appId, serialized);
  return true;
}

export function readMcpAppStateFromDoc(doc, appId) {
  const map = doc.getMap(FLUXY_MCP_APP_STATE_MAP_KEY);
  const value = map.get(String(appId || ""));
  return value && typeof value === "object" ? serializeMcpAppStateForYjs(value) : null;
}

/**
 * @param {import("./yjs-sync.js").YjsSyncHandler} yjsSync
 */
export async function syncMcpAppStateToYjsRoomDoc(yjsSync, roomId, storage, record) {
  const doc = await yjsSync.getDoc(roomId, storage);
  upsertMcpAppStateInDoc(doc, record);
}

export async function getMcpAppStateCrdtSnapshotPayload(yjsSync, roomId, storage, appId) {
  const doc = await yjsSync.getDoc(roomId, storage);
  const record = appId ? readMcpAppStateFromDoc(doc, appId) : null;
  return {
    update: uint8ToBase64(Y.encodeStateAsUpdate(doc)),
    roomId,
    appId: appId || null,
    record,
  };
}

export async function syncMcpAppStateToRoom(env, { projectId, roomId, userId, record }) {
  const { getRoomStubForProject } = await import("./room-shard.js");
  const stub = await getRoomStubForProject(env, projectId, roomId, userId);
  await stub.fetch("https://internal/mcp-apps/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ record }),
  });
}
