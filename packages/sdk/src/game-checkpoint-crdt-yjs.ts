import * as Y from "yjs";

export const FLUXY_GAME_CHECKPOINTS_MAP_KEY = "fluxy_game_checkpoints";

export interface GameCheckpointRecord {
  checkpointKey: string;
  playerId: string;
  state: Record<string, unknown>;
  version: number;
  updatedAt: string;
}

export interface GameCheckpointCrdtSnapshot {
  update: string;
  checkpointCount: number;
  roomId: string;
}

export function checkpointMapKey(playerId: string, checkpointKey: string): string {
  return `${playerId}:${checkpointKey}`;
}

export function shouldPreferCheckpoint(
  existing: Pick<GameCheckpointRecord, "version" | "updatedAt">,
  incoming: Pick<GameCheckpointRecord, "version" | "updatedAt">,
): boolean {
  const existingVersion = Number(existing.version ?? 0);
  const incomingVersion = Number(incoming.version ?? 0);
  if (incomingVersion !== existingVersion) return incomingVersion > existingVersion;
  return String(incoming.updatedAt ?? "") >= String(existing.updatedAt ?? "");
}

export function serializeCheckpointForYjs(checkpoint: GameCheckpointRecord): GameCheckpointRecord {
  return {
    checkpointKey: String(checkpoint.checkpointKey),
    playerId: String(checkpoint.playerId),
    state: checkpoint.state && typeof checkpoint.state === "object" ? checkpoint.state : {},
    version: Number(checkpoint.version ?? 1),
    updatedAt: String(checkpoint.updatedAt ?? new Date().toISOString()),
  };
}

export function upsertCheckpointInDoc(doc: Y.Doc, checkpoint: GameCheckpointRecord): void {
  const map = doc.getMap(FLUXY_GAME_CHECKPOINTS_MAP_KEY);
  const serialized = serializeCheckpointForYjs(checkpoint);
  const key = checkpointMapKey(serialized.playerId, serialized.checkpointKey);
  const existing = map.get(key) as GameCheckpointRecord | undefined;
  if (existing && !shouldPreferCheckpoint(existing, serialized)) return;
  map.set(key, serialized);
}

export function readCheckpointsFromDoc(doc: Y.Doc): GameCheckpointRecord[] {
  const map = doc.getMap(FLUXY_GAME_CHECKPOINTS_MAP_KEY);
  const out: GameCheckpointRecord[] = [];
  map.forEach((value) => {
    if (value && typeof value === "object") out.push(value as GameCheckpointRecord);
  });
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function mergeRestCheckpointWithYjsRecord(
  d1Checkpoint: GameCheckpointRecord | null,
  yjsRecord: GameCheckpointRecord | null,
): GameCheckpointRecord | null {
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

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export function applyGameCheckpointCrdtUpdate(doc: Y.Doc, updateBase64: string): void {
  Y.applyUpdate(doc, base64ToUint8Array(updateBase64), "remote");
}

const roomDocs = new Map<string, Y.Doc>();

export function getRoomGameCheckpointDoc(roomId: string): Y.Doc {
  const trimmed = roomId.trim();
  let doc = roomDocs.get(trimmed);
  if (!doc) {
    doc = new Y.Doc();
    roomDocs.set(trimmed, doc);
  }
  return doc;
}

export function resetRoomGameCheckpointDocsForTests(): void {
  roomDocs.clear();
}

export function mergeCheckpointListWithYjsDoc(
  d1Checkpoints: GameCheckpointRecord[],
  doc: Y.Doc,
): GameCheckpointRecord[] {
  const yjsRecords = readCheckpointsFromDoc(doc);
  const byKey = new Map<string, GameCheckpointRecord>();
  for (const row of d1Checkpoints) {
    byKey.set(checkpointMapKey(row.playerId, row.checkpointKey), row);
  }
  for (const yjs of yjsRecords) {
    const key = checkpointMapKey(yjs.playerId, yjs.checkpointKey);
    const existing = byKey.get(key);
    byKey.set(key, mergeRestCheckpointWithYjsRecord(existing ?? null, yjs)!);
  }
  return [...byKey.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function mergeSingleCheckpointWithYjsDoc(
  d1Checkpoint: GameCheckpointRecord | null,
  doc: Y.Doc,
  playerId: string,
  checkpointKey: string,
): GameCheckpointRecord | null {
  const yjs = readCheckpointsFromDoc(doc).find(
    (row) => row.playerId === playerId && row.checkpointKey === checkpointKey,
  );
  return mergeRestCheckpointWithYjsRecord(d1Checkpoint, yjs ?? null);
}
