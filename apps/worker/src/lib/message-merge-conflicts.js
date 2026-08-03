/**
 * Merge-conflict detection + resolution (#48).
 */

import { fanoutRoomInternal } from "./room-shard.js";
import { logInfo } from "./worker-log.js";

const VALID_RESOLUTIONS = new Set(["keep_a", "keep_b", "merge_both"]);
const MAX_MESSAGE_LENGTH = 8000;

function generateId(prefix) {
  return `${prefix}_${Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

function parseVersion(raw) {
  if (!raw || typeof raw !== "object") return null;
  const content = String(raw.content ?? "").trim();
  if (!content) return null;
  return {
    content,
    originInstance: String(raw.originInstance ?? raw.origin_instance ?? "unknown"),
    ts: String(raw.ts ?? raw.createdAt ?? new Date().toISOString()),
    userId: raw.userId ? String(raw.userId) : undefined,
    messageId: raw.messageId != null ? Number(raw.messageId) : undefined,
    clientMessageId: raw.clientMessageId ?? raw.client_message_id ?? null,
  };
}

function mapConflictRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id,
    messageId: row.message_id,
    clientMessageId: row.client_message_id,
    parentMessageId: row.parent_message_id,
    messageKey: row.message_key,
    status: row.status,
    resolution: row.resolution,
    versionA: JSON.parse(row.version_a_json || "{}"),
    versionB: JSON.parse(row.version_b_json || "{}"),
    mergedContent: row.merged_content,
    resolvedBy: row.resolved_by,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export function isTrueMergeConflict(versionA, versionB) {
  const a = parseVersion(versionA);
  const b = parseVersion(versionB);
  if (!a || !b || a.content === b.content) return false;

  const sameSlot =
    (a.clientMessageId && b.clientMessageId && a.clientMessageId === b.clientMessageId) ||
    (a.messageId != null && b.messageId != null && a.messageId === b.messageId);
  if (!sameSlot) return false;

  const tsA = Date.parse(a.ts);
  const tsB = Date.parse(b.ts);
  const bothValid = Number.isFinite(tsA) && Number.isFinite(tsB);
  const concurrent = bothValid && Math.abs(tsA - tsB) <= 2000;
  const clearWinner = bothValid && !concurrent && tsA !== tsB && a.originInstance !== b.originInstance;
  return !clearWinner;
}

export async function reportMergeConflict(env, input) {
  const versionA = parseVersion(input.versionA);
  const versionB = parseVersion(input.versionB);
  if (!versionA || !versionB) return { ok: false, error: "invalid_versions" };
  if (!isTrueMergeConflict(versionA, versionB)) {
    return { ok: false, error: "not_a_true_conflict" };
  }
  if (!input.projectId || !input.roomId || !input.messageKey?.trim()) {
    return { ok: false, error: "missing_fields" };
  }

  const existing = await env.DB.prepare(
    `SELECT id FROM message_merge_conflicts
     WHERE project_id = ? AND room_id = ? AND message_key = ? AND status = 'open'`,
  )
    .bind(input.projectId, input.roomId, input.messageKey.trim())
    .first();
  if (existing?.id) {
    return { ok: true, duplicate: true, conflictId: existing.id };
  }

  const id = generateId("mmc");
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO message_merge_conflicts
       (id, project_id, room_id, message_id, client_message_id, parent_message_id, message_key,
        status, version_a_json, version_b_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
  )
    .bind(
      id,
      input.projectId,
      input.roomId,
      input.messageId ?? versionA.messageId ?? versionB.messageId ?? null,
      input.clientMessageId ?? versionA.clientMessageId ?? versionB.clientMessageId ?? null,
      input.parentMessageId ?? null,
      input.messageKey.trim(),
      JSON.stringify(versionA),
      JSON.stringify(versionB),
      now,
    )
    .run();

  logInfo("merge_conflict.reported", {
    conflictId: id,
    projectId: input.projectId,
    roomId: input.roomId,
    messageKey: input.messageKey,
  });

  return { ok: true, conflictId: id };
}

export async function listMergeConflicts(env, { projectId, roomId, status = "open", limit = 20 }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM message_merge_conflicts
     WHERE project_id = ? AND room_id = ? AND status = ?
     ORDER BY created_at DESC LIMIT ?`,
  )
    .bind(projectId, roomId, status, Math.min(Number(limit) || 20, 50))
    .all();

  return (rows.results || []).map(mapConflictRow);
}

