/**
 * D1-backed digital twin spatial scenes (H-5).
 */

import { fanoutServerEvent } from "./message-realtime-fanout.js";

function nowIso() {
  return new Date().toISOString();
}

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function rowToScene(row, entities = []) {
  return {
    id: row.id,
    name: row.name,
    roomId: row.room_id || undefined,
    metadata: parseJson(row.metadata_json, {}),
    entities,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function rowToEntity(row) {
  return {
    id: row.id,
    type: row.type,
    position: parseJson(row.position_json, { x: 0, y: 0, z: 0 }),
    rotation: row.rotation_json ? parseJson(row.rotation_json, undefined) : undefined,
    properties: parseJson(row.properties_json, {}),
  };
}

export async function createSpatialScene(env, input, auth) {
  const name = String(input.name ?? "").trim();
  if (!name) return { ok: false, error: "name_required" };

  const id = `scene_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = nowIso();
  const effectiveRoomId = input.roomId?.trim() || `spatial:${auth.projectId}`;
  await env.DB.prepare(
    `INSERT INTO spatial_scenes (id, project_id, room_id, name, metadata_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      auth.projectId,
      effectiveRoomId,
      name.slice(0, 200),
      input.metadata ? JSON.stringify(input.metadata) : null,
      now,
      now,
    )
    .run();

  await fanoutServerEvent(env, {
    projectId: auth.projectId,
    roomId: effectiveRoomId,
    name: "spatial.scene_created",
    userId: auth.userId ?? "system",
    data: { sceneId: id, name: name.slice(0, 200) },
  }).catch(() => {});

  return { ok: true, scene: rowToScene({ id, name, room_id: effectiveRoomId, metadata_json: input.metadata ? JSON.stringify(input.metadata) : null, updated_at: now }, []) };
}

export async function listSpatialScenes(env, auth, filter = {}) {
  let sql = `SELECT * FROM spatial_scenes WHERE project_id = ?`;
  const params = [auth.projectId];
  if (filter.roomId) {
    sql += ` AND room_id = ?`;
    params.push(filter.roomId);
  }
  sql += ` ORDER BY updated_at DESC LIMIT ?`;
  params.push(Math.min(Number(filter.limit) || 50, 100));

  const rows = await env.DB.prepare(sql).bind(...params).all();
  const scenes = [];
  for (const row of rows.results || []) {
    const entityRows = await env.DB.prepare(
      `SELECT * FROM spatial_entities WHERE project_id = ? AND scene_id = ? ORDER BY created_at ASC`,
    )
      .bind(auth.projectId, row.id)
      .all();
    scenes.push(rowToScene(row, (entityRows.results || []).map(rowToEntity)));
  }
  return { ok: true, scenes };
}

export async function getSpatialScene(env, auth, sceneId) {
  const row = await env.DB.prepare(
    `SELECT * FROM spatial_scenes WHERE project_id = ? AND id = ?`,
  )
    .bind(auth.projectId, sceneId)
    .first();
  if (!row) return { ok: false, error: "not_found" };

  const entityRows = await env.DB.prepare(
    `SELECT * FROM spatial_entities WHERE project_id = ? AND scene_id = ? ORDER BY created_at ASC`,
  )
    .bind(auth.projectId, sceneId)
    .all();

  return { ok: true, scene: rowToScene(row, (entityRows.results || []).map(rowToEntity)) };
}

export async function addSpatialEntity(env, auth, sceneId, input) {
  const scene = await getSpatialScene(env, auth, sceneId);
  if (!scene.ok) return scene;

  const id = `ent_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = nowIso();
  const position = input.position ?? { x: Number(input.x ?? 0), y: Number(input.y ?? 0), z: Number(input.z ?? 0) };

  await env.DB.prepare(
    `INSERT INTO spatial_entities
     (id, scene_id, project_id, type, position_json, rotation_json, properties_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      sceneId,
      auth.projectId,
      String(input.type ?? "object").slice(0, 64),
      JSON.stringify(position),
      input.rotation ? JSON.stringify(input.rotation) : null,
      input.properties ? JSON.stringify(input.properties) : null,
      now,
      now,
    )
    .run();

  await env.DB.prepare(`UPDATE spatial_scenes SET updated_at = ? WHERE id = ? AND project_id = ?`)
    .bind(now, sceneId, auth.projectId)
    .run();

  const roomId = scene.scene.roomId;
  if (roomId) {
    await fanoutServerEvent(env, {
      projectId: auth.projectId,
      roomId,
      name: "spatial.entity_added",
      userId: auth.userId ?? "system",
      data: {
        sceneId,
        entityId: id,
        type: String(input.type ?? "object"),
        position,
        properties: input.properties ?? {},
      },
    }).catch(() => {});
  }

  return {
    ok: true,
    entity: {
      id,
      type: String(input.type ?? "object"),
      position,
      rotation: input.rotation,
      properties: input.properties ?? {},
    },
  };
}

export async function grantSpatialAgent(env, auth, sceneId, input) {
  const scene = await getSpatialScene(env, auth, sceneId);
  if (!scene.ok) return scene;

  const agentId = String(input.agentId ?? "").trim();
  if (!agentId) return { ok: false, error: "agent_id_required" };

  const grants = Array.isArray(input.grants) ? input.grants : ["view"];
  const now = nowIso();

  await env.DB.prepare(
    `INSERT INTO spatial_agent_grants (scene_id, project_id, agent_id, grants_json, entity_filter_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(scene_id, agent_id) DO UPDATE SET
       grants_json = excluded.grants_json,
       entity_filter_json = excluded.entity_filter_json,
       updated_at = excluded.updated_at`,
  )
    .bind(
      sceneId,
      auth.projectId,
      agentId,
      JSON.stringify(grants),
      input.entityFilter ? JSON.stringify(input.entityFilter) : null,
      now,
    )
    .run();

  return { ok: true };
}

export async function deleteSpatialScene(env, auth, sceneId) {
  const result = await env.DB.prepare(
    `DELETE FROM spatial_scenes WHERE project_id = ? AND id = ?`,
  )
    .bind(auth.projectId, sceneId)
    .run();
  if (!result.meta?.changes) return { ok: false, error: "not_found" };
  return { ok: true };
}
