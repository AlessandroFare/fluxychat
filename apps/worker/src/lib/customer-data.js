function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Customer Profiles ---

export async function upsertCustomer(env, { projectId, externalId, email, name, phone, avatarUrl, attributes, lifecycleStage, tags }) {
  const id = `cp_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  const existing = await env.DB.prepare(
    "SELECT id FROM customer_profiles WHERE project_id = ? AND external_id = ?"
  ).bind(projectId, externalId).first();

  if (existing) {
    const sets = ["updated_at = ?", "last_seen_at = ?"];
    const params = [now, now];
    if (email) { sets.push("email = ?"); params.push(email); }
    if (name) { sets.push("name = ?"); params.push(name); }
    if (phone) { sets.push("phone = ?"); params.push(phone); }
    if (avatarUrl) { sets.push("avatar_url = ?"); params.push(avatarUrl); }
    if (attributes) { sets.push("attributes = ?"); params.push(JSON.stringify(attributes)); }
    if (lifecycleStage) { sets.push("lifecycle_stage = ?"); params.push(lifecycleStage); }
    if (tags) { sets.push("tags = ?"); params.push(JSON.stringify(tags)); }
    params.push(existing.id);
    await env.DB.prepare(`UPDATE customer_profiles SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
    return { id: existing.id, updated: true };
  }

  await env.DB.prepare(
    `INSERT INTO customer_profiles (id, project_id, external_id, email, name, phone, avatar_url, attributes, lifecycle_stage, tags, first_seen_at, last_seen_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, externalId, email || null, name || null, phone || null, avatarUrl || null, attributes ? JSON.stringify(attributes) : null, lifecycleStage || "lead", tags ? JSON.stringify(tags) : null, now, now, now, now).run();
  return { id, created: true };
}

export async function getCustomer(env, { projectId, externalId }) {
  const row = await env.DB.prepare(
    "SELECT * FROM customer_profiles WHERE project_id = ? AND external_id = ?"
  ).bind(projectId, externalId).first();
  return row ? mapProfileRow(row) : null;
}

export async function getCustomerById(env, { customerId, projectId }) {
  let sql = "SELECT * FROM customer_profiles WHERE id = ?";
  const params = [customerId];
  if (projectId) { sql += " AND project_id = ?"; params.push(projectId); }
  const row = await env.DB.prepare(sql).bind(...params).first();
  return row ? mapProfileRow(row) : null;
}

export async function listCustomers(env, { projectId, lifecycleStage, search, limit = 25, offset = 0 }) {
  let sql = "SELECT * FROM customer_profiles WHERE project_id = ?";
  const params = [projectId];
  if (lifecycleStage) { sql += " AND lifecycle_stage = ?"; params.push(lifecycleStage); }
  if (search) { sql += " AND (name LIKE ? OR email LIKE ? OR external_id LIKE ?)"; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  sql += " ORDER BY last_seen_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapProfileRow);
}

export async function updateCustomerScore(env, { customerId, projectId, score }) {
  const now = new Date().toISOString();
  let sql = "UPDATE customer_profiles SET score = ?, updated_at = ? WHERE id = ?";
  const params = [score, now, customerId];
  if (projectId) { sql += " AND project_id = ?"; params.push(projectId); }
  await env.DB.prepare(sql).bind(...params).run();
  return { updated: true };
}

// --- Customer Events ---

export async function trackEvent(env, { projectId, customerId, eventType, eventName, properties, roomId, sessionId, ipAddress, userAgent }) {
  const id = `ce_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO customer_events (id, project_id, customer_id, event_type, event_name, properties, room_id, session_id, ip_address, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, customerId, eventType, eventName, properties ? JSON.stringify(properties) : null, roomId || null, sessionId || null, ipAddress || null, userAgent || null, now).run();

  await env.DB.prepare("UPDATE customer_profiles SET last_seen_at = ?, updated_at = ? WHERE id = ?").bind(now, now, customerId).run();
  return { id };
}

export async function listCustomerEvents(env, { customerId, projectId, eventType, eventName, limit = 50 }) {
  let sql = "SELECT * FROM customer_events WHERE customer_id = ?";
  const params = [customerId];
  if (projectId) { sql += " AND project_id = ?"; params.push(projectId); }
  if (eventType) { sql += " AND event_type = ?"; params.push(eventType); }
  if (eventName) { sql += " AND event_name = ?"; params.push(eventName); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapEventRow);
}

export async function getEventCounts(env, { projectId, eventName, days = 30 }) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const rows = await env.DB.prepare(
    "SELECT event_name, COUNT(*) as count FROM customer_events WHERE project_id = ? AND created_at >= ? GROUP BY event_name ORDER BY count DESC LIMIT 20"
  ).bind(projectId, since).all();
  return (rows.results || []).map((r) => ({ eventName: r.event_name, count: r.count }));
}

