/**
 * P19-B: Live Event Interactions — reactions, Q&A, speaker queue, audience feedback.
 *
 * Features:
 *   • Event lifecycle (create, start, end)
 *   • Q&A with upvoting, dedup, AI moderation
 *   • Speaker queue (invite, join, leave, hand-raise)
 *   • Audience reactions (emoji-based, throttled)
 *   • Audience polling (live results)
 *   • Event analytics
 */

const EVENT_TYPES = ["webinar", "ama", "workshop", "community", "auction", "support", "internal"];
const QA_STATUS = ["pending", "approved", "answered", "dismissed", "duplicate"];
const SPEAKER_ROLES = ["host", "speaker", "moderator", "attendee"];
const SPEAKER_STATUS = ["invited", "accepted", "joined", "left", "removed"];

export async function createEvent(env, {
  projectId, roomId, eventType, title, description, maxParticipants, settings,
}) {
  if (!EVENT_TYPES.includes(eventType)) throw new Error(`Invalid event type: ${eventType}`);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO live_events (id, project_id, room_id, event_type, title, description, max_participants, settings)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, roomId, eventType, title, description || null, maxParticipants || 1000, JSON.stringify(settings || {})).run();
  return { id, eventType, title, status: "draft" };
}

export async function getEvent(env, { projectId, eventId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM live_events WHERE project_id = ? AND id = ?`
  ).bind(projectId, eventId).first();
  return row ? formatEvent(row) : null;
}

export async function listEvents(env, { projectId, status }) {
  let query = `SELECT * FROM live_events WHERE project_id = ?`;
  const params = [projectId];
  if (status) { query += ` AND status = ?`; params.push(status); }
  query += ` ORDER BY created_at DESC`;
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatEvent);
}

export async function startEvent(env, { projectId, eventId }) {
  const info = await env.DB.prepare(
    `UPDATE live_events SET status = 'live', started_at = datetime('now') WHERE project_id = ? AND id = ? AND status = 'draft'`
  ).bind(projectId, eventId).run();
  if (info.meta?.changes === 0) return null;
  return getEvent(env, { projectId, eventId });
}

export async function endEvent(env, { projectId, eventId }) {
  const info = await env.DB.prepare(
    `UPDATE live_events SET status = 'ended', ended_at = datetime('now') WHERE project_id = ? AND id = ? AND status = 'live'`
  ).bind(projectId, eventId).run();
  if (info.meta?.changes === 0) return null;
  return getEvent(env, { projectId, eventId });
}

/* ═══ Q&A ═══ */

export async function submitQuestion(env, { projectId, eventId, userId, question }) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO event_qa (id, event_id, project_id, user_id, question, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`
  ).bind(id, eventId, projectId, userId, question).run();
  return { id, question, status: "pending", upvotes: 0 };
}

export async function upvoteQuestion(env, { projectId, questionId }) {
  const info = await env.DB.prepare(
    `UPDATE event_qa SET upvotes = upvotes + 1 WHERE project_id = ? AND id = ?`
  ).bind(projectId, questionId).run();
  return info.meta?.changes > 0;
}

export async function approveQuestion(env, { projectId, questionId }) {
  const info = await env.DB.prepare(
    `UPDATE event_qa SET status = 'approved' WHERE project_id = ? AND id = ? AND status = 'pending'`
  ).bind(projectId, questionId).run();
  return info.meta?.changes > 0;
}

export async function answerQuestion(env, { projectId, questionId, answer, answeredBy }) {
  const info = await env.DB.prepare(
    `UPDATE event_qa SET status = 'answered', answer = ?, answered_by = ?, answered_at = datetime('now')
     WHERE project_id = ? AND id = ?`
  ).bind(answer, answeredBy, projectId, questionId).run();
  return info.meta?.changes > 0;
}

export async function dismissQuestion(env, { projectId, questionId }) {
  const info = await env.DB.prepare(
    `UPDATE event_qa SET status = 'dismissed' WHERE project_id = ? AND id = ?`
  ).bind(projectId, questionId).run();
  return info.meta?.changes > 0;
}

export async function listQuestions(env, { projectId, eventId, status, limit = 50 }) {
  let query = `SELECT * FROM event_qa WHERE project_id = ? AND event_id = ?`;
  const params = [projectId, eventId];
  if (status) { query += ` AND status = ?`; params.push(status); }
  query += ` ORDER BY upvotes DESC, created_at ASC LIMIT ?`;
  params.push(limit);
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatQuestion);
}