export async function getMergeConflict(env, { projectId, conflictId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM message_merge_conflicts WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, conflictId)
    .first();
  return row ? mapConflictRow(row) : null;
}

async function broadcastMessageEdit(env, projectId, roomId, messageId, userId, content, editedAt) {
  await fanoutRoomInternal(env, projectId, roomId, "/announce", {
    method: "POST",
    body: JSON.stringify({
      type: "edit",
      id: messageId,
      roomId,
      userId,
      content,
      editedAt,
    }),
  });
}

export async function resolveMergeConflict(env, input) {
  const resolution = String(input.resolution || "").trim();
  if (!VALID_RESOLUTIONS.has(resolution)) {
    return { ok: false, error: "invalid_resolution" };
  }

  const conflict = await getMergeConflict(env, {
    projectId: input.projectId,
    conflictId: input.conflictId,
  });
  if (!conflict) return { ok: false, error: "not_found" };
  if (conflict.status !== "open") return { ok: false, error: "already_resolved" };

  let finalContent;
  if (resolution === "keep_a") finalContent = conflict.versionA.content;
  else if (resolution === "keep_b") finalContent = conflict.versionB.content;
  else {
    finalContent = `${conflict.versionA.content}\n\n---\n\n${conflict.versionB.content}`.slice(
      0,
      MAX_MESSAGE_LENGTH,
    );
  }

  const now = new Date().toISOString();
  let messageId = conflict.messageId;

  if (messageId) {
    const row = await env.DB.prepare(
      `SELECT id, room_id, user_id FROM messages WHERE id = ? AND project_id = ?`,
    )
      .bind(messageId, input.projectId)
      .first();
    if (row) {
      await env.DB.prepare(
        `UPDATE messages SET content = ?, edited_at = ? WHERE id = ? AND project_id = ?`,
      )
        .bind(finalContent, now, messageId, input.projectId)
        .run();
      await broadcastMessageEdit(
        env,
        input.projectId,
        conflict.roomId,
        messageId,
        row.user_id,
        finalContent,
        now,
      ).catch(() => {});
    }
  } else {
    const insert = await env.DB.prepare(
      `INSERT INTO messages (project_id, room_id, user_id, content, created_at, parent_id, kind)
       VALUES (?, ?, ?, ?, ?, ?, 'merge_resolve')`,
    )
      .bind(
        input.projectId,
        conflict.roomId,
        input.resolvedBy ?? "system",
        finalContent,
        now,
        conflict.parentMessageId ?? null,
      )
      .run();
    messageId = insert.meta?.last_row_id ?? null;
    if (messageId) {
      await fanoutRoomInternal(env, input.projectId, conflict.roomId, "/announce", {
        method: "POST",
        body: JSON.stringify({
          roomId: conflict.roomId,
          id: messageId,
          userId: input.resolvedBy ?? "system",
          content: finalContent,
          createdAt: now,
          parentId: conflict.parentMessageId ?? null,
          kind: "merge_resolve",
        }),
      }).catch(() => {});
    }
  }

  await env.DB.prepare(
    `UPDATE message_merge_conflicts
     SET status = 'resolved', resolution = ?, merged_content = ?, resolved_by = ?, resolved_at = ?
     WHERE id = ? AND project_id = ?`,
  )
    .bind(resolution, finalContent, input.resolvedBy ?? null, now, input.conflictId, input.projectId)
    .run();

  logInfo("merge_conflict.resolved", {
    conflictId: input.conflictId,
    resolution,
    messageId,
  });

  return {
    ok: true,
    conflictId: input.conflictId,
    resolution,
    messageId,
    content: finalContent,
  };
}
