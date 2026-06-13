/**
 * P18-B: Data Classification Labels
 * CRUD for classification labels + room/message classification assignment.
 */

const LEVELHierarchy = [0, 1, 2, 3];

function generateId() {
  return `dcl_${crypto.randomUUID().slice(0, 12)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function mapLabelRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    level: row.level ?? 0,
    color: row.color ?? null,
    description: row.description ?? null,
    createdAt: row.created_at,
  };
}

function mapRoomClassificationRow(row) {
  return {
    roomId: row.room_id,
    projectId: row.project_id,
    labelId: row.label_id,
    classifiedBy: row.classified_by,
    classifiedAt: row.classified_at,
  };
}

function mapMessageClassificationRow(row) {
  return {
    messageId: row.message_id,
    projectId: row.project_id,
    labelId: row.label_id,
    classifiedBy: row.classified_by,
    classifiedAt: row.classified_at,
  };
}

/**
 * List all classification labels for a project.
 */
export async function listLabels(env, { projectId }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM data_classification_labels WHERE project_id = ? ORDER BY level ASC, created_at ASC`
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapLabelRow);
}

/**
 * Create a new classification label.
 */
export async function createLabel(env, { projectId, name, level, color, description }) {
  const id = generateId();
  const now = nowIso();
  const lvl = LEVELHierarchy.includes(level) ? level : 0;

  await env.DB.prepare(
    `INSERT INTO data_classification_labels (id, project_id, name, level, color, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, projectId, name, lvl, color || null, description || null, now)
    .run();

  return { id, projectId, name, level: lvl, color: color || null, description: description || null, createdAt: now };
}

/**
 * Update an existing classification label.
 */
export async function updateLabel(env, { projectId, labelId, name, level, color, description }) {
  const existing = await getLabelById(env, { projectId, labelId });
  if (!existing) return null;

  const now = nowIso();
  const lvl = level !== undefined ? (LEVELHierarchy.includes(level) ? level : existing.level) : existing.level;

  await env.DB.prepare(
    `UPDATE data_classification_labels SET name = ?, level = ?, color = ?, description = ? WHERE id = ? AND project_id = ?`
  )
    .bind(
      name ?? existing.name,
      lvl,
      color !== undefined ? color : existing.color,
      description !== undefined ? description : existing.description,
      labelId,
      projectId,
    )
    .run();

  return getLabelById(env, { projectId, labelId });
}

/**
 * Delete a classification label.
 */
export async function deleteLabel(env, { projectId, labelId }) {
  const result = await env.DB.prepare(
    `DELETE FROM data_classification_labels WHERE id = ? AND project_id = ?`
  )
    .bind(labelId, projectId)
    .run();
  if (!result.meta?.changes) return { ok: false, error: "not_found" };
  return { ok: true };
}

/**
 * Get a label by ID.
 */
export async function getLabelById(env, { projectId, labelId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM data_classification_labels WHERE id = ? AND project_id = ?`
  )
    .bind(labelId, projectId)
    .first();
  return row ? mapLabelRow(row) : null;
}

/**
 * Get all labels filtered by classification level.
 */
export async function getLabelsByLevel(env, { projectId, level }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM data_classification_labels WHERE project_id = ? AND level = ? ORDER BY created_at ASC`
  )
    .bind(projectId, level)
    .all();
  return (rows.results || []).map(mapLabelRow);
}

/**
 * Classify a room with a specific label.
 */
export async function classifyRoom(env, { projectId, roomId, labelId, classifiedBy }) {
  const label = await getLabelById(env, { projectId, labelId });
  if (!label) return { ok: false, error: "label_not_found" };

  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO room_classifications (room_id, project_id, label_id, classified_by, classified_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(room_id) DO UPDATE SET label_id = ?, classified_by = ?, classified_at = ?`
  )
    .bind(roomId, projectId, labelId, classifiedBy, now, labelId, classifiedBy, now)
    .run();

  return { roomId, projectId, labelId, classifiedBy, classifiedAt: now };
}

/**
 * Get the current classification for a room.
 */
export async function getRoomClassification(env, { projectId, roomId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM room_classifications WHERE room_id = ? AND project_id = ?`
  )
    .bind(roomId, projectId)
    .first();
  return row ? mapRoomClassificationRow(row) : null;
}

/**
 * Classify an individual message with a label.
 */
export async function classifyMessage(env, { projectId, messageId, labelId, classifiedBy }) {
  const label = await getLabelById(env, { projectId, labelId });
  if (!label) return { ok: false, error: "label_not_found" };

  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO message_classifications (message_id, project_id, label_id, classified_by, classified_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(message_id, label_id) DO UPDATE SET classified_by = ?, classified_at = ?`
  )
    .bind(messageId, projectId, labelId, classifiedBy, now, classifiedBy, now)
    .run();

  return { messageId, projectId, labelId, classifiedBy, classifiedAt: now };
}

/**
 * Get all classification overrides for a message.
 */
export async function getMessageClassifications(env, { projectId, messageId }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM message_classifications WHERE message_id = ? AND project_id = ?`
  )
    .bind(messageId, projectId)
    .all();
  return (rows.results || []).map(mapMessageClassificationRow);
}