// --- Segments ---

export async function createSegment(env, { projectId, name, description, segmentType, rules }) {
  const id = `csg_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO customer_segments (id, project_id, name, description, segment_type, rules, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`
  ).bind(id, projectId, name, description || null, segmentType || "dynamic", rules ? JSON.stringify(rules) : null, now, now).run();
  return { id };
}

export async function updateSegment(env, { segmentId, projectId, name, description, rules, status }) {
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const params = [now];
  if (name) { sets.push("name = ?"); params.push(name); }
  if (description !== undefined) { sets.push("description = ?"); params.push(description); }
  if (rules) { sets.push("rules = ?"); params.push(JSON.stringify(rules)); }
  if (status) { sets.push("status = ?"); params.push(status); }
  let where = "WHERE id = ?";
  params.push(segmentId);
  if (projectId) { where += " AND project_id = ?"; params.push(projectId); }
  await env.DB.prepare(`UPDATE customer_segments SET ${sets.join(", ")} ${where}`).bind(...params).run();
  return { updated: true };
}

export async function getSegment(env, { segmentId, projectId }) {
  let sql = "SELECT * FROM customer_segments WHERE id = ?";
  const params = [segmentId];
  if (projectId) { sql += " AND project_id = ?"; params.push(projectId); }
  const row = await env.DB.prepare(sql).bind(...params).first();
  return row ? mapSegmentRow(row) : null;
}

export async function listSegments(env, { projectId, status }) {
  let sql = "SELECT * FROM customer_segments WHERE project_id = ?";
  const params = [projectId];
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY name";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapSegmentRow);
}

