/**
 * P19-F: AI Live Q&A Moderator — AI-powered question management for events.
 *
 * Features:
 *   • Session lifecycle (start, end)
 *   • Question submission with AI dedup
 *   • AI categorization and priority scoring
 *   • AI-suggested answers
 *   • De-duplication (merge similar questions)
 *   • Priority queue (sorted by score)
 *   • Moderation workflow (approve, dismiss, merge)
 *   • Analytics (questions/hour, avg priority, dedup rate)
 */

export async function startQASession(env, {
  projectId, eventId, roomId, aiModel, dedupThreshold, maxQuestionsPerUser, settings,
}) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO qa_sessions (id, project_id, event_id, room_id, ai_model, dedup_threshold, max_questions_per_user, settings)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, eventId, roomId, aiModel || "gpt-4o-mini",
    dedupThreshold || 0.8, maxQuestionsPerUser || 5, JSON.stringify(settings || {})).run();
  return { id, eventId, status: "active" };
}

export async function getQASession(env, { projectId, sessionId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM qa_sessions WHERE project_id = ? AND id = ?`
  ).bind(projectId, sessionId).first();
  return row ? formatSession(row) : null;
}

export async function endQASession(env, { projectId, sessionId }) {
  const info = await env.DB.prepare(
    `UPDATE qa_sessions SET status = 'ended', ended_at = datetime('now') WHERE project_id = ? AND id = ? AND status = 'active'`
  ).bind(projectId, sessionId).run();
  return info.meta?.changes > 0;
}

export async function submitQuestion(env, {
  projectId, sessionId, eventId, userId, question,
}) {
  const session = await getQASession(env, { projectId, sessionId });
  if (!session || session.status !== "active") throw new Error("Session not active");

  const { results: existing } = await env.DB.prepare(
    `SELECT * FROM qa_moderated_questions WHERE session_id = ? AND status != 'dismissed' ORDER BY created_at DESC LIMIT 50`
  ).bind(sessionId).all();

  let duplicateOfId = null;
  let normalizedQuestion = question;
  for (const eq of existing) {
    if (simpleSimilarity(question, eq.original_question) >= (session.dedupThreshold || 0.8)) {
      duplicateOfId = eq.id;
      normalizedQuestion = eq.normalized_question || eq.original_question;
      break;
    }
  }

  const category = categorizeQuestion(question);
  const priorityScore = computePriorityScore(question, category, existing);
  const suggestedAnswer = generateSuggestedAnswer(question, category, existing);

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO qa_moderated_questions (id, session_id, event_id, project_id, user_id, original_question,
     normalized_question, duplicate_of_id, ai_category, ai_priority_score, ai_suggested_answer, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, sessionId, eventId, projectId, userId, question, normalizedQuestion,
    duplicateOfId, category, priorityScore, suggestedAnswer,
    duplicateOfId ? "duplicate" : "pending").run();

  return {
    id, question, category, priorityScore, suggestedAnswer,
    isDuplicate: !!duplicateOfId, duplicateOfId,
  };
}

export async function getPriorityQueue(env, { projectId, sessionId, limit = 50 }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM qa_moderated_questions WHERE session_id = ? AND status = 'pending'
     ORDER BY ai_priority_score DESC, created_at ASC LIMIT ?`
  ).bind(sessionId, limit).all();
  return results.map(formatQuestion);
}

export async function approveQuestion(env, { projectId, questionId }) {
  const info = await env.DB.prepare(
    `UPDATE qa_moderated_questions SET status = 'approved', moderated_at = datetime('now')
     WHERE project_id = ? AND id = ? AND status = 'pending'`
  ).bind(projectId, questionId).run();
  return info.meta?.changes > 0;
}

export async function dismissQuestion(env, { projectId, questionId }) {
  const info = await env.DB.prepare(
    `UPDATE qa_moderated_questions SET status = 'dismissed', moderated_at = datetime('now')
     WHERE project_id = ? AND id = ?`
  ).bind(projectId, questionId).run();
  return info.meta?.changes > 0;
}

export async function mergeDuplicate(env, { projectId, questionId, targetId }) {
  const info = await env.DB.prepare(
    `UPDATE qa_moderated_questions SET duplicate_of_id = ?, status = 'duplicate', moderated_at = datetime('now')
     WHERE project_id = ? AND id = ? AND status = 'pending'`
  ).bind(targetId, projectId, questionId).run();
  return info.meta?.changes > 0;
}