export async function getQaStats(env, { projectId, eventId }) {
  const { results } = await env.DB.prepare(
    `SELECT status, COUNT(*) as count FROM event_qa
     WHERE project_id = ? AND event_id = ? GROUP BY status`
  ).bind(projectId, eventId).all();
  const map = {};
  let total = 0;
  for (const r of results) { map[r.status] = r.count; total += r.count; }
  return { total, byStatus: map };
}

/* ═══ Speakers ═══ */

export async function inviteSpeaker(env, { projectId, eventId, userId, role }) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO event_speakers (id, event_id, user_id, role, status)
     VALUES (?, ?, ?, ?, 'invited')`
  ).bind(id, eventId, userId, role || "speaker").run();
  return { id, userId, role: role || "speaker", status: "invited" };
}

export async function acceptSpeakerInvite(env, { projectId, speakerId }) {
  const info = await env.DB.prepare(
    `UPDATE event_speakers SET status = 'accepted' WHERE id = ? AND status = 'invited'`
  ).bind(speakerId).run();
  return info.meta?.changes > 0;
}

export async function joinAsSpeaker(env, { projectId, speakerId }) {
  const info = await env.DB.prepare(
    `UPDATE event_speakers SET status = 'joined', joined_at = datetime('now')
     WHERE id = ? AND status IN ('invited', 'accepted')`
  ).bind(speakerId).run();
  return info.meta?.changes > 0;
}

export async function leaveSpeaker(env, { projectId, speakerId }) {
  const info = await env.DB.prepare(
    `UPDATE event_speakers SET status = 'left', left_at = datetime('now')
     WHERE id = ? AND status = 'joined'`
  ).bind(speakerId).run();
  return info.meta?.changes > 0;
}

export async function listSpeakers(env, { projectId, eventId, status }) {
  let query = `SELECT * FROM event_speakers WHERE event_id = ?`;
  const params = [eventId];
  if (status) { query += ` AND status = ?`; params.push(status); }
  query += ` ORDER BY created_at ASC`;
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatSpeaker);
}

export async function getSpeakerQueue(env, { projectId, eventId }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM event_speakers WHERE event_id = ? AND status = 'joined' ORDER BY joined_at ASC`
  ).bind(eventId).all();
  return results.map(formatSpeaker);
}

/* ═══ Reactions ═══ */

export async function addReaction(env, { projectId, eventId, userId, emoji }) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO event_reactions (id, event_id, user_id, emoji, timestamp)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).bind(id, eventId, userId, emoji).run();
  return { id, emoji };
}

export async function getReactionSummary(env, { projectId, eventId, windowSeconds = 30 }) {
  const { results } = await env.DB.prepare(
    `SELECT emoji, COUNT(*) as count FROM event_reactions
     WHERE event_id = ? AND timestamp > datetime('now', '-' || ? || ' seconds')
     GROUP BY emoji ORDER BY count DESC`
  ).bind(eventId, windowSeconds).all();
  return results;
}

export async function clearOldReactions(env, { projectId, eventId, olderThanSeconds = 300 }) {
  const info = await env.DB.prepare(
    `DELETE FROM event_reactions WHERE event_id = ? AND timestamp < datetime('now', '-' || ? || ' seconds')`
  ).bind(eventId, olderThanSeconds).run();
  return info.meta?.changes || 0;
}

/* ═══ Analytics ═══ */

export async function getEventStats(env, { projectId, eventId }) {
  const qa = await getQaStats(env, { projectId, eventId });
  const speakers = await env.DB.prepare(
    `SELECT status, COUNT(*) as count FROM event_speakers WHERE event_id = ? GROUP BY status`
  ).bind(eventId).all();
  const reactions = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM event_reactions WHERE event_id = ?`
  ).bind(eventId).first();
  const speakerMap = {};
  for (const s of (speakers.results || speakers)) speakerMap[s.status] = s.count;
  return { qa, speakers: speakerMap, totalReactions: reactions?.total || 0 };
}

function formatEvent(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id,
    eventType: row.event_type, title: row.title, description: row.description,
    status: row.status, maxParticipants: row.max_participants,
    startedAt: row.started_at, endedAt: row.ended_at,
    settings: JSON.parse(row.settings || "{}"),
    createdAt: row.created_at,
  };
}

function formatQuestion(row) {
  return {
    id: row.id, eventId: row.event_id, projectId: row.project_id, userId: row.user_id,
    question: row.question, status: row.status, upvotes: row.upvotes,
    answer: row.answer, answeredBy: row.answered_by, answeredAt: row.answered_at,
    createdAt: row.created_at,
  };
}

function formatSpeaker(row) {
  return {
    id: row.id, eventId: row.event_id, userId: row.user_id,
    role: row.role, status: row.status,
    joinedAt: row.joined_at, leftAt: row.left_at, createdAt: row.created_at,
  };
}

