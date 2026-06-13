/**
 * P15-K: Replay Mode — temporal reconstruction of conversations.
 *
 * Features:
 *   • Record all message lifecycle events (create, edit, delete, reactions, AI handoff)
 *   • Snapshot room state at any point in time
 *   • Create named bookmarks for key moments
 *   • Replay timeline with event details and diffs
 *   • AI→human handoff tracking
 */

export async function recordReplayEvent(env, { projectId, roomId, eventType, eventData, messageId, timestamp }) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO replay_snapshots (id, project_id, room_id, timestamp, snapshot_type, event_data)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, roomId, timestamp || new Date().toISOString(), eventType, JSON.stringify({ ...eventData, messageId })).run();
  return { id, eventType, timestamp: timestamp || new Date().toISOString() };
}

export async function getReplayTimeline(env, { projectId, roomId, from, to, limit = 50 }) {
  let query = `SELECT * FROM replay_snapshots WHERE project_id = ? AND room_id = ?`;
  const params = [projectId, roomId];
  if (from) { query += ` AND timestamp >= ?`; params.push(from); }
  if (to) { query += ` AND timestamp <= ?`; params.push(to); }
  query += ` ORDER BY timestamp ASC LIMIT ?`;
  params.push(limit);
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map((r) => ({ ...r, event_data: JSON.parse(r.event_data || "{}") }));
}

export async function getReplayTimelineBetween(env, { projectId, roomId, from, to, limit = 50 }) {
  let query = `SELECT * FROM replay_snapshots WHERE project_id = ? AND room_id = ?`;
  const params = [projectId, roomId];
  if (from) { query += ` AND timestamp >= ?`; params.push(from); }
  if (to) { query += ` AND timestamp <= ?`; params.push(to); }
  query += ` ORDER BY timestamp ASC LIMIT ?`;
  params.push(limit);
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map((r) => ({ ...r, event_data: JSON.parse(r.event_data || "{}") }));
}

export async function getReplaySnapshotAtTime(env, { projectId, roomId, asOf }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM replay_snapshots WHERE project_id = ? AND room_id = ? AND timestamp <= ? ORDER BY timestamp DESC LIMIT 200`
  ).bind(projectId, roomId, asOf).all();

  const state = { messages: {}, reactions: {}, members: new Set(), lastEvent: null };
  for (const r of results.reverse()) {
    const data = JSON.parse(r.event_data || "{}");
    state.lastEvent = r;
    if (r.snapshot_type === "message" && data.type === "create") {
      state.messages[data.messageId] = { id: data.messageId, userId: data.userId, content: data.content, createdAt: r.timestamp, edited: false };
      state.members.add(data.userId);
    }
    if (r.snapshot_type === "message" && data.type === "edit") {
      if (state.messages[data.messageId]) {
        state.messages[data.messageId].content = data.newContent || data.content;
        state.messages[data.messageId].edited = true;
        state.messages[data.messageId].editedAt = r.timestamp;
      }
    }
    if (r.snapshot_type === "message" && data.type === "delete") {
      if (state.messages[data.messageId]) {
        state.messages[data.messageId].deleted = true;
        state.messages[data.messageId].deletedAt = r.timestamp;
      }
    }
    if (r.snapshot_type === "reaction") {
      const mid = data.messageId;
      if (!state.reactions[mid]) state.reactions[mid] = {};
      state.reactions[mid][data.emoji] = (state.reactions[mid][data.emoji] || 0) + 1;
    }
  }
  return { messages: state.messages, reactions: state.reactions, members: [...state.members], messageCount: Object.keys(state.messages).length };
}

export async function createBookmark(env, { projectId, roomId, name, description, messageId, timestamp, createdBy }) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO replay_bookmarks (id, project_id, room_id, name, description, message_id, timestamp, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, roomId, name, description || null, messageId || null, timestamp || new Date().toISOString(), createdBy).run();
  return { id, name };
}

export async function listBookmarks(env, { projectId, roomId }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM replay_bookmarks WHERE project_id = ? AND room_id = ? ORDER BY timestamp ASC`
  ).bind(projectId, roomId).all();
  return results;
}

export async function deleteBookmark(env, { projectId, bookmarkId }) {
  const info = await env.DB.prepare(
    `DELETE FROM replay_bookmarks WHERE id = ? AND project_id = ?`
  ).bind(bookmarkId, projectId).run();
  return info.meta?.changes > 0;
}

export async function getReplayStats(env, { projectId, roomId }) {
  const { results } = await env.DB.prepare(
    `SELECT snapshot_type, COUNT(*) as cnt FROM replay_snapshots
     WHERE project_id = ? AND room_id = ? GROUP BY snapshot_type`
  ).bind(projectId, roomId).all();

  const stats = { events: 0, byType: {} };
  for (const r of results) {
    stats.events += r.cnt;
    stats.byType[r.snapshot_type] = r.cnt;
  }
  return stats;
}
