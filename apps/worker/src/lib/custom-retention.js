function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createRetentionPolicy(env, { projectId, name, dataType, roomId, retentionDays, autoPurge, archiveBeforeDelete, requireApproval }) {
  if (!name || !dataType) return { error: "name and dataType are required" };
  const validTypes = ["messages", "events", "audit_logs", "presences", "files", "notifications", "threads", "reactions"];
  if (!validTypes.includes(dataType)) return { error: `dataType must be one of: ${validTypes.join(", ")}` };
  if (retentionDays !== undefined && (retentionDays < 1 || retentionDays > 3650)) return { error: "retentionDays must be 1-3650" };

  const id = `crp_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  const days = retentionDays || 90;
  const nextPurge = new Date(Date.now() + days * 86400000).toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO custom_retention_policies
       (id, project_id, name, data_type, room_id, retention_days, auto_purge, archive_before_delete, require_approval, enabled, next_purge_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
    )
      .bind(id, projectId, name, dataType, roomId || null, days, autoPurge ? 1 : 0, archiveBeforeDelete ? 1 : 0, requireApproval ? 1 : 0, nextPurge, now, now)
      .run();
    return { id, created: true };
  } catch (err) {
    if (err.message?.includes("UNIQUE")) return { error: "policy_already_exists_for_type_and_room" };
    throw err;
  }
}

export async function updateRetentionPolicy(env, { id, projectId, name, retentionDays, autoPurge, archiveBeforeDelete, requireApproval, enabled }) {
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const params = [now];

  if (name !== undefined) { sets.push("name = ?"); params.push(name); }
  if (retentionDays !== undefined) { sets.push("retention_days = ?"); params.push(retentionDays); }
  if (autoPurge !== undefined) { sets.push("auto_purge = ?"); params.push(autoPurge ? 1 : 0); }
  if (archiveBeforeDelete !== undefined) { sets.push("archive_before_delete = ?"); params.push(archiveBeforeDelete ? 1 : 0); }
  if (requireApproval !== undefined) { sets.push("require_approval = ?"); params.push(requireApproval ? 1 : 0); }
  if (enabled !== undefined) { sets.push("enabled = ?"); params.push(enabled ? 1 : 0); }

  params.push(id, projectId);
  const result = await env.DB.prepare(
    `UPDATE custom_retention_policies SET ${sets.join(", ")} WHERE id = ? AND project_id = ?`
  )
    .bind(...params)
    .run();
  return { updated: result.meta?.changes || 0 };
}

export async function deleteRetentionPolicy(env, { id, projectId }) {
  const result = await env.DB.prepare(
    "DELETE FROM custom_retention_policies WHERE id = ? AND project_id = ?"
  )
    .bind(id, projectId)
    .run();
  return { deleted: result.meta?.changes || 0 };
}

export async function listRetentionPolicies(env, { projectId, dataType, roomId }) {
  let sql = "SELECT * FROM custom_retention_policies WHERE project_id = ?";
  const params = [projectId];
  if (dataType) { sql += " AND data_type = ?"; params.push(dataType); }
  if (roomId) { sql += " AND room_id = ?"; params.push(roomId); }
  sql += " ORDER BY created_at DESC";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapPolicyRow);
}

export async function getRetentionPolicy(env, { id, projectId }) {
  const row = await env.DB.prepare(
    "SELECT * FROM custom_retention_policies WHERE id = ? AND project_id = ?"
  )
    .bind(id, projectId)
    .first();
  return row ? mapPolicyRow(row) : null;
}

export async function getEffectiveRetention(env, { projectId, dataType, roomId }) {
  // Room-specific policy takes precedence, then project-wide for data type
  if (roomId) {
    const roomPolicy = await env.DB.prepare(
      "SELECT * FROM custom_retention_policies WHERE project_id = ? AND data_type = ? AND room_id = ? AND enabled = 1"
    )
      .bind(projectId, dataType, roomId)
      .first();
    if (roomPolicy) return mapPolicyRow(roomPolicy);
  }

  const globalPolicy = await env.DB.prepare(
    "SELECT * FROM custom_retention_policies WHERE project_id = ? AND data_type = ? AND room_id IS NULL AND enabled = 1"
  )
    .bind(projectId, dataType)
    .first();
  return globalPolicy ? mapPolicyRow(globalPolicy) : null;
}

export async function getPurgeCandidates(env, { projectId }) {
  const now = new Date().toISOString();
  const rows = await env.DB.prepare(
    "SELECT * FROM custom_retention_policies WHERE project_id = ? AND enabled = 1 AND auto_purge = 1 AND next_purge_at <= ?"
  )
    .bind(projectId, now)
    .all();
  return (rows.results || []).map(mapPolicyRow);
}

export async function recordPurge(env, { policyId, projectId, dataType, roomId, deletedCount, archivedCount, status, error }) {
  const id = `prg_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO retention_purge_log (id, policy_id, project_id, data_type, room_id, deleted_count, archived_count, status, error, started_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, policyId, projectId, dataType, roomId || null, deletedCount || 0, archivedCount || 0, status || "completed", error || null, now, now)
    .run();

  await env.DB.prepare(
    "UPDATE custom_retention_policies SET last_purged_at = ?, next_purge_at = DATE(?, '+' || retention_days || ' days') WHERE id = ?"
  )
    .bind(now, now, policyId)
    .run();

  return { id };
}

export async function getPurgeLogs(env, { projectId, limit }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM retention_purge_log WHERE project_id = ? ORDER BY started_at DESC LIMIT ?"
  )
    .bind(projectId, limit || 50)
    .all();
  return (rows.results || []).map(mapLogRow);
}

export async function getRetentionStats(env, { projectId }) {
  const policies = await env.DB.prepare(
    "SELECT data_type, COUNT(*) as count, SUM(retention_days) as total_days FROM custom_retention_policies WHERE project_id = ? GROUP BY data_type"
  )
    .bind(projectId)
    .all();

  const purges = await env.DB.prepare(
    "SELECT data_type, SUM(deleted_count) as total_deleted, SUM(archived_count) as total_archived, COUNT(*) as purge_count FROM retention_purge_log WHERE project_id = ? GROUP BY data_type"
  )
    .bind(projectId)
    .all();

  const byType = {};
  for (const p of policies.results || []) {
    byType[p.data_type] = { policies: p.count, avgRetentionDays: Math.round(p.total_days / p.count) };
  }
  for (const p of purges.results || []) {
    if (!byType[p.data_type]) byType[p.data_type] = {};
    byType[p.data_type].totalDeleted = p.total_deleted;
    byType[p.data_type].totalArchived = p.total_archived;
    byType[p.data_type].purgeRuns = p.purge_count;
  }

  return { byType, totalPolicies: (policies.results || []).reduce((s, p) => s + p.count, 0) };
}

function mapPolicyRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    dataType: row.data_type,
    roomId: row.room_id,
    retentionDays: row.retention_days,
    autoPurge: row.auto_purge === 1,
    archiveBeforeDelete: row.archive_before_delete === 1,
    requireApproval: row.require_approval === 1,
    enabled: row.enabled === 1,
    lastPurgedAt: row.last_purged_at,
    nextPurgeAt: row.next_purge_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLogRow(row) {
  return {
    id: row.id,
    policyId: row.policy_id,
    projectId: row.project_id,
    dataType: row.data_type,
    roomId: row.room_id,
    deletedCount: row.deleted_count,
    archivedCount: row.archived_count,
    status: row.status,
    error: row.error,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}
