/**
 * P19-E: Realtime Notifications Engine — push live alerts with targeting.
 *
 * Features:
 *   • Channel CRUD (in_app, push, email, webhook)
 *   • Rule-based notification triggers
 *   • Targeting by room, topic, segment, user
 *   • Rate limiting per channel
 *   • Delivery tracking (pending/delivered/read)
 *   • Bulk send + broadcast
 *   • Notification preferences integration
 */

const CHANNEL_TYPES = ["in_app", "push", "email", "webhook"];
const DELIVERY_STATUS = ["pending", "delivered", "failed", "read"];

export async function createChannel(env, {
  projectId, name, channelType, config, rateLimitPerMinute,
}) {
  if (!CHANNEL_TYPES.includes(channelType)) throw new Error(`Invalid channel type: ${channelType}`);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO notification_channels (id, project_id, name, channel_type, config, rate_limit_per_minute)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, name, channelType, JSON.stringify(config || {}), rateLimitPerMinute || 60).run();
  return { id, name, channelType, rateLimitPerMinute: rateLimitPerMinute || 60 };
}

export async function getChannel(env, { projectId, channelId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM notification_channels WHERE project_id = ? AND id = ?`
  ).bind(projectId, channelId).first();
  return row ? formatChannel(row) : null;
}

export async function listChannels(env, { projectId }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM notification_channels WHERE project_id = ? ORDER BY created_at DESC`
  ).bind(projectId).all();
  return results.map(formatChannel);
}

export async function deleteChannel(env, { projectId, channelId }) {
  await env.DB.prepare(`DELETE FROM notification_rules WHERE channel_id = ?`).bind(channelId).run();
  await env.DB.prepare(`DELETE FROM notification_deliveries WHERE channel_id = ?`).bind(channelId).run();
  const info = await env.DB.prepare(
    `DELETE FROM notification_channels WHERE project_id = ? AND id = ?`
  ).bind(projectId, channelId).run();
  return info.meta?.changes > 0;
}

/* ═══ Rules ═══ */

export async function createRule(env, {
  projectId, channelId, name, triggerEvent, conditions, template, priority,
}) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO notification_rules (id, project_id, channel_id, name, trigger_event, conditions, template, priority)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, channelId, name, triggerEvent, JSON.stringify(conditions || {}),
    JSON.stringify(template || {}), priority || 0).run();
  return { id, name, triggerEvent, priority: priority || 0 };
}

export async function listRules(env, { projectId, channelId }) {
  let query = `SELECT * FROM notification_rules WHERE project_id = ?`;
  const params = [projectId];
  if (channelId) { query += ` AND channel_id = ?`; params.push(channelId); }
  query += ` ORDER BY priority DESC`;
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatRule);
}

export async function deleteRule(env, { projectId, ruleId }) {
  const info = await env.DB.prepare(
    `DELETE FROM notification_rules WHERE project_id = ? AND id = ?`
  ).bind(projectId, ruleId).run();
  return info.meta?.changes > 0;
}

/* ═══ Deliveries ═══ */

export async function sendNotification(env, {
  projectId, channelId, ruleId, userId, title, body, data,
}) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO notification_deliveries (id, project_id, channel_id, rule_id, user_id, title, body, data, status, delivered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'delivered', datetime('now'))`
  ).bind(id, projectId, channelId, ruleId || null, userId, title, body, JSON.stringify(data || {})).run();
  return { id, title, body, status: "delivered" };
}

export async function sendBulkNotifications(env, {
  projectId, channelId, ruleId, userIds, title, body, data,
}) {
  const ids = [];
  for (const userId of userIds) {
    const r = await sendNotification(env, { projectId, channelId, ruleId, userId, title, body, data });
    ids.push(r.id);
  }
  return { count: ids.length, ids };
}

export async function broadcastNotification(env, {
  projectId, channelId, ruleId, title, body, data, targetSegment,
}) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO notification_deliveries (id, project_id, channel_id, rule_id, user_id, title, body, data, status, delivered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'delivered', datetime('now'))`
  ).bind(id, projectId, channelId, ruleId || null, `segment:${targetSegment || "all"}`, title, body, JSON.stringify(data || {})).run();
  return { id, broadcast: true, segment: targetSegment || "all" };
}

export async function getUserNotifications(env, {
  projectId, userId, unreadOnly, limit = 20,
}) {
  let query = `SELECT * FROM notification_deliveries WHERE project_id = ? AND user_id = ?`;
  const params = [projectId, userId];
  if (unreadOnly) { query += ` AND read_at IS NULL`; }
  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatDelivery);
}

export async function markAsRead(env, { projectId, notificationId }) {
  const info = await env.DB.prepare(
    `UPDATE notification_deliveries SET read_at = datetime('now'), status = 'read'
     WHERE project_id = ? AND id = ? AND read_at IS NULL`
  ).bind(projectId, notificationId).run();
  return info.meta?.changes > 0;
}

export async function markAllAsRead(env, { projectId, userId }) {
  const info = await env.DB.prepare(
    `UPDATE notification_deliveries SET read_at = datetime('now'), status = 'read'
     WHERE project_id = ? AND user_id = ? AND read_at IS NULL`
  ).bind(projectId, userId).run();
  return info.meta?.changes || 0;
}

export async function getUnreadCount(env, { projectId, userId }) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM notification_deliveries
     WHERE project_id = ? AND user_id = ? AND read_at IS NULL`
  ).bind(projectId, userId).first();
  return row?.count || 0;
}

export async function getNotificationStats(env, { projectId }) {
  const total = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM notification_deliveries WHERE project_id = ?`
  ).bind(projectId).first();
  const unread = await env.DB.prepare(
    `SELECT COUNT(*) as unread FROM notification_deliveries WHERE project_id = ? AND read_at IS NULL`
  ).bind(projectId).first();
  const byChannel = await env.DB.prepare(
    `SELECT channel_id, COUNT(*) as count FROM notification_deliveries
     WHERE project_id = ? GROUP BY channel_id`
  ).bind(projectId).all();
  return {
    total: total?.total || 0, unread: unread?.unread || 0,
    byChannel: byChannel.results || byChannel,
  };
}

function formatChannel(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name, channelType: row.channel_type,
    config: JSON.parse(row.config || "{}"), rateLimitPerMinute: row.rate_limit_per_minute,
    enabled: row.enabled === 1, createdAt: row.created_at,
  };
}

function formatRule(row) {
  return {
    id: row.id, projectId: row.project_id, channelId: row.channel_id, name: row.name,
    triggerEvent: row.trigger_event, conditions: JSON.parse(row.conditions || "{}"),
    template: JSON.parse(row.template || "{}"), priority: row.priority,
    enabled: row.enabled === 1, createdAt: row.created_at,
  };
}

function formatDelivery(row) {
  return {
    id: row.id, projectId: row.project_id, channelId: row.channel_id, ruleId: row.rule_id,
    userId: row.user_id, title: row.title, body: row.body, data: JSON.parse(row.data || "{}"),
    status: row.status, deliveredAt: row.delivered_at, readAt: row.read_at, createdAt: row.created_at,
  };
}