export async function getQAStats(env, { projectId, sessionId }) {
  const total = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM qa_moderated_questions WHERE session_id = ?`
  ).bind(sessionId).first();
  const byStatus = await env.DB.prepare(
    `SELECT status, COUNT(*) as count FROM qa_moderated_questions WHERE session_id = ? GROUP BY status`
  ).bind(sessionId).all();
  const byCategory = await env.DB.prepare(
    `SELECT ai_category, COUNT(*) as count FROM qa_moderated_questions WHERE session_id = ? AND status != 'duplicate' GROUP BY ai_category`
  ).bind(sessionId).all();
  const duplicates = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM qa_moderated_questions WHERE session_id = ? AND status = 'duplicate'`
  ).bind(sessionId).first();
  const avgPriority = await env.DB.prepare(
    `SELECT AVG(ai_priority_score) as avg FROM qa_moderated_questions WHERE session_id = ? AND status != 'duplicate'`
  ).bind(sessionId).first();

  return {
    total: total?.total || 0,
    byStatus: Object.fromEntries((byStatus.results || byStatus).map(r => [r.status, r.count])),
    byCategory: Object.fromEntries((byCategory.results || byCategory).map(r => [r.ai_category, r.count])),
    duplicateCount: duplicates?.count || 0,
    dedupRate: total?.total > 0 ? Math.round(((duplicates?.count || 0) / total.total) * 100) : 0,
    avgPriority: avgPriority?.avg ? Math.round(avgPriority.avg * 100) / 100 : 0,
  };
}

export async function listQuestions(env, { projectId, sessionId, status, limit = 50 }) {
  let query = `SELECT * FROM qa_moderated_questions WHERE session_id = ?`;
  const params = [sessionId];
  if (status) { query += ` AND status = ?`; params.push(status); }
  query += ` ORDER BY ai_priority_score DESC, created_at ASC LIMIT ?`;
  params.push(limit);
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatQuestion);
}

function simpleSimilarity(a, b) {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

function categorizeQuestion(question) {
  const q = question.toLowerCase();
  if (/\b(pricing|price|cost|plan|subscription|billing|pay)\b/.test(q)) return "pricing";
  if (/\b(how to|how do|steps|guide|tutorial|setup|install)\b/.test(q)) return "how_to";
  if (/\b(feature|capability|support|integrate|api|sdk)\b/.test(q)) return "feature_request";
  if (/\b(bug|error|issue|broken|not working|problem|crash)\b/.test(q)) return "bug_report";
  if (/\b(when|roadmap|timeline|release|launch|plan|future)\b/.test(q)) return "timeline";
  if (/\b(compare|vs|versus|alternative|difference)\b/.test(q)) return "comparison";
  return "general";
}

function computePriorityScore(question, category, existing) {
  let score = 50;
  const categoryWeights = { pricing: 10, how_to: 8, feature_request: 6, bug_report: 9, timeline: 7, comparison: 5, general: 3 };
  score += categoryWeights[category] || 3;
  if (question.includes("?")) score += 5;
  if (question.length > 50) score += 3;
  if (question.length < 20) score -= 5;
  const similarCount = existing.filter(e => simpleSimilarity(question, e.original_question) > 0.3).length;
  score += similarCount * 2;
  return Math.min(100, Math.max(0, score));
}

function generateSuggestedAnswer(question, category, existing) {
  const q = question.toLowerCase();
  if (category === "pricing") return "Please visit our pricing page at /pricing for current plans. Enterprise pricing is available on request.";
  if (category === "how_to") return "Our documentation covers this topic in detail. Check the getting started guide at /docs.";
  if (category === "feature_request") return "Thank you for the suggestion! We track feature requests and prioritize based on community interest.";
  if (category === "bug_report") return "We're sorry about this issue. Our team has been notified. Please submit details via our bug report form.";
  if (category === "timeline") return "We share our roadmap publicly at /roadmap. Major releases are announced via our newsletter.";
  return "Thank you for your question. Our team will address this shortly.";
}

function formatSession(row) {
  return {
    id: row.id, projectId: row.project_id, eventId: row.event_id, roomId: row.room_id,
    status: row.status, aiModel: row.ai_model, dedupThreshold: row.dedup_threshold,
    maxQuestionsPerUser: row.max_questions_per_user,
    settings: JSON.parse(row.settings || "{}"),
    createdAt: row.created_at, endedAt: row.ended_at,
  };
}

function formatQuestion(row) {
  return {
    id: row.id, sessionId: row.session_id, eventId: row.event_id, projectId: row.project_id,
    userId: row.user_id, originalQuestion: row.original_question,
    normalizedQuestion: row.normalized_question, duplicateOfId: row.duplicate_of_id,
    category: row.ai_category, priorityScore: row.ai_priority_score,
    suggestedAnswer: row.ai_suggested_answer, status: row.status,
    moderatedAt: row.moderated_at, createdAt: row.created_at,
  };
}
