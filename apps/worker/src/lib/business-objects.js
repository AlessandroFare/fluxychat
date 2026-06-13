import { logInfo } from "./worker-log.js";

function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const VALID_STATES = ["active", "resolved", "archived", "pending", "in_progress"];

export function isValidObjectState(state) {
  return VALID_STATES.includes(state);
}

export async function createObject(env, { projectId, roomId, objectType, objectId, state, payload, createdBy }) {
  const id = `biz_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO business_objects (id, project_id, room_id, object_type, object_id, state, payload_json, version, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)"
  )
    .bind(id, projectId, roomId, objectType, objectId, state || "active", JSON.stringify(payload || {}), createdBy || null, now, now)
    .run();

  await recordEvent(env, { projectId, roomId, objectId: id, eventType: "created", payload: payload || {}, actorUserId: createdBy, version: 1 });

  return { id, created: true };
}

export async function updateObject(env, { id, state, payload, actorUserId }) {
  const existing = await getObject(env, id);
  if (!existing) return { error: "not_found" };

  const now = new Date().toISOString();
  const newVersion = Number(existing.version) + 1;
  const newState = state || existing.state;
  const newPayload = payload !== undefined ? payload : existing.payload;

  await env.DB.prepare(
    "UPDATE business_objects SET state = ?, payload_json = ?, version = ?, updated_at = ? WHERE id = ?"
  )
    .bind(newState, JSON.stringify(newPayload), newVersion, now, id)
    .run();

  await recordEvent(env, {
    projectId: existing.projectId,
    roomId: existing.roomId,
    objectId: id,
    eventType: state ? "state_changed" : "updated",
    payload: newPayload,
    actorUserId,
    version: newVersion,
  });

  return { id, updated: true, version: newVersion };
}

export async function getObject(env, id) {
  const row = await env.DB.prepare("SELECT * FROM business_objects WHERE id = ?").bind(id).first();
  return row ? mapObjectRow(row) : null;
}

export async function getObjectsByRoom(env, { roomId, objectType, state, limit = 50 }) {
  let query = "SELECT * FROM business_objects WHERE room_id = ?";
  const params = [roomId];

  if (objectType) { query += " AND object_type = ?"; params.push(objectType); }
  if (state) { query += " AND state = ?"; params.push(state); }
  query += " ORDER BY updated_at DESC LIMIT ?";
  params.push(limit);

  const rows = await env.DB.prepare(query).bind(...params).all();
  return (rows.results || []).map(mapObjectRow);
}

export async function deleteObject(env, { id, actorUserId }) {
  const existing = await getObject(env, id);
  if (!existing) return { error: "not_found" };

  await env.DB.prepare("DELETE FROM business_objects WHERE id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM business_object_events WHERE object_id = ?").bind(id).run();

  return { deleted: true };
}

export async function recordEvent(env, { projectId, roomId, objectId, eventType, payload, actorUserId, version }) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO business_object_events (project_id, room_id, object_id, event_type, payload_json, actor_user_id, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(projectId, roomId, objectId, eventType, JSON.stringify(payload || {}), actorUserId || null, version || 1, now)
    .run();
}

export async function getEvents(env, { roomId, objectId, limit = 50 }) {
  let query = "SELECT * FROM business_object_events WHERE room_id = ?";
  const params = [roomId];

  if (objectId) { query += " AND object_id = ?"; params.push(objectId); }
  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  const rows = await env.DB.prepare(query).bind(...params).all();
  return (rows.results || []).map(mapEventRow);
}

export async function subscribeToObjectEvents(env, { projectId, roomId, userId, objectType, eventTypes }) {
  const id = `bsub_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO business_object_subscriptions (id, project_id, room_id, user_id, object_type, event_types_json, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)"
  )
    .bind(id, projectId, roomId, userId, objectType || null, JSON.stringify(eventTypes || []), now)
    .run();

  return { id, created: true };
}

export async function getSubscriptions(env, { roomId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM business_object_subscriptions WHERE room_id = ? AND enabled = 1"
  )
    .bind(roomId)
    .all();

  return (rows.results || []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    objectType: r.object_type,
    eventTypes: JSON.parse(r.event_types_json || "[]"),
  }));
}

export async function unsubscribeFromObjectEvents(env, { id }) {
  const result = await env.DB.prepare(
    "DELETE FROM business_object_subscriptions WHERE id = ?"
  )
    .bind(id)
    .run();
  return { deleted: result.meta?.changes || 0 };
}

export async function getObjectStats(env, { roomId }) {
  const rows = await env.DB.prepare(
    "SELECT object_type, state, COUNT(*) as count FROM business_objects WHERE room_id = ? GROUP BY object_type, state"
  )
    .bind(roomId)
    .all();

  const stats = {};
  for (const r of rows.results || []) {
    if (!stats[r.object_type]) stats[r.object_type] = {};
    stats[r.object_type][r.state] = r.count;
  }
  return stats;
}

function mapObjectRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id,
    objectType: row.object_type,
    objectId: row.object_id,
    state: row.state,
    payload: JSON.parse(row.payload_json || "{}"),
    version: row.version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEventRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id,
    objectId: row.object_id,
    eventType: row.event_type,
    payload: JSON.parse(row.payload_json || "{}"),
    actorUserId: row.actor_user_id,
    version: row.version,
    createdAt: row.created_at,
  };
}
