import { normalizeAgentDisposition } from "./agent-dispositions.js";

const AGENT_QUEUE_ROLES = ["owner", "admin", "moderator"];
const ACTIVE_STATUSES = ["open", "claimed"];
const NOTE_MAX = 500;

/**
 * @param {string[] | undefined} roles
 */
export function canAccessAgentQueue(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => AGENT_QUEUE_ROLES.includes(r));
}

/**
 * @param {*} env
 * @param {string | undefined} overrideMinutes
 */
export function resolveAgentQueueSlaMinutes(env, overrideMinutes) {
  const raw =
    overrideMinutes != null && Number.isFinite(Number(overrideMinutes))
      ? Number(overrideMinutes)
      : Number(env.AGENT_QUEUE_SLA_MINUTES ?? 15);
  return Math.min(24 * 60, Math.max(1, Math.floor(raw)));
}

/**
 * @param {string} iso
 * @param {number} slaMinutes
 */
export function computeSlaDueAt(iso, slaMinutes) {
  const base = Date.parse(iso);
  const ms = Number.isFinite(base) ? base : Date.now();
  return new Date(ms + slaMinutes * 60_000).toISOString();
}

/**
 * @param {*} row
 * @param {string} [nowIso]
 */
export function mapAgentTaskRow(row, nowIso = new Date().toISOString()) {
  const now = Date.parse(nowIso);
  const slaDue = Date.parse(row.sla_due_at);
  const slaBreached =
    ACTIVE_STATUSES.includes(row.status) && Number.isFinite(slaDue) && now > slaDue;
  const secondsToSla = Number.isFinite(slaDue)
    ? Math.round((slaDue - now) / 1000)
    : null;

  return {
    id: row.id,
    roomId: row.room_id,
    status: row.status,
    priority: row.priority ?? 0,
    assigneeUserId: row.assignee_user_id ?? null,
    claimedAt: row.claimed_at ?? null,
    slaDueAt: row.sla_due_at,
    slaBreached,
    secondsToSla,
    resolvedAt: row.resolved_at ?? null,
    disposition: row.disposition ?? null,
    note: row.note ?? null,
    triggerSource: row.trigger_source ?? "manual",
    createdByUserId: row.created_by_user_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    roomName: row.room_name ?? row.room_id,
    roomType: row.room_type ?? null,
  };
}

async function loadRoomMeta(env, projectId, roomIds) {
  if (!roomIds.length) return new Map();
  const placeholders = roomIds.map(() => "?").join(", ");
  const rows = await env.DB.prepare(
    `SELECT id, name, type FROM rooms WHERE project_id = ? AND id IN (${placeholders})`,
  )
    .bind(projectId, ...roomIds)
    .all();
  return new Map((rows.results || []).map((r) => [r.id, r]));
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   status?: string,
 *   assignee?: "me" | "all",
 *   userId: string,
 *   limit?: number,
 * }} scope
 */
export async function listAgentTasks(env, scope) {
  const limit = Math.min(100, Math.max(1, Number(scope.limit || 50)));
  const statusFilter =
    scope.status === "resolved" || scope.status === "cancelled"
      ? scope.status
      : "active";

  let query = `
    SELECT t.*, r.name AS room_name, r.type AS room_type
    FROM agent_tasks t
    LEFT JOIN rooms r ON r.id = t.room_id AND r.project_id = t.project_id
    WHERE t.project_id = ?`;
  const binds = [scope.projectId];

  if (statusFilter === "active") {
    query += " AND t.status IN ('open', 'claimed')";
  } else {
    query += " AND t.status = ?";
    binds.push(statusFilter);
  }

  if (scope.assignee === "me") {
    query += " AND t.assignee_user_id = ?";
    binds.push(scope.userId);
  }

  query +=
    " ORDER BY t.priority DESC, t.sla_due_at ASC, t.created_at ASC LIMIT ?";
  binds.push(limit);

  const rows = await env.DB.prepare(query)
    .bind(...binds)
    .all();

  const tasks = (rows.results || []).map((row) => mapAgentTaskRow(row));
  const breached = tasks.filter((t) => t.slaBreached).length;
  return {
    tasks,
    counts: {
      total: tasks.length,
      open: tasks.filter((t) => t.status === "open").length,
      claimed: tasks.filter((t) => t.status === "claimed").length,
      slaBreached: breached,
    },
  };
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   createdByUserId?: string | null,
 *   note?: string | null,
 *   priority?: number,
 *   slaMinutes?: number,
 *   triggerSource?: string,
 * }} opts
 */
