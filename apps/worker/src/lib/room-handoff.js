import { fanoutRoomInternal } from "./room-shard.js";
import {
  claimAgentTask,
  createAgentTask,
  canAccessAgentQueue,
} from "./agent-queue.js";
import { normalizeAgentDisposition } from "./agent-dispositions.js";

const CONTEXT_MESSAGE_LIMIT = 12;
const CONTEXT_CHAR_LIMIT = 2400;

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} roomId
 */
export async function isHumanHandoffActive(env, projectId, roomId) {
  const row = await env.DB.prepare(
    `SELECT 1 AS ok FROM room_handoffs
     WHERE project_id = ? AND room_id = ? AND status = 'human_active' LIMIT 1`,
  )
    .bind(projectId, roomId)
    .first();
  return Boolean(row?.ok);
}

/**
 * @param {*} row
 */
function mapHandoffRow(row) {
  if (!row) {
    return {
      status: "ai_active",
      active: false,
      handoffId: null,
      agentId: null,
      agentTaskId: null,
      handedOffByUserId: null,
      handedOffAt: null,
      contextSummary: null,
    };
  }
  return {
    status: row.status,
    active: row.status === "human_active",
    handoffId: row.id,
    agentId: row.agent_id ?? null,
    agentTaskId: row.agent_task_id ?? null,
    handedOffByUserId: row.handed_off_by_user_id ?? null,
    handedOffAt: row.handed_off_at ?? null,
    contextSummary: row.context_summary ?? null,
    disposition: row.disposition ?? null,
    resolvedAt: row.resolved_at ?? null,
    updatedAt: row.updated_at,
  };
}

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} roomId
 */
export async function getRoomHandoffState(env, projectId, roomId) {
  const row = await env.DB.prepare(
    `SELECT * FROM room_handoffs
     WHERE project_id = ? AND room_id = ?
     ORDER BY updated_at DESC LIMIT 1`,
  )
    .bind(projectId, roomId)
    .first();

  if (!row || row.status === "resolved") {
    return mapHandoffRow(null);
  }
  return mapHandoffRow(row);
}

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} roomId
 */
async function buildHandoffContextSummary(env, projectId, roomId) {
  const rows = await env.DB.prepare(
    `SELECT user_id, content, created_at FROM messages
     WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL
     ORDER BY id DESC LIMIT ?`,
  )
    .bind(projectId, roomId, CONTEXT_MESSAGE_LIMIT)
    .all();

  const lines = (rows.results || [])
    .reverse()
    .map((m) => `[${m.created_at}] ${m.user_id}: ${String(m.content || "").replace(/\s+/g, " ").trim()}`)
    .filter(Boolean);

  const text = lines.join("\n").slice(0, CONTEXT_CHAR_LIMIT);
  return text || "No prior messages in this room.";
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   userId: string,
 *   roles?: string[],
 *   agentId?: string | null,
 *   note?: string | null,
 * }} opts
 */
