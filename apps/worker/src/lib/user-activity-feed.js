/**
 * CP-020: Cross-room activity feed (Stream-style personal digest).
 */

function generateId() {
  return `act_${crypto.randomUUID().slice(0, 12)}`;
}

/**
 * Append an activity item for a user.
 */
export async function appendActivityFeedItem(env, input) {
  const {
    projectId,
    userId,
    kind,
    title,
    body,
    roomId,
    messageId,
    actorUserId,
  } = input;
  if (!projectId || !userId || !kind || !title) return { ok: false, error: "missing_fields" };

  const id = generateId();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO user_activity_feed (
       id, project_id, user_id, kind, title, body, room_id, message_id, actor_user_id, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, projectId, userId, kind, title, body || null, roomId || null, messageId ?? null, actorUserId || null, now)
    .run();

  return { ok: true, id };
}

/**
 * Fan-out mention activities to mentioned users.
 */
export async function appendMentionActivities(env, {
  projectId,
  roomId,
  messageId,
  authorUserId,
  mentionedUserIds,
  preview,
}) {
  const author = authorUserId || "someone";
  for (const userId of mentionedUserIds || []) {
    if (!userId || userId === authorUserId) continue;
    await appendActivityFeedItem(env, {
      projectId,
      userId,
      kind: "mention",
      title: `${author} mentioned you`,
      body: String(preview || "").slice(0, 200),
      roomId,
      messageId,
      actorUserId: authorUserId,
    });
  }
}

export async function listActivityFeed(env, { projectId, userId, limit = 50, unreadOnly = false }) {
  let sql = `SELECT id, kind, title, body, room_id, message_id, actor_user_id, read_at, created_at
             FROM user_activity_feed WHERE project_id = ? AND user_id = ?`;
  const params = [projectId, userId];
  if (unreadOnly) sql += " AND read_at IS NULL";
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(Math.min(limit, 100));

  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    roomId: r.room_id,
    messageId: r.message_id,
    actorUserId: r.actor_user_id,
    readAt: r.read_at,
    createdAt: r.created_at,
    unread: !r.read_at,
  }));
}

export async function markActivityFeedRead(env, { projectId, userId, ids }) {
  const now = new Date().toISOString();
  if (!ids?.length) {
    await env.DB.prepare(
      `UPDATE user_activity_feed SET read_at = ? WHERE project_id = ? AND user_id = ? AND read_at IS NULL`,
    )
      .bind(now, projectId, userId)
      .run();
    return { ok: true, marked: "all" };
  }
  for (const id of ids) {
    await env.DB.prepare(
      `UPDATE user_activity_feed SET read_at = ? WHERE id = ? AND project_id = ? AND user_id = ?`,
    )
      .bind(now, id, projectId, userId)
      .run();
  }
  return { ok: true, marked: ids.length };
}

export async function countUnreadActivity(env, projectId, userId) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM user_activity_feed WHERE project_id = ? AND user_id = ? AND read_at IS NULL`,
  )
    .bind(projectId, userId)
    .first();
  return row?.cnt || 0;
}
