/**
 * P20-A: Incident Response Rooms — ops-grade incident management.
 *
 * Features:
 *   • Incident lifecycle: open → acknowledged → resolved → closed
 *   • Severity levels: sev1 (critical), sev2 (high), sev3 (medium), sev4 (low)
 *   • Commander assignment + on-call rotation
 *   • Alert ingestion from external sources (PagerDuty, OpsGenie, custom)
 *   • Real-time timeline of updates
 *   • Postmortem workflow (root cause, action items)
 *   • MTTR analytics (mean time to resolve)
 *   • MTTA analytics (mean time to acknowledge)
 */

const INCIDENT_STATUS = ["open", "acknowledged", "investigating", "resolved", "closed"];
const SEVERITY_LEVELS = ["sev1", "sev2", "sev3", "sev4"];
const UPDATE_TYPES = ["comment", "status_change", "severity_change", "assignment", "alert", "resolution"];

export async function createIncident(env, {
  projectId, roomId, title, description, severity, commanderId,
  alertSource, alertId, environment, service,
}) {
  if (!SEVERITY_LEVELS.includes(severity || "sev3")) throw new Error(`Invalid severity: ${severity}`);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO incidents (id, project_id, room_id, title, description, severity,
     commander_id, alert_source, alert_id, environment, service, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, roomId, title, description || null,
    severity || "sev3", commanderId || null,
    alertSource || null, alertId || null,
    environment || null, service || null, now).run();
  return { id, title, severity: severity || "sev3", status: "open", startedAt: now };
}

export async function getIncident(env, { projectId, incidentId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM incidents WHERE project_id = ? AND id = ?`
  ).bind(projectId, incidentId).first();
  return row ? formatIncident(row) : null;
}

export async function listIncidents(env, { projectId, roomId, status, severity, limit = 50 }) {
  let query = `SELECT * FROM incidents WHERE project_id = ?`;
  const params = [projectId];
  if (roomId) { query += ` AND room_id = ?`; params.push(roomId); }
  if (status) { query += ` AND status = ?`; params.push(status); }
  if (severity) { query += ` AND severity = ?`; params.push(severity); }
  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatIncident);
}

export async function updateIncident(env, {
  projectId, incidentId, status, severity, commanderId, oncallUserId,
}) {
  const incident = await getIncident(env, { projectId, incidentId });
  if (!incident) throw new Error("Incident not found");
  const sets = [];
  const params = [];
  if (status) {
    sets.push("status = ?");
    params.push(status);
    if (status === "acknowledged") sets.push("acknowledged_at = datetime('now')");
    if (status === "resolved") {
      sets.push("resolved_at = datetime('now')");
      const mttr = Math.round((Date.now() - new Date(incident.startedAt).getTime()) / 1000);
      sets.push("mttr_seconds = ?");
      params.push(mttr);
    }
    if (status === "closed") sets.push("closed_at = datetime('now')");
  }
  if (severity) { sets.push("severity = ?"); params.push(severity); }
  if (commanderId) { sets.push("commander_id = ?"); params.push(commanderId); }
  if (oncallUserId) { sets.push("oncall_user_id = ?"); params.push(oncallUserId); }
  if (sets.length === 0) return incident;
  params.push(projectId, incidentId);
  await env.DB.prepare(
    `UPDATE incidents SET ${sets.join(", ")} WHERE project_id = ? AND id = ?`
  ).bind(...params).run();
  return getIncident(env, { projectId, incidentId });
}

export async function addIncidentUpdate(env, {
  projectId, incidentId, userId, updateType, content, metadata,
}) {
  if (!UPDATE_TYPES.includes(updateType || "comment")) throw new Error(`Invalid update type: ${updateType}`);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO incident_updates (id, incident_id, project_id, user_id, update_type, content, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, incidentId, projectId, userId, updateType || "comment",
    content, JSON.stringify(metadata || {})).run();
  return { id, updateType: updateType || "comment", content };
}

export async function getIncidentTimeline(env, { projectId, incidentId }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM incident_updates WHERE project_id = ? AND incident_id = ?
     ORDER BY created_at ASC`
  ).bind(projectId, incidentId).all();
  return results.map(formatUpdate);
}

/* ═══ Alert Ingestion ═══ */

export async function ingestAlert(env, {
  projectId, roomId, source, alertType, title, payload,
}) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO incident_alerts (id, project_id, room_id, source, alert_type, title, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, roomId, source, alertType, title, JSON.stringify(payload || {})).run();
  return { id, source, alertType, title, status: "new" };
}

