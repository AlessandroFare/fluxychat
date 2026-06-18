/**
 * P20-E: Broadcast Segmentation — targeted messaging at scale.
 *
 * Features:
 *   • Segment definition (dynamic rules or static user list)
 *   • Rule types: role, tenant, behavior, custom attribute
 *   • Campaign lifecycle: draft → scheduled → sending → sent
 *   • Multi-channel: in_app, push, email, webhook
 *   • Delivery tracking per user
 *   • Analytics (delivery rate, read rate, failure rate)
 */

const SEGMENT_TYPES = ["dynamic", "static"];
const CAMPAIGN_STATUS = ["draft", "scheduled", "sending", "sent", "failed"];
const BROADCAST_CHANNELS = ["in_app", "push", "email", "webhook"];

export async function createSegment(env, {
  projectId, name, description, segmentType, rules,
}) {
  if (!SEGMENT_TYPES.includes(segmentType || "dynamic")) throw new Error(`Invalid segment type: ${segmentType}`);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO broadcast_segments (id, project_id, name, description, segment_type, rules)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, name, description || null, segmentType || "dynamic",
    JSON.stringify(rules || [])).run();
  return { id, name, segmentType: segmentType || "dynamic" };
}

export async function getSegment(env, { projectId, segmentId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM broadcast_segments WHERE project_id = ? AND id = ?`
  ).bind(projectId, segmentId).first();
  return row ? formatSegment(row) : null;
}

export async function listSegments(env, { projectId }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM broadcast_segments WHERE project_id = ? ORDER BY created_at DESC`
  ).bind(projectId).all();
  return results.map(formatSegment);
}

export async function deleteSegment(env, { projectId, segmentId }) {
  const info = await env.DB.prepare(
    `DELETE FROM broadcast_segments WHERE project_id = ? AND id = ?`
  ).bind(projectId, segmentId).run();
  return info.meta?.changes > 0;
}

/* ═══ Campaigns ═══ */

export async function createCampaign(env, {
  projectId, segmentId, name, messageTemplate, channel, scheduledAt,
}) {
  if (!BROADCAST_CHANNELS.includes(channel || "in_app")) throw new Error(`Invalid channel: ${channel}`);
  if (!CAMPAIGN_STATUS.includes("draft")) throw new Error("Invalid status");
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO broadcast_campaigns (id, project_id, segment_id, name, message_template, channel, scheduled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, segmentId || null, name, messageTemplate, channel || "in_app",
    scheduledAt || null).run();
  return { id, name, status: "draft", channel: channel || "in_app" };
}

export async function getCampaign(env, { projectId, campaignId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM broadcast_campaigns WHERE project_id = ? AND id = ?`
  ).bind(projectId, campaignId).first();
  return row ? formatCampaign(row) : null;
}

export async function listCampaigns(env, { projectId, status, limit = 50 }) {
  let query = `SELECT * FROM broadcast_campaigns WHERE project_id = ?`;
  const params = [projectId];
  if (status) { query += ` AND status = ?`; params.push(status); }
  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatCampaign);
}

export async function sendCampaign(env, { projectId, campaignId }) {
  const campaign = await getCampaign(env, { projectId, campaignId });
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "draft") throw new Error("Campaign not in draft status");
  await env.DB.prepare(
    `UPDATE broadcast_campaigns SET status = 'sending', sent_at = datetime('now') WHERE project_id = ? AND id = ?`
  ).bind(projectId, campaignId).run();
  return { ...campaign, status: "sending" };
}

export async function completeCampaign(env, { projectId, campaignId, totalRecipients, delivered, failed }) {
  await env.DB.prepare(
    `UPDATE broadcast_campaigns SET status = 'sent', total_recipients = ?, delivered = ?, failed = ?
     WHERE project_id = ? AND id = ?`
  ).bind(totalRecipients || 0, delivered || 0, failed || 0, projectId, campaignId).run();
}

/* ═══ Deliveries ═══ */

export async function createDelivery(env, {
  projectId, campaignId, userId, channel,
}) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO broadcast_deliveries (id, campaign_id, project_id, user_id, channel)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, campaignId, projectId, userId, channel || "in_app").run();
  return { id, status: "pending" };
}

export async function markDelivered(env, { projectId, deliveryId }) {
  const info = await env.DB.prepare(
    `UPDATE broadcast_deliveries SET status = 'delivered', delivered_at = datetime('now')
     WHERE project_id = ? AND id = ? AND status = 'pending'`
  ).bind(projectId, deliveryId).run();
  return info.meta?.changes > 0;
}

export async function markRead(env, { projectId, deliveryId }) {
  const info = await env.DB.prepare(
    `UPDATE broadcast_deliveries SET status = 'read', read_at = datetime('now')
     WHERE project_id = ? AND id = ? AND status = 'delivered'`
  ).bind(projectId, deliveryId).run();
  return info.meta?.changes > 0;
}

export async function markFailed(env, { projectId, deliveryId, error }) {
  const info = await env.DB.prepare(
    `UPDATE broadcast_deliveries SET status = 'failed', error = ?
     WHERE project_id = ? AND id = ?`
  ).bind(error || "unknown", projectId, deliveryId).run();
  return info.meta?.changes > 0;
}

export async function listDeliveries(env, { projectId, campaignId, status, limit = 50 }) {
  let query = `SELECT * FROM broadcast_deliveries WHERE project_id = ?`;
  const params = [projectId];
  if (campaignId) { query += ` AND campaign_id = ?`; params.push(campaignId); }
  if (status) { query += ` AND status = ?`; params.push(status); }
  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatDelivery);
}

/* ═══ Analytics ═══ */

export async function getBroadcastStats(env, { projectId, campaignId }) {
  const total = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM broadcast_deliveries WHERE project_id = ? AND campaign_id = ?`
  ).bind(projectId, campaignId).first();
  const byStatus = await env.DB.prepare(
    `SELECT status, COUNT(*) as count FROM broadcast_deliveries
     WHERE project_id = ? AND campaign_id = ? GROUP BY status`
  ).bind(projectId, campaignId).all();
  const byChannel = await env.DB.prepare(
    `SELECT channel, COUNT(*) as count FROM broadcast_deliveries
     WHERE project_id = ? AND campaign_id = ? GROUP BY channel`
  ).bind(projectId, campaignId).all();

  return {
    total: total?.total || 0,
    byStatus: Object.fromEntries((byStatus.results || byStatus).map(r => [r.status, r.count])),
    byChannel: Object.fromEntries((byChannel.results || byChannel).map(r => [r.channel, r.count])),
  };
}

function formatSegment(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name,
    description: row.description, segmentType: row.segment_type,
    rules: JSON.parse(row.rules || "[]"), userCount: row.user_count,
    lastComputedAt: row.last_computed_at, createdAt: row.created_at,
  };
}

function formatCampaign(row) {
  return {
    id: row.id, projectId: row.project_id, segmentId: row.segment_id,
    name: row.name, messageTemplate: row.message_template,
    channel: row.channel, status: row.status, scheduledAt: row.scheduled_at,
    sentAt: row.sent_at, totalRecipients: row.total_recipients,
    delivered: row.delivered, failed: row.failed, createdAt: row.created_at,
  };
}

function formatDelivery(row) {
  return {
    id: row.id, campaignId: row.campaign_id, projectId: row.project_id,
    userId: row.user_id, channel: row.channel, status: row.status,
    sentAt: row.sent_at, deliveredAt: row.delivered_at,
    readAt: row.read_at, error: row.error, createdAt: row.created_at,
  };
}

