/**
 * P18-F: Time-Stamped Compliance Export
 * Export messages, audit events, and classification data with cryptographic
 * SHA-256 timestamp proof. Supports JSON and CSV formats.
 * Immutable snapshots stored in export_snapshots for audit trail.
 */

function generateId() {
  return `exp_${crypto.randomUUID().slice(0, 12)}`;
}

function nowIso() {
  return new Date().toISOString();
}

/* ── Cryptographic Hashing ── */

/**
 * Compute SHA-256 hash of export content for integrity verification.
 */
export async function computeExportHash(data) {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ── Format Conversion ── */

/**
 * Convert array of objects to CSV string.
 */
export function toCsv(rows, columns) {
  if (!rows || rows.length === 0) return "";
  const cols = columns || Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const header = cols.map(escape).join(",");
  const body = rows.map((row) => cols.map((c) => escape(row[c])).join(",")).join("\n");
  return header + "\n" + body;
}

/**
 * Format export data into requested format (json, csv).
 */
export function formatExport(data, format) {
  if (format === "csv") {
    return toCsv(data);
  }
  return JSON.stringify(data, null, 2);
}

/* ── Export Snapshots CRUD ── */

/**
 * Create an export snapshot record.
 */
export async function createExportRequest(env, { projectId, roomId, format, filter, requestedBy }) {
  const id = generateId();
  const now = nowIso();
  const fmt = ["json", "csv", "pdf"].includes(format) ? format : "json";
  const filterJson = JSON.stringify(filter || {});

  await env.DB.prepare(
    `INSERT INTO export_snapshots (id, project_id, room_id, format, filter_json, message_count, requested_by, status, created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, 'pending', ?, NULL)`
  )
    .bind(id, projectId, roomId || null, fmt, filterJson, requestedBy, now)
    .run();

  return { id, projectId, roomId: roomId || null, format: fmt, filter: filter || {}, requestedBy, status: "pending", createdAt: now };
}

/**
 * Update snapshot status after export completes.
 */
export async function completeExport(env, { projectId, snapshotId, messageCount, hash, status }) {
  const now = nowIso();
  await env.DB.prepare(
    `UPDATE export_snapshots SET status = ?, message_count = ?, completed_at = ?
     WHERE id = ? AND project_id = ?`
  )
    .bind(status || "completed", messageCount || 0, now, snapshotId, projectId)
    .run();

  return { snapshotId, status: status || "completed", messageCount: messageCount || 0, completedAt: now, hash };
}

/**
 * Get export snapshot by ID.
 */
export async function getExportSnapshot(env, { projectId, snapshotId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM export_snapshots WHERE id = ? AND project_id = ?`
  )
    .bind(snapshotId, projectId)
    .first();
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id ?? null,
    format: row.format,
    filter: tryParse(row.filter_json),
    filePath: row.file_path ?? null,
    messageCount: row.message_count ?? 0,
    requestedBy: row.requested_by,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
  };
}

/**
 * List export snapshots for a project.
 */
export async function listExportRequests(env, { projectId, limit = 20 }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM export_snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`
  )
    .bind(projectId, limit)
    .all();
  return (rows.results || []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id ?? null,
    format: row.format,
    filter: tryParse(row.filter_json),
    messageCount: row.message_count ?? 0,
    requestedBy: row.requested_by,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
  }));
}

/* ── Data Querying ── */

/**
 * Query messages with time-range and filters.
 */
export async function queryMessages(env, { projectId, roomId, userId, startTime, endTime, labelId, limit = 5000 }) {
  let sql = `SELECT id, user_id, content, created_at, parent_id, deleted_at, expires_at, visibility
             FROM messages WHERE project_id = ?`;
  const binds = [projectId];

  if (roomId) {
    sql += ` AND room_id = ?`;
    binds.push(roomId);
  }
  if (userId) {
    sql += ` AND user_id = ?`;
    binds.push(userId);
  }
  if (startTime) {
    sql += ` AND created_at >= ?`;
    binds.push(startTime);
  }
  if (endTime) {
    sql += ` AND created_at <= ?`;
    binds.push(endTime);
  }
  if (labelId) {
    sql += ` AND id IN (SELECT message_id FROM message_classifications WHERE project_id = ? AND label_id = ?)`;
    binds.push(projectId, labelId);
  }

  sql += ` ORDER BY created_at ASC LIMIT ?`;
  binds.push(Math.min(limit, 10000));

  const rows = await env.DB.prepare(sql).bind(...binds).all();
  return (rows.results || []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    content: r.content,
    createdAt: r.created_at,
    parentId: r.parent_id ?? null,
    deletedAt: r.deleted_at ?? null,
    expiresAt: r.expires_at ?? null,
    visibility: r.visibility ?? null,
  }));
}