export async function acknowledgeAlert(env, { projectId, alertId, userId }) {
  const info = await env.DB.prepare(
    `UPDATE incident_alerts SET status = 'acknowledged', acknowledged_by = ?
     WHERE project_id = ? AND id = ? AND status = 'new'`
  ).bind(userId, projectId, alertId).run();
  return info.meta?.changes > 0;
}

export async function linkAlertToIncident(env, { projectId, alertId, incidentId }) {
  const info = await env.DB.prepare(
    `UPDATE incident_alerts SET incident_id = ? WHERE project_id = ? AND id = ?`
  ).bind(incidentId, projectId, alertId).run();
  return info.meta?.changes > 0;
}

export async function listAlerts(env, { projectId, roomId, status, limit = 50 }) {
  let query = `SELECT * FROM incident_alerts WHERE project_id = ?`;
  const params = [projectId];
  if (roomId) { query += ` AND room_id = ?`; params.push(roomId); }
  if (status) { query += ` AND status = ?`; params.push(status); }
  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatAlert);
}

/* ═══ Postmortem ═══ */

export async function setPostmortem(env, {
  projectId, incidentId, postmortem, rootCause, actionItems,
}) {
  const sets = [];
  const params = [];
  if (postmortem) { sets.push("postmortem = ?"); params.push(postmortem); }
  if (rootCause) { sets.push("root_cause = ?"); params.push(rootCause); }
  if (actionItems) { sets.push("action_items = ?"); params.push(JSON.stringify(actionItems)); }
  if (sets.length === 0) return null;
  params.push(projectId, incidentId);
  await env.DB.prepare(
    `UPDATE incidents SET ${sets.join(", ")} WHERE project_id = ? AND id = ?`
  ).bind(...params).run();
  return getIncident(env, { projectId, incidentId });
}

/* ═══ Analytics ═══ */

export async function getIncidentStats(env, { projectId }) {
  const total = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM incidents WHERE project_id = ?`
  ).bind(projectId).first();
  const bySeverity = await env.DB.prepare(
    `SELECT severity, COUNT(*) as count FROM incidents WHERE project_id = ? GROUP BY severity`
  ).bind(projectId).all();
  const byStatus = await env.DB.prepare(
    `SELECT status, COUNT(*) as count FROM incidents WHERE project_id = ? GROUP BY status`
  ).bind(projectId).all();
  const avgMttr = await env.DB.prepare(
    `SELECT AVG(mttr_seconds) as avg_mttr FROM incidents WHERE project_id = ? AND mttr_seconds IS NOT NULL`
  ).bind(projectId).first();
  const avgMtta = await env.DB.prepare(
    `SELECT AVG((julianday(acknowledged_at) - julianday(started_at)) * 86400) as avg_mtta
     FROM incidents WHERE project_id = ? AND acknowledged_at IS NOT NULL`
  ).bind(projectId).first();

  return {
    total: total?.total || 0,
    bySeverity: Object.fromEntries((bySeverity.results || bySeverity).map(r => [r.severity, r.count])),
    byStatus: Object.fromEntries((byStatus.results || byStatus).map(r => [r.status, r.count])),
    avgMttrSeconds: avgMttr?.avg_mttr ? Math.round(avgMttr.avg_mttr) : null,
    avgMttaSeconds: avgMtta?.avg_mtta ? Math.round(avgMtta.avg_mtta) : null,
  };
}

function formatIncident(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id,
    title: row.title, description: row.description, severity: row.severity,
    status: row.status, commanderId: row.commander_id,
    oncallUserId: row.oncall_user_id,
    alertSource: row.alert_source, alertId: row.alert_id,
    environment: row.environment, service: row.service,
    startedAt: row.started_at, acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at, closedAt: row.closed_at,
    postmortem: row.postmortem, rootCause: row.root_cause,
    actionItems: JSON.parse(row.action_items || "[]"),
    timeline: JSON.parse(row.timeline || "[]"),
    mttrSeconds: row.mttr_seconds, createdAt: row.created_at,
  };
}

function formatUpdate(row) {
  return {
    id: row.id, incidentId: row.incident_id, projectId: row.project_id,
    userId: row.user_id, updateType: row.update_type,
    content: row.content, metadata: JSON.parse(row.metadata || "{}"),
    createdAt: row.created_at,
  };
}

function formatAlert(row) {
  return {
    id: row.id, incidentId: row.incident_id, projectId: row.project_id,
    roomId: row.room_id, source: row.source, alertType: row.alert_type,
    title: row.title, payload: JSON.parse(row.payload || "{}"),
    status: row.status, acknowledgedBy: row.acknowledged_by,
    createdAt: row.created_at,
  };
}
