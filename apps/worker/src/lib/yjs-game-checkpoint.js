/**
 * Yjs-backed game checkpoint map inside the room Y.Doc (multi-device merge).
 */

import * as Y from "yjs";
import { base64ToUint8, uint8ToBase64 } from "./yjs-message-list.js";

export const FLUXY_GAME_CHECKPOINTS_MAP_KEY = "fluxy_game_checkpoints";

export function checkpointMapKey(playerId, checkpointKey) {
  return `${String(playerId)}:${String(checkpointKey)}`;
}

export function shouldPreferCheckpoint(existing, incoming) {
  const existingVersion = Number(existing?.version ?? 0);
  const incomingVersion = Number(incoming?.version ?? 0);
  if (incomingVersion !== existingVersion) return incomingVersion > existingVersion;
  return String(incoming?.updatedAt ?? "") >= String(existing?.updatedAt ?? "");
}

export function serializeCheckpointForYjs(checkpoint) {
  return {
    checkpointKey: String(checkpoint.checkpointKey ?? checkpoint.key ?? ""),
    playerId: String(checkpoint.playerId ?? ""),
    state: checkpoint.state && typeof checkpoint.state === "object" ? checkpoint.state : {},
    version: Number(checkpoint.version ?? 1),
    updatedAt: String(checkpoint.updatedAt ?? new Date().toISOString()),
  };
}

export function upsertCheckpointInDoc(doc, checkpoint) {
  const map = doc.getMap(FLUXY_GAME_CHECKPOINTS_MAP_KEY);
  const serialized = serializeCheckpointForYjs(checkpoint);
  const key = checkpointMapKey(serialized.playerId, serialized.checkpointKey);
  const existing = map.get(key);
  if (existing && !shouldPreferCheckpoint(existing, serialized)) return false;
  map.set(key, serialized);
  return true;
}

export function readCheckpointsFromDoc(doc) {
  const map = doc.getMap(FLUXY_GAME_CHECKPOINTS_MAP_KEY);
  /** @type {ReturnType<typeof serializeCheckpointForYjs>[]} */
  const out = [];
  map.forEach((value) => {
    if (value && typeof value === "object") out.push(value);
  });
  return out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function mergeRestCheckpointWithYjsRecord(d1Checkpoint, yjsRecord) {
  if (!d1Checkpoint) return yjsRecord ? serializeCheckpointForYjs(yjsRecord) : null;
  if (!yjsRecord) return d1Checkpoint;
  if (shouldPreferCheckpoint(d1Checkpoint, yjsRecord)) {
    return {
      ...yjsRecord,
      state: { ...d1Checkpoint.state, ...yjsRecord.state },
    };
  }
  return {
    ...d1Checkpoint,
    state: { ...yjsRecord.state, ...d1Checkpoint.state },
  };
}

export function encodeGameCheckpointCrdtSnapshot(doc) {
  return Y.encodeStateAsUpdate(doc);
}

export function applyGameCheckpointCrdtUpdate(doc, updateBase64) {
  Y.applyUpdate(doc, base64ToUint8(updateBase64), "remote");
}

/**
 * @param {import("./yjs-sync.js").YjsSyncHandler} yjsSync
 * @param {string} roomId
 * @param {import("@cloudflare/workers-types").DurableObjectStorage} storage
 * @param {Record<string, unknown>} checkpoint
 */
export async function syncCheckpointToYjsRoomDoc(yjsSync, roomId, storage, checkpoint) {
  const doc = await yjsSync.getDoc(roomId, storage);
  upsertCheckpointInDoc(doc, checkpoint);
}

/**
 * @param {import("./yjs-sync.js").YjsSyncHandler} yjsSync
 * @param {string} roomId
 * @param {import("@cloudflare/workers-types").DurableObjectStorage} storage
 */
export async function getGameCheckpointCrdtSnapshotPayload(yjsSync, roomId, storage) {
  const doc = await yjsSync.getDoc(roomId, storage);
  const checkpoints = readCheckpointsFromDoc(doc);
  return {
    update: uint8ToBase64(encodeGameCheckpointCrdtSnapshot(doc)),
    checkpointCount: checkpoints.length,
    roomId,
  };
}

export async function syncGameCheckpointToRoom(env, { projectId, roomId, userId, checkpoint }) {
  const { getRoomStubForProject } = await import("./room-shard.js");
  const stub = await getRoomStubForProject(env, projectId, roomId, userId);
  await stub.fetch("https://internal/game-checkpoints/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checkpoint }),
  });
}

export async function fetchGameCheckpointCrdtSnapshot(env, { projectId, roomId, userId }) {
  const { getRoomStubForProject } = await import("./room-shard.js");
  const stub = await getRoomStubForProject(env, projectId, roomId, userId);
  const res = await stub.fetch("https://internal/game-checkpoints/crdt-snapshot", { method: "GET" });
  if (!res.ok) return null;
  return res.json();
}