export async function requestHumanHandoff(env, opts) {
  if (!canAccessAgentQueue(opts.roles)) {
    return { ok: false, error: "forbidden" };
  }

  const active = await env.DB.prepare(
    `SELECT id, agent_task_id FROM room_handoffs
     WHERE project_id = ? AND room_id = ? AND status = 'human_active' LIMIT 1`,
  )
    .bind(opts.projectId, opts.roomId)
    .first();

  if (active) {
    return {
      ok: true,
      alreadyActive: true,
      handoff: mapHandoffRow(active),
    };
  }

  const contextSummary = await buildHandoffContextSummary(env, opts.projectId, opts.roomId);
  const now = new Date().toISOString();
  const handoffId = crypto.randomUUID();

  let agentTaskId = null;
  const taskResult = await createAgentTask(env, {
    projectId: opts.projectId,
    roomId: opts.roomId,
    createdByUserId: opts.userId,
    note:
      typeof opts.note === "string" && opts.note.trim()
        ? opts.note.trim().slice(0, 500)
        : "Human handoff from AI agent",
    triggerSource: "ai_handoff",
    priority: 1,
  });

  if (taskResult.ok) {
    agentTaskId = taskResult.task.id;
    await claimAgentTask(env, {
      projectId: opts.projectId,
      taskId: agentTaskId,
      userId: opts.userId,
    });
  }

  await env.DB.prepare(
    `INSERT INTO room_handoffs
       (id, project_id, room_id, agent_id, status, agent_task_id,
        handed_off_by_user_id, handed_off_at, context_summary,
        disposition, resolved_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'human_active', ?, ?, ?, ?, NULL, NULL, ?, ?)`,
  )
    .bind(
      handoffId,
      opts.projectId,
      opts.roomId,
      opts.agentId ?? null,
      agentTaskId,
      opts.userId,
      now,
      contextSummary,
      now,
      now,
    )
    .run();

  const preview = contextSummary.split("\n").slice(-3).join(" · ").slice(0, 200);

  await fanoutRoomInternal(env, opts.projectId, opts.roomId, "/announce", {
    method: "POST",
    body: JSON.stringify({
      type: "handoff",
      handoffId,
      status: "human_active",
      agentId: opts.agentId ?? null,
      agentTaskId,
      handedOffByUserId: opts.userId,
      handedOffAt: now,
      contextPreview: preview,
      userId: "fluxychat-bot",
      content: `A human agent (${opts.userId}) took over from the AI assistant.`,
    }),
  });

  return {
    ok: true,
    handoff: {
      status: "human_active",
      active: true,
      handoffId,
      agentId: opts.agentId ?? null,
      agentTaskId,
      handedOffByUserId: opts.userId,
      handedOffAt: now,
      contextSummary,
    },
    agentTask: taskResult.ok ? taskResult.task : null,
    agentTaskError: taskResult.ok ? null : taskResult.error,
  };
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   userId: string,
 *   roles?: string[],
 *   disposition?: string | null,
 * }} opts
 */
export async function resolveRoomHandoff(env, opts) {
  const row = await env.DB.prepare(
    `SELECT * FROM room_handoffs
     WHERE project_id = ? AND room_id = ? AND status = 'human_active' LIMIT 1`,
  )
    .bind(opts.projectId, opts.roomId)
    .first();

  if (!row) return { ok: false, error: "no_active_handoff" };

  const disposition = normalizeAgentDisposition(opts.disposition, { required: true });
  if (!disposition.ok) return { ok: false, error: disposition.error };

  const now = new Date().toISOString();

  await env.DB.prepare(
    `UPDATE room_handoffs
     SET status = 'resolved', disposition = ?, resolved_at = ?, updated_at = ?
     WHERE id = ? AND project_id = ?`,
  )
    .bind(disposition.code, now, now, row.id, opts.projectId)
    .run();

  if (row.agent_task_id) {
    const { resolveAgentTask } = await import("./agent-queue.js");
    await resolveAgentTask(env, {
      projectId: opts.projectId,
      taskId: row.agent_task_id,
      userId: opts.userId,
      roles: opts.roles,
      status: "resolved",
      disposition: disposition.code,
    });
  }

  await fanoutRoomInternal(env, opts.projectId, opts.roomId, "/announce", {
    method: "POST",
    body: JSON.stringify({
      type: "handoff",
      handoffId: row.id,
      status: "resolved",
      disposition: disposition.code,
      userId: "fluxychat-bot",
      content: "Handoff complete — AI assistant can respond again.",
    }),
  });

  return { ok: true, resolvedAt: now, disposition: disposition.code };
}

/**
 * Close handoff when an agent queue task linked to a handoff is resolved elsewhere.
 * @param {*} env
 * @param {{ projectId: string, taskId: string, disposition?: string | null }} opts
 */
export async function closeRoomHandoffForTask(env, opts) {
  const row = await env.DB.prepare(
    `SELECT id, project_id, room_id FROM room_handoffs
     WHERE project_id = ? AND agent_task_id = ? AND status = 'human_active' LIMIT 1`,
  )
    .bind(opts.projectId, opts.taskId)
    .first();
  if (!row) return { ok: true, skipped: true };

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE room_handoffs
     SET status = 'resolved', disposition = ?, resolved_at = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(opts.disposition ?? null, now, now, row.id)
    .run();

  return { ok: true, roomId: row.room_id };
}
