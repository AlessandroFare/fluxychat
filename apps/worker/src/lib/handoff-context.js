/**
 * P17-G: Context-Preserving Handoff
 * Builds a structured handoff payload from existing data sources:
 * room_memory, knowledge_graph, conversation_questions, ai_action_executions.
 */

const SUMMARY_MESSAGE_LIMIT = 20;
const ENTITIES_LIMIT = 15;
const ACTIONS_LIMIT = 10;
const QUESTIONS_LIMIT = 10;
const FACTS_LIMIT = 20;

/**
 * @param {*} db
 * @param {string} projectId
 * @param {string} roomId
 */
export async function buildHandoffContext(db, { projectId, roomId }) {
  const [recentMessages, entities, actions, openQuestions, facts] = await Promise.all([
    fetchRecentMessages(db, projectId, roomId),
    fetchRecentEntities(db, projectId, roomId),
    fetchRecentActions(db, projectId, roomId),
    fetchOpenQuestions(db, projectId, roomId),
    fetchRoomFacts(db, projectId, roomId),
  ]);

  const summary = buildSummary(recentMessages, facts);
  const intent = inferIntent(openQuestions, entities);

  return {
    summary,
    intent,
    entities,
    actions,
    openQuestions,
    facts,
    recentMessages: recentMessages.map((m) => ({
      userId: m.user_id,
      content: String(m.content || "").slice(0, 500),
      createdAt: m.created_at,
    })),
    builtAt: new Date().toISOString(),
  };
}

/**
 * @param {*} db
 * @param {string} projectId
 * @param {string} roomId
 */
async function fetchRecentMessages(db, projectId, roomId) {
  const { results } = await db
    .prepare(
      `SELECT user_id, content, created_at FROM messages
       WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL
       ORDER BY id DESC LIMIT ?`,
    )
    .bind(projectId, roomId, SUMMARY_MESSAGE_LIMIT)
    .all();
  return (results || []).reverse();
}

/**
 * @param {*} db
 * @param {string} projectId
 * @param {string} roomId
 */
async function fetchRecentEntities(db, projectId, roomId) {
  try {
    const { results } = await db
      .prepare(
        `SELECT node_type, label, properties, confidence
         FROM kg_nodes
         WHERE project_id = ? AND room_id = ? AND valid_to IS NULL
         ORDER BY created_at DESC LIMIT ?`,
      )
      .bind(projectId, roomId, ENTITIES_LIMIT)
      .all();
    return (results || []).map((r) => ({
      type: r.node_type,
      label: r.label,
      properties: safeParseJson(r.properties),
      confidence: r.confidence,
    }));
  } catch {
    return [];
  }
}

/**
 * @param {*} db
 * @param {string} projectId
 * @param {string} roomId
 */
async function fetchRecentActions(db, projectId, roomId) {
  try {
    const { results } = await db
      .prepare(
        `SELECT action_type, status, result_summary, created_at
         FROM ai_action_executions
         WHERE project_id = ? AND room_id = ?
         ORDER BY created_at DESC LIMIT ?`,
      )
      .bind(projectId, roomId, ACTIONS_LIMIT)
      .all();
    return (results || []).map((r) => ({
      type: r.action_type,
      status: r.status,
      summary: r.result_summary ?? null,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

/**
 * @param {*} db
 * @param {string} projectId
 * @param {string} roomId
 */
async function fetchOpenQuestions(db, projectId, roomId) {
  try {
    const { results } = await db
      .prepare(
        `SELECT content, detected_intent, created_at
         FROM conversation_questions
         WHERE project_id = ? AND room_id = ? AND answer_status = 'unanswered'
         ORDER BY created_at DESC LIMIT ?`,
      )
      .bind(projectId, roomId, QUESTIONS_LIMIT)
      .all();
    return (results || []).map((r) => ({
      content: r.content,
      intent: r.detected_intent ?? null,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

/**
 * @param {*} db
 * @param {string} projectId
 * @param {string} roomId
 */
async function fetchRoomFacts(db, projectId, roomId) {
  try {
    const { results } = await db
      .prepare(
        `SELECT fact_text, category, confidence
         FROM room_memory
         WHERE project_id = ? AND room_id = ?
         ORDER BY updated_at DESC LIMIT ?`,
      )
      .bind(projectId, roomId, FACTS_LIMIT)
      .all();
    return (results || []).map((r) => ({
      text: r.fact_text,
      category: r.category ?? null,
      confidence: r.confidence,
    }));
  } catch {
    return [];
  }
}

/**
 * Build a human-readable summary from messages and facts.
 */
function buildSummary(messages, facts) {
  const lines = [];

  if (facts.length > 0) {
    lines.push(`Known facts: ${facts.map((f) => f.text).join("; ")}.`);
  }

  if (messages.length > 0) {
    const last = messages[messages.length - 1];
    lines.push(`Last message from ${last.user_id}: "${String(last.content || "").slice(0, 200)}".`);
  }

  return lines.join(" ") || "No context available.";
}

/**
 * Infer the most likely intent from open questions and entities.
 */
function inferIntent(openQuestions, entities) {
  if (openQuestions.length > 0 && openQuestions[0].intent) {
    return openQuestions[0].intent;
  }
  if (entities.length > 0) {
    const types = [...new Set(entities.map((e) => e.type))];
    return `discussion_about_${types.slice(0, 3).join("_")}`;
  }
  return null;
}

function safeParseJson(str) {
  if (!str) return {};
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}
