/**
 * D1-backed long-horizon autonomous agent tasks (A2A / Agent Steward pattern).
 */

const VALID_STATUSES = new Set([
  "submitted",
  "working",
  "input-required",
  "completed",
  "failed",
  "cancelled",
]);

function rowToTask(row) {
  let artifacts = [];
  let metadata = undefined;
  try {
    artifacts = JSON.parse(row.artifacts_json || "[]");
  } catch {
    artifacts = [];
  }
  try {
    metadata = row.metadata_json ? JSON.parse(row.metadata_json) : undefined;
  } catch {
    metadata = undefined;
  }
  return {
    id: row.id,
    roomId: row.room_id,
    projectId: row.project_id,
    fromAgentId: row.from_agent_id,
    toAgentId: row.to_agent_id,
    status: row.status,
    input: row.input,
    idempotencyKey: row.idempotency_key,
    offset: Number(row.task_offset ?? 0),
    depth: Number(row.depth ?? 0),
    parentTaskId: row.parent_task_id || undefined,
    artifacts,
    metadata,
    error: row.error || undefined,
    resumeAt: row.resume_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * @param {*} env
 * @param {object} input
 * @param {object} auth
 */
export async function submitAutonomousTask(env, input, auth) {
  const {
    roomId,
    fromAgentId,
    toAgentId,
    taskInput,
    idempotencyKey,
    depth = 0,
    parentTaskId,
    metadata,
    resumeAt,
  } = input;

  if (!roomId?.trim()) return { ok: false, error: "room_id_required" };
  if (!fromAgentId?.trim() || !toAgentId?.trim()) return { ok: false, error: "agent_ids_required" };
  if (!taskInput?.trim()) return { ok: false, error: "input_required" };
  if (!idempotencyKey?.trim()) return { ok: false, error: "idempotency_key_required" };

  const existing = await env.DB.prepare(
    `SELECT * FROM agent_autonomous_tasks WHERE project_id = ? AND idempotency_key = ? LIMIT 1`,
  )
    .bind(auth.projectId, idempotencyKey.trim())
    .first();
  if (existing) {
    return { ok: true, task: rowToTask(existing), deduplicated: true };
  }

  const now = new Date().toISOString();
  const id = `atask_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

  await env.DB.prepare(
    `INSERT INTO agent_autonomous_tasks
     (id, project_id, room_id, from_agent_id, to_agent_id, status, input, idempotency_key,
      task_offset, depth, parent_task_id, artifacts_json, metadata_json, resume_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'submitted', ?, ?, 0, ?, ?, '[]', ?, ?, ?, ?)`,
  )
    .bind(
      id,
      auth.projectId,
      roomId.trim(),
      fromAgentId.trim(),
      toAgentId.trim(),
      String(taskInput).slice(0, 16_384),
      idempotencyKey.trim(),
      Math.max(0, Number(depth) || 0),
      parentTaskId || null,
      metadata ? JSON.stringify(metadata) : null,
      resumeAt || null,
      now,
      now,
    )
    .run();

  const row = await env.DB.prepare(`SELECT * FROM agent_autonomous_tasks WHERE id = ?`).bind(id).first();
  return { ok: true, task: rowToTask(row), deduplicated: false };
}

/**
 * @param {*} env
 * @param {object} input
 * @param {object} auth
 */
export async function updateAutonomousTask(env, input, auth) {
  const { taskId, status, artifact, error, resumeAt } = input;
  if (!taskId?.trim()) return { ok: false, error: "task_id_required" };
  if (!VALID_STATUSES.has(status)) return { ok: false, error: "invalid_status" };

  const row = await env.DB.prepare(
    `SELECT * FROM agent_autonomous_tasks WHERE id = ? AND project_id = ? LIMIT 1`,
  )
    .bind(taskId.trim(), auth.projectId)
    .first();
  if (!row) return { ok: false, error: "not_found" };

  let artifacts = [];
  try {
    artifacts = JSON.parse(row.artifacts_json || "[]");
  } catch {
    artifacts = [];
  }
  if (artifact) {
    artifacts.push({
      ...artifact,
      createdAt: artifact.createdAt || new Date().toISOString(),
    });
  }

  const now = new Date().toISOString();
  const nextOffset = Number(row.task_offset ?? 0) + 1;

  await env.DB.prepare(
    `UPDATE agent_autonomous_tasks
     SET status = ?, artifacts_json = ?, error = ?, resume_at = ?, task_offset = ?, updated_at = ?
     WHERE id = ? AND project_id = ?`,
  )
    .bind(
      status,
      JSON.stringify(artifacts),
      error ? String(error).slice(0, 2000) : null,
      resumeAt || null,
      nextOffset,
      now,
      taskId.trim(),
      auth.projectId,
    )
    .run();

  const updated = await env.DB.prepare(`SELECT * FROM agent_autonomous_tasks WHERE id = ?`).bind(taskId.trim()).first();
  return { ok: true, task: rowToTask(updated) };
}

/**
 * @param {*} env
 * @param {{ projectId: string, roomId?: string, status?: string, toAgentId?: string, limit?: number }} input
 */
export async function listAutonomousTasks(env, input) {
  const limit = Math.min(Math.max(1, Number(input.limit) || 50), 200);
  let sql = `SELECT * FROM agent_autonomous_tasks WHERE project_id = ?`;
  const params = [input.projectId];

  if (input.roomId) {
    sql += ` AND room_id = ?`;
    params.push(input.roomId);
  }
  if (input.status) {
    sql += ` AND status = ?`;
    params.push(input.status);
  }
  if (input.toAgentId) {
    sql += ` AND to_agent_id = ?`;
    params.push(input.toAgentId);
  }
  sql += ` ORDER BY updated_at DESC LIMIT ?`;
  params.push(limit);

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return { ok: true, tasks: (results || []).map(rowToTask) };
}

/**
 * @param {*} env
 * @param {{ projectId: string, taskId: string }} input
 */
export async function getAutonomousTask(env, input) {
  const row = await env.DB.prepare(
    `SELECT * FROM agent_autonomous_tasks WHERE id = ? AND project_id = ? LIMIT 1`,
  )
    .bind(input.taskId, input.projectId)
    .first();
  if (!row) return { ok: false, error: "not_found" };
  return { ok: true, task: rowToTask(row) };
}
