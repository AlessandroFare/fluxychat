/**
 * P17-C: Conversation Intelligence + Gap Analytics
 * Tracks unanswered questions, clusters intents, and provides resolution analytics.
 */

const INTELLIGENCE_ROLES = ["owner", "admin", "moderator"];

export function canViewIntelligence(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => INTELLIGENCE_ROLES.includes(r));
}

function generateId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

export function isQuestion(text) {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (trimmed.endsWith("?")) return true;
  const lower = trimmed.toLowerCase();
  if (/^(how|what|why|when|where|who|which|can|could|would|should|is|are|do|does|did|will|has|have)\s/i.test(lower)) return true;
  if (/\b(help|explain|clarify|tell me|show me|figure out)\b/i.test(lower)) return true;
  return false;
}

export function extractIntentLabel(text) {
  if (!text || typeof text !== "string") return "unknown";
  const lower = text.toLowerCase().trim();
  const intentPatterns = [
    { pattern: /\b(bug|error|crash|broken|issue|problem|fail)\b/i, label: "bug_report" },
    { pattern: /\b(how to|how do|how can|help me|tutorial|guide)\b/i, label: "how_to" },
    { pattern: /\b(cancel|unsubscribe|stop|remove|delete)\b/i, label: "cancellation" },
    { pattern: /\b(pricing|cost|price|plan|subscription|billing|invoice|payment)\b/i, label: "billing_inquiry" },
    { pattern: /\b(feature|request|wish|suggest|idea|improvement)\b/i, label: "feature_request" },
    { pattern: /\b(login|sign in|password|reset|access|locked out|auth)\b/i, label: "account_access" },
    { pattern: /\b(status|update|progress|timeline|when|eta)\b/i, label: "status_update" },
    { pattern: /\b(integration|api|webhook|connect|sync|import|export)\b/i, label: "integration" },
    { pattern: /\b(performance|slow|latency|speed|timeout)\b/i, label: "performance" },
    { pattern: /\b(thank|thanks|appreciate|great|awesome|perfect)\b/i, label: "positive_feedback" },
    { pattern: /\b(complain|frustrated|angry|terrible|worst|unacceptable)\b/i, label: "complaint" }
  ];
  for (const { pattern, label } of intentPatterns) {
    if (pattern.test(lower)) return label;
  }
  const words = lower.split(/\s+/).slice(0, 3).join("_");
  return words.length > 30 ? words.slice(0, 30) : words;
}

function mapQuestionRow(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id,
    messageId: row.message_id, userId: row.user_id, questionText: row.question_text,
    answerStatus: row.answer_status, answerMessageId: row.answer_message_id || null,
    answerAgentId: row.answer_agent_id || null, confidence: row.confidence,
    createdAt: row.created_at, answeredAt: row.answered_at || null
  };
}

function mapIntentRow(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id || null,
    intentLabel: row.intent_label, intentDescription: row.intent_description || null,
    frequency: row.frequency,
    sampleMessageIds: (() => { try { return JSON.parse(row.sample_message_ids || "[]"); } catch { return []; } })(),
    firstSeen: row.first_seen, lastSeen: row.last_seen,
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}

function mapSnapshotRow(row) {
  return {
    id: row.id, projectId: row.project_id, snapshotType: row.snapshot_type,
    data: (() => { try { return JSON.parse(row.data); } catch { return {}; } })(),
    periodStart: row.period_start, periodEnd: row.period_end,
    roomId: row.room_id || null, createdAt: row.created_at
  };
}

export async function storeQuestion(db, { projectId, roomId, messageId, userId, questionText }) {
  const id = generateId();
  const createdAt = nowIso();
  const confidence = isQuestion(questionText) ? 0.9 : 0.5;
  await db.prepare(
    `INSERT INTO conversation_questions (id, project_id, room_id, message_id, user_id, question_text, answer_status, confidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'unanswered', ?, ?)`
  ).bind(id, projectId, roomId, messageId, userId, questionText || "", confidence, createdAt).run();
  return { id, createdAt };
}

export async function markQuestionAnswered(db, { projectId, messageId, answerMessageId, answerAgentId }) {
  const now = nowIso();
  const status = answerAgentId ? "answered_by_agent" : "answered_by_ai";
  const result = await db.prepare(
    `UPDATE conversation_questions SET answer_status = ?, answer_message_id = ?, answer_agent_id = ?, answered_at = ?
     WHERE project_id = ? AND message_id = ? AND answer_status = 'unanswered'`
  ).bind(status, answerMessageId || null, answerAgentId || null, now, projectId, messageId).run();
  return result.meta?.changes || 0;
}

