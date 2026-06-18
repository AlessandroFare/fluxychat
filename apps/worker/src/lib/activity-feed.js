/**
 * P19-D: Activity Feed Layer — collaborative project activity stream.
 *
 * Features:
 *   • Feed CRUD (project-level, room-level, custom)
 *   • Event types: join, leave, create, update, delete, comment, status_change, assignment, mention, handoff
 *   • Actor tracking with name + avatar
 *   • Entity references (any object type)
 *   • Time-windowed queries
 *   • Pagination + cursor support
 *   • Feed aggregation (cross-feed)
 */

const EVENT_TYPES = [
  "join", "leave", "create", "update", "delete", "comment",
  "status_change", "assignment", "mention", "handoff", "reaction",
  "resolve", "escalate", "tag", "upload", "download",
];

export async function createFeed(env, { projectId, name, feedType, roomId, description, isPublic }) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO activity_feeds (id, project_id, name, feed_type, room_id, description, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, name, feedType || "project", roomId || null, description || null, isPublic ? 1 : 0).run();
  return { id, name, feedType: feedType || "project" };
}

export async function getFeed(env, { projectId, feedId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM activity_feeds WHERE project_id = ? AND id = ?`
  ).bind(projectId, feedId).first();
  return row ? formatFeed(row) : null;
}

export async function listFeeds(env, { projectId }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM activity_feeds WHERE project_id = ? ORDER BY created_at DESC`
  ).bind(projectId).all();
  return results.map(formatFeed);
}

export async function deleteFeed(env, { projectId, feedId }) {
  await env.DB.prepare(`DELETE FROM activity_events WHERE feed_id = ?`).bind(feedId).run();
  const info = await env.DB.prepare(
    `DELETE FROM activity_feeds WHERE project_id = ? AND id = ?`
  ).bind(projectId, feedId).run();
  return info.meta?.changes > 0;
}

export async function recordEvent(env, {
  projectId, feedId, eventType, actorId, actorName,
  entityType, entityId, entityName, action, metadata, timestamp,
}) {
  if (!EVENT_TYPES.includes(eventType)) throw new Error(`Invalid event type: ${eventType}`);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO activity_events (id, feed_id, project_id, event_type, actor_id, actor_name,
     entity_type, entity_id, entity_name, action, metadata, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, feedId, projectId, eventType, actorId, actorName || null,
    entityType || null, entityId || null, entityName || null, action,
    JSON.stringify(metadata || {}), timestamp || new Date().toISOString()).run();
  return { id, eventType, action, timestamp: timestamp || new Date().toISOString() };
}

export async function queryEvents(env, {
  projectId, feedId, eventType, actorId, entityType, from, to, limit = 50, cursor,
}) {
  let query = `SELECT * FROM activity_events WHERE project_id = ?`;
  const params = [projectId];
  if (feedId) { query += ` AND feed_id = ?`; params.push(feedId); }
  if (eventType) { query += ` AND event_type = ?`; params.push(eventType); }
  if (actorId) { query += ` AND actor_id = ?`; params.push(actorId); }
  if (entityType) { query += ` AND entity_type = ?`; params.push(entityType); }
  if (from) { query += ` AND timestamp >= ?`; params.push(from); }
  if (to) { query += ` AND timestamp <= ?`; params.push(to); }
  if (cursor) { query += ` AND timestamp < ?`; params.push(cursor); }
  query += ` ORDER BY timestamp DESC LIMIT ?`;
  params.push(limit + 1);
  const { results } = await env.DB.prepare(query).bind(...params).all();
  const hasMore = results.length > limit;
  const events = results.slice(0, limit).map(formatEvent);
  return { events, hasMore, nextCursor: hasMore ? events[events.length - 1]?.timestamp : null };
}

export async function getFeedStats(env, { projectId, feedId }) {
  const total = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM activity_events WHERE project_id = ? AND feed_id = ?`
  ).bind(projectId, feedId).first();
  const byType = await env.DB.prepare(
    `SELECT event_type, COUNT(*) as count FROM activity_events
     WHERE project_id = ? AND feed_id = ? GROUP BY event_type`
  ).bind(projectId, feedId).all();
  return { total: total?.total || 0, byType: byType.results || byType };
}

export async function getAggregatedFeed(env, { projectId, feedIds, from, to, limit = 50 }) {
  if (!feedIds || feedIds.length === 0) {
    const { results } = await env.DB.prepare(
      `SELECT * FROM activity_events WHERE project_id = ? AND timestamp >= ? AND timestamp <= ?
       ORDER BY timestamp DESC LIMIT ?`
    ).bind(projectId, from || "2000-01-01", to || "2099-12-31", limit).all();
    return results.map(formatEvent);
  }
  const placeholders = feedIds.map(() => "?").join(",");
  const { results } = await env.DB.prepare(
    `SELECT * FROM activity_events WHERE project_id = ? AND feed_id IN (${placeholders})
     AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC LIMIT ?`
  ).bind(projectId, ...feedIds, from || "2000-01-01", to || "2099-12-31", limit).all();
  return results.map(formatEvent);
}

function formatFeed(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name, feedType: row.feed_type,
    roomId: row.room_id, description: row.description, isPublic: row.is_public === 1,
    createdAt: row.created_at,
  };
}

function formatEvent(row) {
  return {
    id: row.id, feedId: row.feed_id, projectId: row.project_id, eventType: row.event_type,
    actorId: row.actor_id, actorName: row.actor_name, entityType: row.entity_type,
    entityId: row.entity_id, entityName: row.entity_name, action: row.action,
    metadata: JSON.parse(row.metadata || "{}"), timestamp: row.timestamp, createdAt: row.created_at,
  };
}

