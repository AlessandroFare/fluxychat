function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Tickets ---

export async function createTicket(env, { projectId, subject, description, priority, severity, category, productArea, reportedBy, channel, tags }) {
  const id = `st_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  const last = await env.DB.prepare(
    "SELECT ticket_number FROM support_tickets WHERE project_id = ? ORDER BY ticket_number DESC LIMIT 1"
  ).bind(projectId).first();
  const ticketNumber = (last?.ticket_number || 0) + 1;

  await env.DB.prepare(
    `INSERT INTO support_tickets (id, project_id, ticket_number, subject, description, priority, severity, status, category, product_area, reported_by, channel, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, ticketNumber, subject, description || null, priority || "medium", severity || "normal", category || null, productArea || null, reportedBy, channel || "web", tags ? JSON.stringify(tags) : null, now, now).run();
  return { id, ticketNumber };
}

export async function updateTicket(env, { ticketId, status, priority, severity, assignedTo, assignedGroup, satisfactionRating, satisfactionComment }) {
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const params = [now];
  if (status) { sets.push("status = ?"); params.push(status); if (status === "resolved") { sets.push("resolved_at = ?"); params.push(now); } if (status === "closed") { sets.push("closed_at = ?"); params.push(now); } }
  if (priority) { sets.push("priority = ?"); params.push(priority); }
  if (severity) { sets.push("severity = ?"); params.push(severity); }
  if (assignedTo) { sets.push("assigned_to = ?"); params.push(assignedTo); }
  if (assignedGroup) { sets.push("assigned_group = ?"); params.push(assignedGroup); }
  if (satisfactionRating !== undefined) { sets.push("satisfaction_rating = ?"); params.push(satisfactionRating); }
  if (satisfactionComment) { sets.push("satisfaction_comment = ?"); params.push(satisfactionComment); }
  params.push(ticketId);
  await env.DB.prepare(`UPDATE support_tickets SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
  return { updated: true };
}

export async function getTicket(env, { ticketId }) {
  const row = await env.DB.prepare("SELECT * FROM support_tickets WHERE id = ?").bind(ticketId).first();
  return row ? mapTicketRow(row) : null;
}

export async function getTicketByNumber(env, { projectId, ticketNumber }) {
  const row = await env.DB.prepare(
    "SELECT * FROM support_tickets WHERE project_id = ? AND ticket_number = ?"
  ).bind(projectId, ticketNumber).first();
  return row ? mapTicketRow(row) : null;
}

export async function listTickets(env, { projectId, status, priority, assignedTo, limit = 25 }) {
  let sql = "SELECT * FROM support_tickets WHERE project_id = ?";
  const params = [projectId];
  if (status) { sql += " AND status = ?"; params.push(status); }
  if (priority) { sql += " AND priority = ?"; params.push(priority); }
  if (assignedTo) { sql += " AND assigned_to = ?"; params.push(assignedTo); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapTicketRow);
}

// --- Messages ---

export async function addTicketMessage(env, { ticketId, senderType, senderId, content, isInternal, attachments }) {
  const id = `stm_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO support_ticket_messages (id, ticket_id, sender_type, sender_id, content, is_internal, attachments, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, ticketId, senderType, senderId || null, content, isInternal ? 1 : 0, attachments ? JSON.stringify(attachments) : null, now).run();

  if (senderType === "agent") {
    const ticket = await env.DB.prepare("SELECT first_response_at FROM support_tickets WHERE id = ?").bind(ticketId).first();
    if (!ticket?.first_response_at) {
      await env.DB.prepare("UPDATE support_tickets SET first_response_at = ?, status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END WHERE id = ? AND first_response_at IS NULL").bind(now, ticketId).run();
    }
  }

  return { id };
}

export async function listTicketMessages(env, { ticketId, includeInternal = false }) {
  let sql = "SELECT * FROM support_ticket_messages WHERE ticket_id = ?";
  const params = [ticketId];
  if (!includeInternal) { sql += " AND is_internal = 0"; }
  sql += " ORDER BY created_at ASC";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapMessageRow);
}

// --- SLA Policies ---

export async function createSLAPolicy(env, { projectId, name, priority, responseTimeHours, resolveTimeHours, businessHoursOnly, holidayExcluded }) {
  const id = `ssp_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO support_sla_policies (id, project_id, name, priority, response_time_hours, resolve_time_hours, business_hours_only, holiday_excluded, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, name, priority, responseTimeHours, resolveTimeHours, businessHoursOnly !== undefined ? (businessHoursOnly ? 1 : 0) : 1, holidayExcluded !== undefined ? (holidayExcluded ? 1 : 0) : 1, now, now).run();
  return { id };
}

export async function listSLAPolicies(env, { projectId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM support_sla_policies WHERE project_id = ? ORDER BY priority"
  ).bind(projectId).all();
  return (rows.results || []).map(mapSLARow);
}

// --- Escalation Rules ---

export async function createEscalationRule(env, { projectId, name, conditions, actions, priority }) {
  const id = `ser_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO support_escalation_rules (id, project_id, name, conditions, actions, priority, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).bind(id, projectId, name, JSON.stringify(conditions), JSON.stringify(actions), priority || 0, now, now).run();
  return { id };
}

export async function listEscalationRules(env, { projectId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM support_escalation_rules WHERE project_id = ? AND enabled = 1 ORDER BY priority DESC"
  ).bind(projectId).all();
  return (rows.results || []).map(mapEscalationRow);
}

// --- Knowledge Base ---

export async function createKBArticle(env, { projectId, title, content, category, tags, author }) {
  const id = `skb_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO support_knowledge_base (id, project_id, title, content, category, tags, status, author, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`
  ).bind(id, projectId, title, content, category || null, tags ? JSON.stringify(tags) : null, author || null, now, now).run();
  return { id };
}