export async function markUnansweredQuestions(db, { projectId, roomId, olderThanMinutes = 30 }) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();
  const result = await db.prepare(
    `UPDATE conversation_questions SET answer_status = 'no_answer'
     WHERE project_id = ? AND room_id = ? AND answer_status = 'unanswered' AND created_at < ?`
  ).bind(projectId, roomId, cutoff).run();
  return result.meta?.changes || 0;
}

export async function listQuestions(db, { projectId, roomId, status, limit = 50, offset = 0 }) {
  let where = "project_id = ?";
  const params = [projectId];
  if (roomId) { where += " AND room_id = ?"; params.push(roomId); }
  if (status) { where += " AND answer_status = ?"; params.push(status); }
  params.push(limit, offset);
  const rows = await db.prepare(
    `SELECT * FROM conversation_questions WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params).all();
  return (rows.results || []).map(mapQuestionRow);
}

export async function getQuestionStats(db, { projectId, roomId, periodStart, periodEnd }) {
  let where = "project_id = ?";
  const params = [projectId];
  if (roomId) { where += " AND room_id = ?"; params.push(roomId); }
  if (periodStart) { where += " AND created_at >= ?"; params.push(periodStart); }
  if (periodEnd) { where += " AND created_at <= ?"; params.push(periodEnd); }
  const rows = await db.prepare(
    `SELECT answer_status, COUNT(*) as count, AVG(confidence) as avg_confidence
     FROM conversation_questions WHERE ${where} GROUP BY answer_status`
  ).bind(...params).all();
  const stats = { unanswered: 0, answered_by_agent: 0, answered_by_ai: 0, no_answer: 0, total: 0, avgConfidence: 0 };
  let confSum = 0;
  for (const row of rows.results || []) {
    stats[row.answer_status] = row.count;
    stats.total += row.count;
    confSum += row.avg_confidence * row.count;
  }
  stats.avgConfidence = stats.total > 0 ? confSum / stats.total : 0;
  return stats;
}

/* ── intent clustering ── */

export async function upsertIntentCluster(db, { projectId, roomId, intentLabel, intentDescription, sampleMessageId }) {
  const now = nowIso();
  const existing = await db.prepare(
    `SELECT id, frequency, sample_message_ids FROM intent_clusters
     WHERE project_id = ? AND intent_label = ? AND (room_id = ? OR room_id IS NULL) LIMIT 1`
  ).bind(projectId, intentLabel, roomId || null).first();

  if (existing) {
    const freq = existing.frequency + 1;
    let ids = [];
    try { ids = JSON.parse(existing.sample_message_ids || "[]"); } catch { ids = []; }
    if (sampleMessageId && !ids.includes(sampleMessageId)) {
      ids.push(sampleMessageId);
      if (ids.length > 10) ids = ids.slice(-10);
    }
    await db.prepare(
      `UPDATE intent_clusters SET frequency = ?, sample_message_ids = ?, last_seen = ?, updated_at = ? WHERE id = ?`
    ).bind(freq, JSON.stringify(ids), now, now, existing.id).run();
    return { id: existing.id, frequency: freq, isNew: false };
  }

  const id = generateId();
  const ids = sampleMessageId ? [sampleMessageId] : [];
  await db.prepare(
    `INSERT INTO intent_clusters (id, project_id, room_id, intent_label, intent_description, frequency, sample_message_ids, first_seen, last_seen, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, roomId || null, intentLabel, intentDescription || null, JSON.stringify(ids), now, now, now, now).run();
  return { id, frequency: 1, isNew: true };
}

export async function getIntentClusters(db, { projectId, roomId, limit = 50, offset = 0, minFrequency = 1 }) {
  let where = "project_id = ? AND frequency >= ?";
  const params = [projectId, minFrequency];
  if (roomId) { where += " AND (room_id = ? OR room_id IS NULL)"; params.push(roomId); }
  params.push(limit, offset);
  const rows = await db.prepare(
    `SELECT * FROM intent_clusters WHERE ${where} ORDER BY frequency DESC LIMIT ? OFFSET ?`
  ).bind(...params).all();
  return (rows.results || []).map(mapIntentRow);
}

export async function getTopIntents(db, { projectId, roomId, limit = 10 }) {
  let where = "project_id = ?";
  const params = [projectId];
  if (roomId) { where += " AND (room_id = ? OR room_id IS NULL)"; params.push(roomId); }
  params.push(limit);
  const rows = await db.prepare(
    `SELECT * FROM intent_clusters WHERE ${where} ORDER BY frequency DESC LIMIT ?`
  ).bind(...params).all();
  return (rows.results || []).map(mapIntentRow);
}

/* ── analytics aggregation ── */

export async function getEscalationReasons(db, { projectId, roomId, periodStart, periodEnd }) {
  let where = "project_id = ?";
  const params = [projectId];
  if (roomId) { where += " AND room_id = ?"; params.push(roomId); }
  if (periodStart) { where += " AND created_at >= ?"; params.push(periodStart); }
  if (periodEnd) { where += " AND created_at <= ?"; params.push(periodEnd); }
  const rows = await db.prepare(
    `SELECT escalation_reason, COUNT(*) as count
     FROM conversation_assignments WHERE ${where} AND escalation_reason IS NOT NULL
     GROUP BY escalation_reason ORDER BY count DESC`
  ).bind(...params).all();
  return (rows.results || []).map(r => ({ reason: r.escalation_reason, count: r.count }));
}

export async function getResolutionTimes(db, { projectId, roomId, periodStart, periodEnd }) {
  let where = "project_id = ? AND resolved_at IS NOT NULL";
  const params = [projectId];
  if (roomId) { where += " AND room_id = ?"; params.push(roomId); }
  if (periodStart) { where += " AND created_at >= ?"; params.push(periodStart); }
  if (periodEnd) { where += " AND created_at <= ?"; params.push(periodEnd); }
  const rows = await db.prepare(
    `SELECT created_at, resolved_at, strategy_used FROM conversation_assignments WHERE ${where}`
  ).bind(...params).all();
  const times = [];
  for (const row of rows.results || []) {
    const start = new Date(row.created_at).getTime();
    const end = new Date(row.resolved_at).getTime();
    if (end > start) times.push({ ms: end - start, strategy: row.strategy_used });
  }
  times.sort((a, b) => a.ms - b.ms);
  const count = times.length;
  if (count === 0) return { count: 0, avgMs: 0, medianMs: 0, p95Ms: 0, minMs: 0, maxMs: 0 };
  const sum = times.reduce((s, t) => s + t.ms, 0);
  return {
    count,
    avgMs: sum / count,
    medianMs: times[Math.floor(count / 2)].ms,
    p95Ms: times[Math.floor(count * 0.95)]?.ms || times[count - 1].ms,
    minMs: times[0].ms,
    maxMs: times[count - 1].ms
  };
}

export async function getModerationTrends(db, { projectId, roomId, periodStart, periodEnd }) {
  let where = "project_id = ?";
  const params = [projectId];
  if (roomId) { where += " AND room_id = ?"; params.push(roomId); }
  if (periodStart) { where += " AND created_at >= ?"; params.push(periodStart); }
  if (periodEnd) { where += " AND created_at <= ?"; params.push(periodEnd); }
  const rows = await db.prepare(
    `SELECT severity, COUNT(*) as count FROM ai_moderation_queue WHERE ${where} GROUP BY severity ORDER BY count DESC`
  ).bind(...params).all();
  const categories = await db.prepare(
    `SELECT categories FROM ai_moderation_queue WHERE ${where} AND categories IS NOT NULL`
  ).bind(...params).all();
  const catCounts = {};
  for (const row of categories.results || []) {
    try {
      const arr = JSON.parse(row.categories);
      for (const c of arr) catCounts[c] = (catCounts[c] || 0) + 1;
    } catch { /* skip */ }
  }
  return {
    severityBreakdown: (rows.results || []).map(r => ({ severity: r.severity, count: r.count })),
    categoryBreakdown: Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([category, count]) => ({ category, count }))
  };
}

