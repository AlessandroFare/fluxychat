/**
 * P18-C: Retention Policies + Legal Hold + Export Snapshots
 * Manages data retention, legal holds, and compliance export snapshots.
 */

function generateId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
}

function nowIso() {
  return new Date().toISOString();
}

/* ── Retention Policies ── */

function mapRetentionPolicyRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    roomId: row.room_id ?? null,
    retentionDays: row.retention_days ?? 365,
    autoDelete: row.auto_delete === 1,
    requireApproval: row.require_approval === 1,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * List all retention policies for a project.
 */
export async function listRetentionPolicies(env, { projectId }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM retention_policies WHERE project_id = ? ORDER BY created_at DESC`
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapRetentionPolicyRow);
}

/**
 * Create a new retention policy.
 */
export async function createRetentionPolicy(env, { projectId, name, roomId, retentionDays, autoDelete, requireApproval }) {
  const id = generateId("ret");
  const now = nowIso();
  const days = Math.max(1, Math.floor(Number(retentionDays) || 365));

  await env.DB.prepare(
    `INSERT INTO retention_policies (id, project_id, name, room_id, retention_days, auto_delete, require_approval, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  )
    .bind(id, projectId, name, roomId || null, days, autoDelete ? 1 : 0, requireApproval ? 1 : 0, now, now)
    .run();

  return {
    id, projectId, name, roomId: roomId || null, retentionDays: days,
    autoDelete: !!autoDelete, requireApproval: !!requireApproval, enabled: true,
    createdAt: now, updatedAt: now,
  };
}

/**
 * Update an existing retention policy.
 */
export async function updateRetentionPolicy(env, { projectId, policyId, name, roomId, retentionDays, autoDelete, requireApproval, enabled }) {
  const existing = await getRetentionPolicy(env, { projectId, policyId });
  if (!existing) return null;

  const now = nowIso();
  await env.DB.prepare(
    `UPDATE retention_policies SET name = ?, room_id = ?, retention_days = ?, auto_delete = ?, require_approval = ?, enabled = ?, updated_at = ?
     WHERE id = ? AND project_id = ?`
  )
    .bind(
      name ?? existing.name,
      roomId !== undefined ? roomId : existing.roomId,
      retentionDays !== undefined ? Math.max(1, Math.floor(Number(retentionDays) || existing.retentionDays)) : existing.retentionDays,
      autoDelete !== undefined ? (autoDelete ? 1 : 0) : (existing.autoDelete ? 1 : 0),
      requireApproval !== undefined ? (requireApproval ? 1 : 0) : (existing.requireApproval ? 1 : 0),
      enabled !== undefined ? (enabled ? 1 : 0) : (existing.enabled ? 1 : 0),
      now,
      policyId,
      projectId,
    )
    .run();

  return getRetentionPolicy(env, { projectId, policyId });
}

/**
 * Delete a retention policy.
 */
export async function deleteRetentionPolicy(env, { projectId, policyId }) {
  const result = await env.DB.prepare(
    `DELETE FROM retention_policies WHERE id = ? AND project_id = ?`
  )
    .bind(policyId, projectId)
    .run();
  if (!result.meta?.changes) return { ok: false, error: "not_found" };
  return { ok: true };
}

/**
 * Get a single retention policy by ID.
 */
