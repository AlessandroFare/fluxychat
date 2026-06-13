function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SEVERITY_MAP = { emergency: 0, alert: 1, critical: 2, error: 3, warning: 4, notice: 5, info: 6, debug: 7 };

export function toCEF(events) {
  return events
    .map((e) => {
      const sev = SEVERITY_MAP[e.severity] ?? 6;
      const ts = Math.floor(new Date(e.timestamp).getTime() / 1000);
      const ext = [
        `actor=${e.actor || "system"}`,
        `action=${e.action}`,
        `resource=${e.resourceType || ""}`,
        `resourceId=${e.resourceId || ""}`,
        `projectId=${e.projectId || ""}`,
        `RoomId=${e.roomId || ""}`,
        `msg=${(e.details || "").replace(/\n/g, "\\n").substring(0, 200)}`,
      ].join(" ");
      return `CEF:0|FluxyChat|audit|1.0|${e.action}|${e.action}|${sev}|${ts} ${ext}`;
    })
    .join("\n");
}

export function toSyslog(events) {
  return events
    .map((e) => {
      const ts = new Date(e.timestamp).toISOString();
      return `<${(SEVERITY_MAP[e.severity] ?? 6) + (e.facility || 1) * 8}>${ts} ${e.actor || "system"} ${e.action} ${e.resourceType || ""} ${e.resourceId || ""} ${e.projectId || ""} ${e.details || ""}`;
    })
    .join("\n");
}

export function toLEEF(events) {
  return events
    .map((e) => {
      const sev = SEVERITY_MAP[e.severity] ?? 6;
      const ts = new Date(e.timestamp).getTime();
      const ext = [
        `actor=${e.actor || "system"}`,
        `action=${e.action}`,
        `resourceType=${e.resourceType || ""}`,
        `resourceId=${e.resourceId || ""}`,
        `projectId=${e.projectId || ""}`,
        `roomId=${e.roomId || ""}`,
      ].join("\t");
      return `LEEF:2.0|FluxyChat|audit|1.0|${e.action}|${sev}|${ts}\t${ext}`;
    })
    .join("\n");
}

export async function createExportSchedule(env, { projectId, name, frequency, format, filterActor, filterAction, filterResource, filterSeverity, destinationType, destinationUrl, destinationConfig }) {
  if (!name || !frequency || !destinationType) return { error: "name, frequency, and destinationType are required" };
  const validFreqs = ["daily", "weekly", "monthly"];
  if (!validFreqs.includes(frequency)) return { error: "frequency must be daily, weekly, or monthly" };
  const validDest = ["webhook", "siem", "email"];
  if (!validDest.includes(destinationType)) return { error: "destinationType must be webhook, siem, or email" };

  const id = `aes_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  const nextRun = computeNextRun(frequency);

  await env.DB.prepare(
    `INSERT INTO audit_export_schedules
     (id, project_id, name, frequency, format, filter_actor, filter_action, filter_resource, filter_severity, destination_type, destination_url, destination_config, enabled, next_run_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  )
    .bind(id, projectId, name, frequency, format || "json", filterActor || null, filterAction || null, filterResource || null, filterSeverity || null, destinationType, destinationUrl || null, destinationConfig || null, nextRun, now)
    .run();

  return { id, created: true, nextRun };
}

export async function listExportSchedules(env, { projectId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM audit_export_schedules WHERE project_id = ? ORDER BY created_at DESC"
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapScheduleRow);
}

export async function deleteExportSchedule(env, { id, projectId }) {
  const result = await env.DB.prepare(
    "DELETE FROM audit_export_schedules WHERE id = ? AND project_id = ?"
  )
    .bind(id, projectId)
    .run();
  return { deleted: result.meta?.changes || 0 };
}

export async function toggleExportSchedule(env, { id, enabled }) {
  const result = await env.DB.prepare(
    "UPDATE audit_export_schedules SET enabled = ? WHERE id = ?"
  )
    .bind(enabled ? 1 : 0, id)
    .run();
  return { updated: result.meta?.changes || 0 };
}