export async function createAgentTask(env, opts) {
  const now = new Date().toISOString();
  const slaMinutes = resolveAgentQueueSlaMinutes(env, opts.slaMinutes);
  const slaDueAt = computeSlaDueAt(now, slaMinutes);
  const id = crypto.randomUUID();
  const priority = Number.isFinite(Number(opts.priority))
    ? Math.min(10, Math.max(-10, Math.floor(Number(opts.priority))))
    : 0;
  const note =
    typeof opts.note === "string" ? opts.note.trim().slice(0, NOTE_MAX) : null;
  const triggerSource =
    typeof opts.triggerSource === "string" && opts.triggerSource.trim()
      ? opts.triggerSource.trim().slice(0, 32)
      : "manual";

  try {
    await env.DB.prepare(
      `INSERT INTO agent_tasks
         (id, project_id, room_id, status, priority, assignee_user_id, claimed_at,
          sla_due_at, resolved_at, disposition, note, trigger_source, created_by_user_id,
          created_at, updated_at)
       VALUES (?, ?, ?, 'open', ?, NULL, NULL, ?, NULL, NULL, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        opts.projectId,
        opts.roomId,
        priority,
        slaDueAt,
        note,
        triggerSource,
        opts.createdByUserId ?? null,
        now,
        now,
      )
      .run();
  } catch (err) {
    if (String(err?.message || err).includes("UNIQUE")) {
      return { ok: false, error: "room_already_queued" };
    }
    throw err;
  }

  const roomMeta = await loadRoomMeta(env, opts.projectId, [opts.roomId]);
  const meta = roomMeta.get(opts.roomId);
  return {
    ok: true,
    task: mapAgentTaskRow({
      id,
      project_id: opts.projectId,
      room_id: opts.roomId,
      status: "open",
      priority,
      assignee_user_id: null,
      claimed_at: null,
      sla_due_at: slaDueAt,
      resolved_at: null,
      disposition: null,
      note,
      trigger_source: triggerSource,
      created_by_user_id: opts.createdByUserId ?? null,
      created_at: now,
      updated_at: now,
      room_name: meta?.name ?? opts.roomId,
      room_type: meta?.type ?? null,
    }),
  };
}

/**
 * @param {*} env
 * @param {{ projectId: string, taskId: string, userId: string }} opts
 */
export async function claimAgentTask(env, opts) {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE agent_tasks
     SET status = 'claimed', assignee_user_id = ?, claimed_at = ?, updated_at = ?
     WHERE id = ? AND project_id = ? AND status = 'open'`,
  )
    .bind(opts.userId, now, now, opts.taskId, opts.projectId)
    .run();

  if (!result.meta?.changes) {
    const existing = await env.DB.prepare(
      `SELECT id, status, assignee_user_id FROM agent_tasks
       WHERE id = ? AND project_id = ?`,
    )
      .bind(opts.taskId, opts.projectId)
      .first();
    if (!existing) return { ok: false, error: "not_found" };
    if (
      existing.status === "claimed" &&
      existing.assignee_user_id === opts.userId
    ) {
      return { ok: true, alreadyClaimed: true };
    }
    return { ok: false, error: "not_claimable" };
  }
  return { ok: true, claimedAt: now, assigneeUserId: opts.userId };
}

/**
 * @param {*} env
 * @param {{ projectId: string, taskId: string, userId: string, roles?: string[] }} opts
 */
export async function releaseAgentTask(env, opts) {
  const row = await env.DB.prepare(
    `SELECT status, assignee_user_id FROM agent_tasks WHERE id = ? AND project_id = ?`,
  )
    .bind(opts.taskId, opts.projectId)
    .first();
  if (!row) return { ok: false, error: "not_found" };
  if (row.status !== "claimed") return { ok: false, error: "not_claimed" };

  const isAssignee = row.assignee_user_id === opts.userId;
  const isSupervisor = canAccessAgentQueue(opts.roles);
  if (!isAssignee && !isSupervisor) {
    return { ok: false, error: "forbidden" };
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE agent_tasks
     SET status = 'open', assignee_user_id = NULL, claimed_at = NULL, updated_at = ?
     WHERE id = ? AND project_id = ? AND status = 'claimed'`,
  )
    .bind(now, opts.taskId, opts.projectId)
    .run();

  return { ok: true };
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   taskId: string,
 *   userId: string,
 *   roles?: string[],
 *   status: "resolved" | "cancelled",
 *   disposition?: string | null,
 * }} opts
 */
export async function resolveAgentTask(env, opts) {
  const row = await env.DB.prepare(
    `SELECT status, assignee_user_id FROM agent_tasks WHERE id = ? AND project_id = ?`,
  )
    .bind(opts.taskId, opts.projectId)
    .first();
  if (!row) return { ok: false, error: "not_found" };
  if (!ACTIVE_STATUSES.includes(row.status)) {
    return { ok: false, error: "already_closed" };
  }

  const isAssignee = row.assignee_user_id === opts.userId;
  const isSupervisor = canAccessAgentQueue(opts.roles);
  if (row.status === "claimed" && !isAssignee && !isSupervisor) {
    return { ok: false, error: "forbidden" };
  }

  const now = new Date().toISOString();
  let dispositionCode = null;
  if (opts.status === "resolved") {
    const normalized = normalizeAgentDisposition(opts.disposition, { required: true });
    if (!normalized.ok) return { ok: false, error: normalized.error };
    dispositionCode = normalized.code;
  } else if (opts.disposition) {
    const normalized = normalizeAgentDisposition(opts.disposition);
    if (!normalized.ok) return { ok: false, error: normalized.error };
    dispositionCode = normalized.code;
  }

  await env.DB.prepare(
    `UPDATE agent_tasks
     SET status = ?, resolved_at = ?, disposition = ?, updated_at = ?
     WHERE id = ? AND project_id = ? AND status IN ('open', 'claimed')`,
  )
    .bind(opts.status, now, dispositionCode, now, opts.taskId, opts.projectId)
    .run();

  if (opts.status === "resolved") {
    const { closeRoomHandoffForTask } = await import("./room-handoff.js");
    await closeRoomHandoffForTask(env, {
      projectId: opts.projectId,
      taskId: opts.taskId,
      disposition: dispositionCode,
    });
  }

  return { ok: true, status: opts.status, resolvedAt: now, disposition: dispositionCode };
}

/**
 * Optional: enqueue when inbound telco message lands (AGENT_QUEUE_AUTO_INBOUND).
 * @param {*} env
 * @param {{ projectId: string, roomId: string, channel?: string }} detail
 */
export async function maybeEnqueueAgentTaskForInbound(env, detail) {
  if (
    env.AGENT_QUEUE_AUTO_INBOUND !== "true" &&
    env.AGENT_QUEUE_AUTO_INBOUND !== "1"
  ) {
    return { skipped: true };
  }
  return createAgentTask(env, {
    projectId: detail.projectId,
    roomId: detail.roomId,
    createdByUserId: null,
    triggerSource: detail.channel ? `inbound_${detail.channel}` : "inbound_telco",
    note: "Inbound telco message",
  });
}