export async function getRetentionPolicy(env, { projectId, policyId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM retention_policies WHERE id = ? AND project_id = ?`
  )
    .bind(policyId, projectId)
    .first();
  return row ? mapRetentionPolicyRow(row) : null;
}

/* ── Legal Holds ── */

function mapLegalHoldRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id ?? null,
    reason: row.reason,
    placedBy: row.placed_by,
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at,
    releasedAt: row.released_at ?? null,
  };
}

/**
 * Create a legal hold on a room (or project-wide if roomId is null).
 */
export async function createLegalHold(env, { projectId, roomId, reason, placedBy, expiresAt }) {
  const id = generateId("hold");
  const now = nowIso();

  await env.DB.prepare(
    `INSERT INTO legal_holds (id, project_id, room_id, reason, placed_by, expires_at, created_at, released_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`
  )
    .bind(id, projectId, roomId || null, reason, placedBy, expiresAt || null, now)
    .run();

  return { id, projectId, roomId: roomId || null, reason, placedBy, expiresAt: expiresAt || null, createdAt: now, releasedAt: null };
}

/**
 * Release (expire) a legal hold.
 */
export async function releaseLegalHold(env, { projectId, holdId }) {
  const existing = await getLegalHold(env, { projectId, holdId });
  if (!existing) return { ok: false, error: "not_found" };
  if (existing.releasedAt) return { ok: false, error: "already_released" };

  const now = nowIso();
  await env.DB.prepare(
    `UPDATE legal_holds SET released_at = ? WHERE id = ? AND project_id = ?`
  )
    .bind(now, holdId, projectId)
    .run();

  return { ok: true, releasedAt: now };
}

/**
 * Get all active (unreleased) legal holds for a room.
 */
export async function getActiveHoldsForRoom(env, { projectId, roomId }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM legal_holds WHERE project_id = ? AND room_id = ? AND released_at IS NULL
     ORDER BY created_at DESC`
  )
    .bind(projectId, roomId)
    .all();
  return (rows.results || []).map(mapLegalHoldRow);
}

/**
 * List active legal holds for a project (optional room filter).
 */
export async function listActiveLegalHolds(env, { projectId, roomId }) {
  let sql = `SELECT * FROM legal_holds WHERE project_id = ? AND released_at IS NULL`;
  const params = [projectId];
  if (roomId) {
    sql += ` AND room_id = ?`;
    params.push(roomId);
  }
  sql += ` ORDER BY created_at DESC LIMIT 100`;
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapLegalHoldRow);
}

/**
 * Check if a room is currently on legal hold.
 */
export async function isRoomOnHold(env, { projectId, roomId }) {
  const holds = await getActiveHoldsForRoom(env, { projectId, roomId });
  return holds.length > 0;
}

/**
 * Get a single legal hold by ID.
 */
async function getLegalHold(env, { projectId, holdId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM legal_holds WHERE id = ? AND project_id = ?`
  )
    .bind(holdId, projectId)
    .first();
  return row ? mapLegalHoldRow(row) : null;
}

/**
 * Check whether a message is protected from deletion (legal hold).
 */
export async function isMessageProtected(env, { projectId, roomId }) {
  return isRoomOnHold(env, { projectId, roomId });
}

/* ── Export Snapshots ── */

function mapExportSnapshotRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id ?? null,
    format: row.format ?? "json",
    filterJson: tryParse(row.filter_json),
    filePath: row.file_path ?? null,
    messageCount: row.message_count ?? 0,
    requestedBy: row.requested_by,
    status: row.status ?? "pending",
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
  };
}

/**
 * Create a new export snapshot.
 */
export async function createExportSnapshot(env, { projectId, roomId, format, filterJson, requestedBy }) {
  const id = generateId("snap");
  const now = nowIso();
  const fmt = ["json", "csv", "pdf"].includes(format) ? format : "json";

  await env.DB.prepare(
    `INSERT INTO export_snapshots (id, project_id, room_id, format, filter_json, message_count, requested_by, status, created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, 'pending', ?, NULL)`
  )
    .bind(id, projectId, roomId || null, fmt, JSON.stringify(filterJson || {}), requestedBy, now)
    .run();

  return {
    id, projectId, roomId: roomId || null, format: fmt,
    filterJson: filterJson || {}, filePath: null, messageCount: 0,
    requestedBy, status: "pending", createdAt: now, completedAt: null,
  };
}

/**
 * Update the status of an export snapshot.
 */
export async function updateExportSnapshotStatus(env, { projectId, snapshotId, status, filePath, messageCount }) {
  const now = nowIso();
  const result = await env.DB.prepare(
    `UPDATE export_snapshots SET status = ?, file_path = ?, message_count = ?, completed_at = ?
     WHERE id = ? AND project_id = ?`
  )
    .bind(status, filePath || null, messageCount || 0, now, snapshotId, projectId)
    .run();
  if (!result.meta?.changes) return null;

  return listExportSnapshots(env, { projectId, snapshotId });
}

/**
 * List export snapshots, optionally filtered by ID.
 */
export async function listExportSnapshots(env, { projectId, snapshotId }) {
  if (snapshotId) {
    const row = await env.DB.prepare(
      `SELECT * FROM export_snapshots WHERE id = ? AND project_id = ?`
    )
      .bind(snapshotId, projectId)
      .first();
    return row ? mapExportSnapshotRow(row) : null;
  }

  const rows = await env.DB.prepare(
    `SELECT * FROM export_snapshots WHERE project_id = ? ORDER BY created_at DESC`
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapExportSnapshotRow);
}

function tryParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}
