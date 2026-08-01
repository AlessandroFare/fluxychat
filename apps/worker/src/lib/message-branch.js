/**
 * Conversation branch (edit/retry): soft-delete from anchor onward.
 * Policy: allowed when tail contains only current user + known agent(s).
 */

/**
 * @param {Array<{ id: number, user_id: string }>} messages chronological
 * @param {number} fromMessageId
 * @param {string} userId
 * @param {string[]} agentIds
 * @param {{ isAdmin?: boolean }} [opts]
 */
export function evaluateBranchPolicy(messages, fromMessageId, userId, agentIds, opts = {}) {
  const agentSet = new Set((agentIds || []).filter(Boolean));
  const idx = messages.findIndex((m) => m.id === fromMessageId);
  if (idx < 0) {
    return { allowed: false, reason: "not_found", messageIds: [] };
  }

  const anchor = messages[idx];
  const tail = messages.slice(idx);
  const anchorIsUser = anchor.user_id === userId;
  const anchorIsAgent = agentSet.has(anchor.user_id);

  if (!opts.isAdmin && !anchorIsUser && !anchorIsAgent) {
    return { allowed: false, reason: "forbidden_anchor", messageIds: [] };
  }

  for (const row of tail) {
    if (row.user_id === userId) continue;
    if (agentSet.has(row.user_id)) continue;
    if (opts.isAdmin) continue;
    return {
      allowed: false,
      reason: "blocked_by_other_users",
      blockedUserId: row.user_id,
      messageIds: [],
    };
  }

  return {
    allowed: true,
    reason: null,
    messageIds: tail.map((m) => m.id),
  };
}

/**
 * @param {import("../worker.js").Env} env
 * @param {string} projectId
 * @param {string} roomId
 * @param {number} fromMessageId
 * @param {string} userId
 * @param {string[]} agentIds
 * @param {{ isAdmin?: boolean }} [opts]
 */
export async function branchRoomFromMessage(env, projectId, roomId, fromMessageId, userId, agentIds, opts = {}) {
  const rows = await env.DB.prepare(
    `SELECT id, user_id, created_at FROM messages
     WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC, id ASC`,
  )
    .bind(projectId, roomId)
    .all();

  const messages = rows.results || [];
  const policy = evaluateBranchPolicy(messages, fromMessageId, userId, agentIds, opts);
  if (!policy.allowed) {
    return { ok: false, ...policy };
  }

  const now = new Date().toISOString();
  const deletedIds = [];

  for (const messageId of policy.messageIds) {
    await env.DB.prepare(
      "UPDATE messages SET deleted_at = ?, content = ? WHERE id = ? AND project_id = ? AND deleted_at IS NULL",
    )
      .bind(now, "[deleted]", messageId, projectId)
      .run();
    deletedIds.push(messageId);
  }

  return { ok: true, deletedIds, deletedAt: now };
}
