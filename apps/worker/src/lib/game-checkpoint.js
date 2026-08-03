/**
 * Versioned cloud checkpoints — optimistic concurrency for game save state.
 */

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function rowToCheckpoint(row) {
  return {
    checkpointKey: row.checkpoint_key,
    playerId: row.player_id,
    state: parseJson(row.state_json, {}),
    version: Number(row.version),
    updatedAt: row.updated_at,
  };
}

export async function getGameCheckpoint(env, auth, checkpointKey, playerId) {
  const key = String(checkpointKey ?? "").trim().slice(0, 64);
  const pid = String(playerId ?? auth.userId).trim();
  if (!key || !pid) return { ok: false, error: "checkpoint_required" };

  const row = await env.DB.prepare(
    `SELECT * FROM game_checkpoints WHERE project_id = ? AND player_id = ? AND checkpoint_key = ?`,
  )
    .bind(auth.projectId, pid, key)
    .first();

  if (!row) return { ok: true, checkpoint: null };
  return { ok: true, checkpoint: rowToCheckpoint(row) };
}

export async function listGameCheckpoints(env, auth, playerId) {
  const pid = String(playerId ?? auth.userId).trim();
  const rows = await env.DB.prepare(
    `SELECT * FROM game_checkpoints WHERE project_id = ? AND player_id = ? ORDER BY updated_at DESC LIMIT 50`,
  )
    .bind(auth.projectId, pid)
    .all();

  return {
    ok: true,
    checkpoints: (rows.results || []).map(rowToCheckpoint),
  };
}

export async function upsertGameCheckpoint(env, auth, input) {
  const key = String(input.checkpointKey ?? input.key ?? "").trim().slice(0, 64);
  const pid = String(input.playerId ?? auth.userId).trim();
  const state = input.state ?? input.cloudSave ?? {};
  const expectedVersion = input.expectedVersion != null ? Number(input.expectedVersion) : null;

  if (!key || !pid) return { ok: false, error: "checkpoint_required" };
  if (typeof state !== "object" || state === null || Array.isArray(state)) {
    return { ok: false, error: "invalid_state" };
  }

  const existing = await env.DB.prepare(
    `SELECT version, state_json FROM game_checkpoints WHERE project_id = ? AND player_id = ? AND checkpoint_key = ?`,
  )
    .bind(auth.projectId, pid, key)
    .first();

  const now = new Date().toISOString();

  if (existing && expectedVersion != null && Number(existing.version) !== expectedVersion) {
    return {
      ok: false,
      error: "version_conflict",
      conflict: true,
      checkpoint: rowToCheckpoint({
        checkpoint_key: key,
        player_id: pid,
        state_json: existing.state_json,
        version: existing.version,
        updated_at: now,
      }),
    };
  }

  const nextVersion = existing ? Number(existing.version) + 1 : 1;

  await env.DB.prepare(
    `INSERT INTO game_checkpoints (project_id, player_id, checkpoint_key, state_json, version, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, player_id, checkpoint_key) DO UPDATE SET
       state_json = excluded.state_json,
       version = excluded.version,
       updated_at = excluded.updated_at`,
  )
    .bind(auth.projectId, pid, key, JSON.stringify(state), nextVersion, now)
    .run();

  const checkpoint = {
    checkpointKey: key,
    playerId: pid,
    state,
    version: nextVersion,
    updatedAt: now,
  };

  const roomId = String(input.roomId ?? "").trim();
  if (roomId) {
    const { syncGameCheckpointToRoom } = await import("./yjs-game-checkpoint.js");
    void syncGameCheckpointToRoom(env, {
      projectId: auth.projectId,
      roomId,
      userId: auth.userId,
      checkpoint,
    }).catch(() => {});
  }

  return { ok: true, checkpoint };
}

export async function getGameCheckpointMerged(env, auth, checkpointKey, playerId, roomId) {
  const base = await getGameCheckpoint(env, auth, checkpointKey, playerId);
  if (!base.ok || !roomId?.trim()) return base;

  const { fetchGameCheckpointCrdtSnapshot, mergeRestCheckpointWithYjsRecord, readCheckpointsFromDoc, applyGameCheckpointCrdtUpdate } = await import(
    "./yjs-game-checkpoint.js"
  );
  const snapshot = await fetchGameCheckpointCrdtSnapshot(env, {
    projectId: auth.projectId,
    roomId: roomId.trim(),
    userId: auth.userId,
  }).catch(() => null);
  if (!snapshot?.update) return base;

  const Y = await import("yjs");
  const doc = new Y.Doc();
  applyGameCheckpointCrdtUpdate(doc, snapshot.update);
  const pid = String(playerId ?? auth.userId).trim();
  const key = String(checkpointKey ?? "").trim();
  const yjsRow = readCheckpointsFromDoc(doc).find(
    (row) => row.playerId === pid && row.checkpointKey === key,
  );
  if (!yjsRow) return base;

  return {
    ok: true,
    checkpoint: mergeRestCheckpointWithYjsRecord(base.checkpoint, yjsRow),
    crdtMerged: true,
  };
}

export async function listGameCheckpointsMerged(env, auth, playerId, roomId) {
  const base = await listGameCheckpoints(env, auth, playerId);
  if (!base.ok || !roomId?.trim()) return base;

  const { fetchGameCheckpointCrdtSnapshot, mergeRestCheckpointWithYjsRecord, readCheckpointsFromDoc, applyGameCheckpointCrdtUpdate } = await import(
    "./yjs-game-checkpoint.js"
  );
  const snapshot = await fetchGameCheckpointCrdtSnapshot(env, {
    projectId: auth.projectId,
    roomId: roomId.trim(),
    userId: auth.userId,
  }).catch(() => null);
  if (!snapshot?.update) return base;

  const Y = await import("yjs");
  const doc = new Y.Doc();
  applyGameCheckpointCrdtUpdate(doc, snapshot.update);
  const pid = String(playerId ?? auth.userId).trim();
  const byKey = new Map(base.checkpoints.map((c) => [`${c.playerId}:${c.checkpointKey}`, c]));
  for (const yjs of readCheckpointsFromDoc(doc)) {
    if (yjs.playerId !== pid) continue;
    const mapKey = `${yjs.playerId}:${yjs.checkpointKey}`;
    byKey.set(mapKey, mergeRestCheckpointWithYjsRecord(byKey.get(mapKey) ?? null, yjs));
  }
  return {
    ok: true,
    checkpoints: [...byKey.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    crdtMerged: true,
  };
}

export async function federateGameCheckpoint(env, auth, input) {
  const key = String(input.checkpointKey ?? input.key ?? "").trim().slice(0, 64);
  const pid = String(input.playerId ?? auth.userId).trim();
  const sourceRoomId = String(input.sourceRoomId ?? input.roomId ?? "").trim();
  const targetRoomId = String(input.targetRoomId ?? "").trim();
  if (!key || !pid || !sourceRoomId || !targetRoomId) {
    return { ok: false, error: "checkpoint_source_target_required" };
  }

  const merged = await getGameCheckpointMerged(env, auth, key, pid, sourceRoomId);
  if (!merged.ok || !merged.checkpoint) return { ok: false, error: "checkpoint_not_found" };

  const saved = await upsertGameCheckpoint(env, auth, {
    checkpointKey: key,
    playerId: pid,
    state: merged.checkpoint.state,
    roomId: targetRoomId,
  });
  if (!saved.ok) return saved;

  return {
    ok: true,
    checkpoint: saved.checkpoint,
    sourceRoomId,
    targetRoomId,
    federated: true,
  };
}