export async function addSegmentMember(env, { segmentId, projectId, customerId }) {
  if (projectId) {
    const seg = await env.DB.prepare("SELECT id FROM customer_segments WHERE id = ? AND project_id = ?").bind(segmentId, projectId).first();
    if (!seg) return { error: "segment_not_found" };
  }
  const id = `csm_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO customer_segment_members (id, segment_id, customer_id, added_at) VALUES (?, ?, ?, ?)"
  ).bind(id, segmentId, customerId, now).run();

  await env.DB.prepare(
    "UPDATE customer_segments SET customer_count = customer_count + 1, updated_at = ? WHERE id = ?"
  ).bind(now, segmentId).run();

  return { id };
}

export async function removeSegmentMember(env, { segmentId, projectId, customerId }) {
  if (projectId) {
    const seg = await env.DB.prepare("SELECT id FROM customer_segments WHERE id = ? AND project_id = ?").bind(segmentId, projectId).first();
    if (!seg) return { removed: 0 };
  }
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    "DELETE FROM customer_segment_members WHERE segment_id = ? AND customer_id = ?"
  ).bind(segmentId, customerId).run();

  if (result.meta?.changes > 0) {
    await env.DB.prepare(
      "UPDATE customer_segments SET customer_count = customer_count - 1, updated_at = ? WHERE id = ?"
    ).bind(now, segmentId).run();
  }

  return { removed: result.meta?.changes || 0 };
}

export async function listSegmentMembers(env, { segmentId, projectId, limit = 100 }) {
  let sql = `SELECT p.* FROM customer_profiles p
     JOIN customer_segment_members m ON p.id = m.customer_id
     WHERE m.segment_id = ?`;
  const params = [segmentId];
  if (projectId) { sql += " AND p.project_id = ?"; params.push(projectId); }
  sql += " ORDER BY m.added_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapProfileRow);
}

// --- Broadcasts ---

export async function createBroadcast(env, { projectId, name, segmentId, channel, content, contentType, templateId, createdBy }) {
  const id = `cb_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO customer_broadcasts (id, project_id, name, segment_id, channel, content, content_type, template_id, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`
  ).bind(id, projectId, name, segmentId || null, channel || "room", content, contentType || "text", templateId || null, createdBy || null, now, now).run();
  return { id };
}

export async function updateBroadcast(env, { broadcastId, projectId, status, scheduledAt }) {
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const params = [now];
  if (status) { sets.push("status = ?"); params.push(status); if (status === "sent") { sets.push("sent_at = ?"); params.push(now); } }
  if (scheduledAt) { sets.push("scheduled_at = ?"); params.push(scheduledAt); }
  let where = "WHERE id = ?";
  params.push(broadcastId);
  if (projectId) { where += " AND project_id = ?"; params.push(projectId); }
  await env.DB.prepare(`UPDATE customer_broadcasts SET ${sets.join(", ")} ${where}`).bind(...params).run();
  return { updated: true };
}

export async function listBroadcasts(env, { projectId, status }) {
  let sql = "SELECT * FROM customer_broadcasts WHERE project_id = ?";
  const params = [projectId];
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY created_at DESC";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapBroadcastRow);
}

export async function addBroadcastRecipient(env, { broadcastId, customerId }) {
  const id = `cbr_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO customer_broadcast_recipients (id, broadcast_id, customer_id, status, created_at)
     VALUES (?, ?, ?, 'pending', ?)`
  ).bind(id, broadcastId, customerId, now).run();
  return { id };
}

export async function updateBroadcastRecipient(env, { recipientId, status, error }) {
  const now = new Date().toISOString();
  const sets = ["status = ?"];
  const params = [status];
  if (status === "sent") { sets.push("sent_at = ?"); params.push(now); }
  if (status === "delivered") { sets.push("delivered_at = ?"); params.push(now); }
  if (error) { sets.push("error = ?"); params.push(error); }
  params.push(recipientId);
  await env.DB.prepare(`UPDATE customer_broadcast_recipients SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
  return { updated: true };
}

// --- Properties ---

export async function defineProperty(env, { projectId, propertyName, propertyType, description, isRequired, defaultValue }) {
  const id = `cpr_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO customer_properties (id, project_id, property_name, property_type, description, is_required, default_value, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, propertyName, propertyType || "string", description || null, isRequired ? 1 : 0, defaultValue || null, now).run();
  return { id };
}

export async function listProperties(env, { projectId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM customer_properties WHERE project_id = ? ORDER BY property_name"
  ).bind(projectId).all();
  return (rows.results || []).map(mapPropertyRow);
}

// --- Stats ---

export async function getCustomerStats(env, { projectId }) {
  const total = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM customer_profiles WHERE project_id = ?"
  ).bind(projectId).first();

  const byLifecycle = await env.DB.prepare(
    "SELECT lifecycle_stage, COUNT(*) as count FROM customer_profiles WHERE project_id = ? GROUP BY lifecycle_stage"
  ).bind(projectId).all();

  const recentEvents = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM customer_events WHERE project_id = ? AND created_at >= ?"
  ).bind(projectId, new Date(Date.now() - 7 * 86400000).toISOString()).first();

  const segments = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM customer_segments WHERE project_id = ? AND status = 'active'"
  ).bind(projectId).first();

  const broadcasts = await env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM customer_broadcasts WHERE project_id = ? GROUP BY status"
  ).bind(projectId).all();

  return {
    totalCustomers: total?.count || 0,
    byLifecycle: (byLifecycle.results || []).map((r) => ({ stage: r.lifecycle_stage, count: r.count })),
    recentEvents: recentEvents?.count || 0,
    activeSegments: segments?.count || 0,
    broadcasts: (broadcasts.results || []).map((b) => ({ status: b.status, count: b.count })),
  };
}

// --- Helpers ---

function mapProfileRow(row) {
  return {
    id: row.id, projectId: row.project_id, externalId: row.external_id,
    email: row.email, name: row.name, phone: row.phone, avatarUrl: row.avatar_url,
    attributes: row.attributes ? JSON.parse(row.attributes) : null,
    segmentIds: row.segment_ids ? JSON.parse(row.segment_ids) : null,
    lifecycleStage: row.lifecycle_stage, score: row.score,
    tags: row.tags ? JSON.parse(row.tags) : null,
    firstSeenAt: row.first_seen_at, lastSeenAt: row.last_seen_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapEventRow(row) {
  return {
    id: row.id, projectId: row.project_id, customerId: row.customer_id,
    eventType: row.event_type, eventName: row.event_name,
    properties: row.properties ? JSON.parse(row.properties) : null,
    roomId: row.room_id, sessionId: row.session_id,
    ipAddress: row.ip_address, userAgent: row.user_agent, createdAt: row.created_at,
  };
}

function mapSegmentRow(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name, description: row.description,
    segmentType: row.segment_type, rules: row.rules ? JSON.parse(row.rules) : null,
    customerCount: row.customer_count, status: row.status,
    lastBuiltAt: row.last_built_at, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapBroadcastRow(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name, segmentId: row.segment_id,
    channel: row.channel, content: row.content, contentType: row.content_type,
    templateId: row.template_id, status: row.status, scheduledAt: row.scheduled_at,
    sentAt: row.sent_at, recipientCount: row.recipient_count,
    deliveredCount: row.delivered_count, failedCount: row.failed_count,
    createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapPropertyRow(row) {
  return {
    id: row.id, projectId: row.project_id, propertyName: row.property_name,
    propertyType: row.property_type, description: row.description,
    isRequired: row.is_required === 1, defaultValue: row.default_value, createdAt: row.created_at,
  };
}