/* ── snapshot storage ── */

export async function createSnapshot(db, { projectId, snapshotType, data, periodStart, periodEnd, roomId }) {
  const id = generateId();
  const createdAt = nowIso();
  await db.prepare(
    `INSERT INTO intelligence_snapshots (id, project_id, snapshot_type, data, period_start, period_end, room_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, snapshotType, JSON.stringify(data), periodStart, periodEnd, roomId || null, createdAt).run();
  return { id, createdAt };
}

export async function getSnapshots(db, { projectId, snapshotType, roomId, limit = 50 }) {
  let where = "project_id = ?";
  const params = [projectId];
  if (snapshotType) { where += " AND snapshot_type = ?"; params.push(snapshotType); }
  if (roomId) { where += " AND room_id = ?"; params.push(roomId); }
  params.push(limit);
  const rows = await db.prepare(
    `SELECT * FROM intelligence_snapshots WHERE ${where} ORDER BY created_at DESC LIMIT ?`
  ).bind(...params).all();
  return (rows.results || []).map(mapSnapshotRow);
}

export async function generateWeeklyDigest(db, { projectId, periodStart, periodEnd }) {
  const questions = await getQuestionStats(db, { projectId, periodStart, periodEnd });
  const intents = await getTopIntents(db, { projectId, limit: 10 });
  const escalations = await getEscalationReasons(db, { projectId, periodStart, periodEnd });
  const resolution = await getResolutionTimes(db, { projectId, periodStart, periodEnd });
  const moderation = await getModerationTrends(db, { projectId, periodStart, periodEnd });
  return { periodStart, periodEnd, questions, topIntents: intents, escalations, resolutionTimes: resolution, moderationTrends: moderation };
}