export async function updateKBArticle(env, { articleId, title, content, category, tags, status }) {
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const params = [now];
  if (title) { sets.push("title = ?"); params.push(title); }
  if (content) { sets.push("content = ?"); params.push(content); }
  if (category !== undefined) { sets.push("category = ?"); params.push(category); }
  if (tags) { sets.push("tags = ?"); params.push(JSON.stringify(tags)); }
  if (status) { sets.push("status = ?"); params.push(status); }
  params.push(articleId);
  await env.DB.prepare(`UPDATE support_knowledge_base SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
  return { updated: true };
}

export async function listKBArticles(env, { projectId, category, status, search }) {
  let sql = "SELECT * FROM support_knowledge_base WHERE project_id = ?";
  const params = [projectId];
  if (category) { sql += " AND category = ?"; params.push(category); }
  if (status) { sql += " AND status = ?"; params.push(status); }
  if (search) { sql += " AND (title LIKE ? OR tags LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
  sql += " ORDER BY updated_at DESC";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapKBRow);
}

export async function recordKBImpression(env, { articleId, helpful }) {
  const field = helpful ? "helpful_count" : "not_helpful_count";
  await env.DB.prepare(`UPDATE support_knowledge_base SET ${field} = ${field} + 1 WHERE id = ?`).bind(articleId).run();
  return { recorded: true };
}

// --- Satisfaction ---

export async function createSatisfactionSurvey(env, { projectId, ticketId, surveyType }) {
  const id = `sss_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO support_satisfaction_surveys (id, project_id, ticket_id, survey_type, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, projectId, ticketId, surveyType || "post_resolution", now).run();
  return { id };
}

export async function respondToSurvey(env, { surveyId, rating, feedback }) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE support_satisfaction_surveys SET rating = ?, feedback = ?, responded_at = ? WHERE id = ?"
  ).bind(rating, feedback || null, now, surveyId).run();
  return { responded: true };
}

// --- Stats ---

export async function getSupportStats(env, { projectId }) {
  const byStatus = await env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM support_tickets WHERE project_id = ? GROUP BY status"
  ).bind(projectId).all();

  const byPriority = await env.DB.prepare(
    "SELECT priority, COUNT(*) as count FROM support_tickets WHERE project_id = ? GROUP BY priority"
  ).bind(projectId).all();

  const avgSatisfaction = await env.DB.prepare(
    "SELECT AVG(satisfaction_rating) as avg_rating FROM support_tickets WHERE project_id = ? AND satisfaction_rating IS NOT NULL"
  ).bind(projectId).first();

  const avgFirstResponse = await env.DB.prepare(
    "SELECT AVG((julianday(first_response_at) - julianday(created_at)) * 24) as avg_hours FROM support_tickets WHERE project_id = ? AND first_response_at IS NOT NULL"
  ).bind(projectId).first();

  const openCount = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM support_tickets WHERE project_id = ? AND status IN ('open', 'in_progress', 'waiting_customer', 'waiting_internal')"
  ).bind(projectId).first();

  const kbStats = await env.DB.prepare(
    "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published FROM support_knowledge_base WHERE project_id = ?"
  ).bind(projectId).first();

  return {
    byStatus: (byStatus.results || []).map((r) => ({ status: r.status, count: r.count })),
    byPriority: (byPriority.results || []).map((r) => ({ priority: r.priority, count: r.count })),
    avgSatisfaction: avgSatisfaction?.avg_rating || 0,
    avgFirstResponseHours: avgFirstResponse?.avg_hours || 0,
    openTickets: openCount?.count || 0,
    kbArticles: { total: kbStats?.total || 0, published: kbStats?.published || 0 },
  };
}

// --- Helpers ---

function mapTicketRow(row) {
  return {
    id: row.id, projectId: row.project_id, ticketNumber: row.ticket_number,
    subject: row.subject, description: row.description, priority: row.priority,
    severity: row.severity, status: row.status, category: row.category,
    productArea: row.product_area, reportedBy: row.reported_by, assignedTo: row.assigned_to,
    assignedGroup: row.assigned_group, channel: row.channel,
    slaResponseAt: row.sla_response_at, slaResolveAt: row.sla_resolve_at,
    firstResponseAt: row.first_response_at, resolvedAt: row.resolved_at, closedAt: row.closed_at,
    satisfactionRating: row.satisfaction_rating, satisfactionComment: row.satisfaction_comment,
    tags: row.tags ? JSON.parse(row.tags) : null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapMessageRow(row) {
  return {
    id: row.id, ticketId: row.ticket_id, senderType: row.sender_type,
    senderId: row.sender_id, content: row.content, isInternal: row.is_internal === 1,
    attachments: row.attachments ? JSON.parse(row.attachments) : null,
    createdAt: row.created_at,
  };
}

function mapSLARow(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name, priority: row.priority,
    responseTimeHours: row.response_time_hours, resolveTimeHours: row.resolve_time_hours,
    businessHoursOnly: row.business_hours_only === 1, holidayExcluded: row.holiday_excluded === 1,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapEscalationRow(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name,
    conditions: JSON.parse(row.conditions), actions: JSON.parse(row.actions),
    priority: row.priority, enabled: row.enabled === 1,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapKBRow(row) {
  return {
    id: row.id, projectId: row.project_id, title: row.title, content: row.content,
    category: row.category, tags: row.tags ? JSON.parse(row.tags) : null,
    status: row.status, author: row.author, viewCount: row.view_count,
    helpfulCount: row.helpful_count, notHelpfulCount: row.not_helpful_count,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