/**
 * Query read receipts for a room.
 */
export async function queryReadReceipts(env, { projectId, roomId, startTime, endTime, limit = 5000 }) {
  let sql = `SELECT user_id, message_id, created_at FROM read_receipts WHERE project_id = ? AND room_id = ?`;
  const binds = [projectId, roomId];

  if (startTime) {
    sql += ` AND created_at >= ?`;
    binds.push(startTime);
  }
  if (endTime) {
    sql += ` AND created_at <= ?`;
    binds.push(endTime);
  }
  sql += ` ORDER BY created_at ASC LIMIT ?`;
  binds.push(Math.min(limit, 10000));

  const rows = await env.DB.prepare(sql).bind(...binds).all();
  return (rows.results || []).map((r) => ({
    userId: r.user_id,
    messageId: r.message_id,
    createdAt: r.created_at,
  }));
}

/**
 * Query audit events.
 */
export async function queryAuditEvents(env, { projectId, roomId, startTime, endTime, limit = 5000 }) {
  let sql = `SELECT action, actor_user_id, target_type, target_id, created_at, metadata
             FROM operational_audit_events WHERE project_id = ?`;
  const binds = [projectId];

  if (roomId) {
    sql += ` AND (target_id = ? OR metadata LIKE ?)`;
    binds.push(roomId, `%${roomId}%`);
  }
  if (startTime) {
    sql += ` AND created_at >= ?`;
    binds.push(startTime);
  }
  if (endTime) {
    sql += ` AND created_at <= ?`;
    binds.push(endTime);
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  binds.push(Math.min(limit, 10000));

  const rows = await env.DB.prepare(sql).bind(...binds).all();
  return (rows.results || []).map((r) => ({
    action: r.action,
    actorUserId: r.actor_user_id,
    targetType: r.target_type,
    targetId: r.target_id,
    createdAt: r.created_at,
    metadata: tryParse(r.metadata),
  }));
}

/**
 * Query moderation events.
 */
export async function queryModerationEvents(env, { projectId, roomId, startTime, endTime, limit = 2000 }) {
  let sql = `SELECT user_id, action, reason, created_at FROM moderation_events WHERE project_id = ? AND room_id = ?`;
  const binds = [projectId, roomId];

  if (startTime) {
    sql += ` AND created_at >= ?`;
    binds.push(startTime);
  }
  if (endTime) {
    sql += ` AND created_at <= ?`;
    binds.push(endTime);
  }
  sql += ` ORDER BY created_at ASC LIMIT ?`;
  binds.push(Math.min(limit, 10000));

  const rows = await env.DB.prepare(sql).bind(...binds).all();
  return (rows.results || []).map((r) => ({
    userId: r.user_id,
    action: r.action,
    reason: r.reason,
    createdAt: r.created_at,
  }));
}

/* ── Full Export ── */

/**
 * Execute a full compliance export: query data, create snapshot, compute hash.
 */
export async function executeExport(env, { projectId, roomId, userId, startTime, endTime, labelId, format, requestedBy }) {
  const snapshot = await createExportRequest(env, { projectId, roomId, format, filter: { userId, startTime, endTime, labelId }, requestedBy });

  const [messages, receipts, auditEvents, moderationEvents] = await Promise.all([
    queryMessages(env, { projectId, roomId, userId, startTime, endTime, labelId }),
    roomId ? queryReadReceipts(env, { projectId, roomId, startTime, endTime }) : Promise.resolve([]),
    queryAuditEvents(env, { projectId, roomId, startTime, endTime }),
    roomId ? queryModerationEvents(env, { projectId, roomId, startTime, endTime }) : Promise.resolve([]),
  ]);

  const exportData = {
    exportedAt: nowIso(),
    snapshotId: snapshot.id,
    projectId,
    roomId: roomId || null,
    filter: { userId, startTime, endTime, labelId },
    counts: {
      messages: messages.length,
      readReceipts: receipts.length,
      auditEvents: auditEvents.length,
      moderationEvents: moderationEvents.length,
    },
    messages,
    readReceipts: receipts,
    auditEvents,
    moderationEvents,
  };

  const hash = await computeExportHash(exportData);
  exportData.integrityHash = hash;

  const formatted = format === "csv"
    ? toCsv(messages, ["id", "userId", "content", "createdAt", "parentId", "deletedAt", "expiresAt", "visibility"])
    : formatExport(exportData, format);

  await completeExport(env, {
    projectId,
    snapshotId: snapshot.id,
    messageCount: messages.length,
    hash,
    status: "completed",
  });

  return { snapshot, data: formatted, hash, exportData };
}

function tryParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}
