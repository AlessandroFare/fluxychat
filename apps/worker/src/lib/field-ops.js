/**
 * P20-I: Store / Field Ops Mode — mobile-first operations for physical teams.
 *
 * Features:
 *   • Field ops templates (checklist, inspection, safety, shift handoff)
 *   • Photo capture support
 *   • Status updates
 *   • Safety alerts
 *   • Offline queue for syncing
 *   • Shift handoff tracking
 */

const TEMPLATE_TYPES = ["checklist", "inspection", "safety", "shift_handoff", "custom"];

export async function createTemplate(env, {
  projectId, name, description, templateType, fields, safetyAlerts, photoRequired, offlineQueue,
}) {
  if (!TEMPLATE_TYPES.includes(templateType || "checklist")) throw new Error(`Invalid template type: ${templateType}`);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO field_ops_templates (id, project_id, name, description, template_type,
     fields, safety_alerts, photo_required, offline_queue)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, name, description || null, templateType || "checklist",
    JSON.stringify(fields || []), safetyAlerts ? 1 : 0,
    photoRequired ? 1 : 0, offlineQueue !== false ? 1 : 0).run();
  return { id, name, templateType: templateType || "checklist" };
}

export async function getTemplate(env, { projectId, templateId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM field_ops_templates WHERE project_id = ? AND id = ?`
  ).bind(projectId, templateId).first();
  return row ? formatTemplate(row) : null;
}

export async function listTemplates(env, { projectId }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM field_ops_templates WHERE project_id = ? AND enabled = 1 ORDER BY name`
  ).bind(projectId).all();
  return results.map(formatTemplate);
}

export async function deleteTemplate(env, { projectId, templateId }) {
  const info = await env.DB.prepare(
    `DELETE FROM field_ops_templates WHERE project_id = ? AND id = ?`
  ).bind(projectId, templateId).run();
  return info.meta?.changes > 0;
}

/* ═══ Updates ═══ */

export async function submitUpdate(env, {
  projectId, templateId, roomId, userId, updateType, content, photoUrl, metadata,
}) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO field_ops_updates (id, template_id, project_id, room_id, user_id,
     update_type, content, photo_url, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, templateId || null, projectId, roomId, userId,
    updateType || "status", content, photoUrl || null,
    JSON.stringify(metadata || {})).run();
  return { id, updateType: updateType || "status", synced: true };
}

export async function listUpdates(env, { projectId, roomId, updateType, limit = 50 }) {
  let query = `SELECT * FROM field_ops_updates WHERE project_id = ?`;
  const params = [projectId];
  if (roomId) { query += ` AND room_id = ?`; params.push(roomId); }
  if (updateType) { query += ` AND update_type = ?`; params.push(updateType); }
  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatUpdate);
}

export async function getUnsyncedUpdates(env, { projectId }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM field_ops_updates WHERE project_id = ? AND synced = 0
     ORDER BY created_at ASC`
  ).bind(projectId).all();
  return results.map(formatUpdate);
}

export async function markSynced(env, { projectId, updateId }) {
  const info = await env.DB.prepare(
    `UPDATE field_ops_updates SET synced = 1 WHERE project_id = ? AND id = ?`
  ).bind(projectId, updateId).run();
  return info.meta?.changes > 0;
}

function formatTemplate(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name,
    description: row.description, templateType: row.template_type,
    fields: JSON.parse(row.fields || "[]"), safetyAlerts: row.safety_alerts === 1,
    photoRequired: row.photo_required === 1, offlineQueue: row.offline_queue === 1,
    enabled: row.enabled === 1, createdAt: row.created_at,
  };
}

function formatUpdate(row) {
  return {
    id: row.id, templateId: row.template_id, projectId: row.project_id,
    roomId: row.room_id, userId: row.user_id, updateType: row.update_type,
    content: row.content, photoUrl: row.photo_url,
    metadata: JSON.parse(row.metadata || "{}"), synced: row.synced === 1,
    createdAt: row.created_at,
  };
}