export async function queryFilteredAuditEvents(env, { projectId, startTime, endTime, actor, action, resourceType, severity, limit }) {
  let sql = "SELECT * FROM audit_events WHERE project_id = ?";
  const params = [projectId];

  if (startTime) { sql += " AND timestamp >= ?"; params.push(startTime); }
  if (endTime) { sql += " AND timestamp <= ?"; params.push(endTime); }
  if (actor) { sql += " AND actor LIKE ?"; params.push(`%${actor}%`); }
  if (action) { sql += " AND action LIKE ?"; params.push(`%${action}%`); }
  if (resourceType) { sql += " AND resource_type = ?"; params.push(resourceType); }
  if (severity) { sql += " AND severity = ?"; params.push(severity); }

  sql += " ORDER BY timestamp DESC LIMIT ?";
  params.push(limit || 5000);

  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapEventRow);
}

export async function streamExport(env, { projectId, startTime, endTime, filter, format, batchSize }) {
  const size = batchSize || 1000;
  let offset = 0;
  const allEvents = [];

  while (true) {
    const rows = await env.DB.prepare(
      `SELECT * FROM audit_events WHERE project_id = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC LIMIT ? OFFSET ?`
    )
      .bind(projectId, startTime, endTime, size, offset)
      .all();

    const batch = (rows.results || []).map(mapEventRow);
    allEvents.push(...batch);

    if (batch.length < size) break;
    offset += size;
  }

  if (format === "cef") return toCEF(allEvents);
  if (format === "syslog") return toSyslog(allEvents);
  if (format === "leef") return toLEEF(allEvents);
  return JSON.stringify(allEvents, null, 2);
}

export async function recordExportRun(env, { scheduleId, projectId, status, eventCount, error }) {
  const id = `aer_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO audit_export_runs (id, schedule_id, project_id, status, event_count, error, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(id, scheduleId, projectId, status || "pending", eventCount || 0, error || null, now, status === "completed" ? now : null)
    .run();

  await env.DB.prepare(
    "UPDATE audit_export_schedules SET last_run_at = ?, next_run_at = ? WHERE id = ?"
  )
    .bind(now, computeNextRun("daily"), scheduleId)
    .run();

  return { id };
}

export async function getExportRuns(env, { projectId, limit }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM audit_export_runs WHERE project_id = ? ORDER BY started_at DESC LIMIT ?"
  )
    .bind(projectId, limit || 20)
    .all();
  return (rows.results || []).map(mapRunRow);
}

export async function getAuditStats(env, { projectId, startTime, endTime }) {
  let sql = "SELECT action, COUNT(*) as count, severity FROM audit_events WHERE project_id = ?";
  const params = [projectId];
  if (startTime) { sql += " AND timestamp >= ?"; params.push(startTime); }
  if (endTime) { sql += " AND timestamp <= ?"; params.push(endTime); }
  sql += " GROUP BY action, severity";

  const rows = await env.DB.prepare(sql).bind(...params).all();
  const byAction = {};
  const bySeverity = {};
  for (const r of rows.results || []) {
    byAction[r.action] = (byAction[r.action] || 0) + r.count;
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + r.count;
  }
  return { byAction, bySeverity, totalEvents: Object.values(byAction).reduce((s, c) => s + c, 0) };
}

function computeNextRun(frequency) {
  const now = new Date();
  if (frequency === "daily") now.setDate(now.getDate() + 1);
  else if (frequency === "weekly") now.setDate(now.getDate() + 7);
  else now.setMonth(now.getMonth() + 1);
  now.setHours(2, 0, 0, 0);
  return now.toISOString();
}

function mapScheduleRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    frequency: row.frequency,
    format: row.format,
    filterActor: row.filter_actor,
    filterAction: row.filter_action,
    filterResource: row.filter_resource,
    filterSeverity: row.filter_severity,
    destinationType: row.destination_type,
    destinationUrl: row.destination_url,
    enabled: row.enabled === 1,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
    createdAt: row.created_at,
  };
}

function mapEventRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    actor: row.actor,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    roomId: row.room_id,
    details: row.details,
    severity: row.severity,
    timestamp: row.timestamp,
  };
}

function mapRunRow(row) {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    projectId: row.project_id,
    status: row.status,
    eventCount: row.event_count,
    error: row.error,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}
