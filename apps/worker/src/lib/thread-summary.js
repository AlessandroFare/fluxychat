/**
 * Thread TL;DR (P12-M) — collect reply thread + AI summary.
 */
import { chatCompletion } from "./ai-chat-completion.js";

export const MIN_THREAD_MESSAGES = 3;
export const MAX_THREAD_MESSAGES = 40;
const MAX_CONTENT_CHARS = 400;

/**
 * @param {*} env
 * @param {{ projectId: string, roomId: string, messageId: number }} input
 */
export async function collectThreadMessages(env, input) {
  const anchor = await env.DB.prepare(
    `SELECT id, user_id, content, created_at, parent_id
     FROM messages
     WHERE project_id = ? AND room_id = ? AND id = ? AND deleted_at IS NULL
     LIMIT 1`,
  )
    .bind(input.projectId, input.roomId, input.messageId)
    .first();

  if (!anchor) return { ok: false, error: "message_not_found" };

  let rootId = Number(anchor.id);
  let current = anchor;
  for (let depth = 0; depth < 20 && current.parent_id; depth++) {
    const parent = await env.DB.prepare(
      `SELECT id, user_id, content, created_at, parent_id
       FROM messages
       WHERE project_id = ? AND room_id = ? AND id = ? AND deleted_at IS NULL
       LIMIT 1`,
    )
      .bind(input.projectId, input.roomId, current.parent_id)
      .first();
    if (!parent) break;
    rootId = Number(parent.id);
    current = parent;
  }

  const threadIds = new Set([rootId]);
  let frontier = [rootId];

  while (frontier.length && threadIds.size < MAX_THREAD_MESSAGES) {
    const placeholders = frontier.map(() => "?").join(", ");
    const rows = await env.DB.prepare(
      `SELECT id FROM messages
       WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL
         AND parent_id IN (${placeholders})`,
    )
      .bind(input.projectId, input.roomId, ...frontier)
      .all();

    const next = [];
    for (const row of rows.results ?? []) {
      const id = Number(row.id);
      if (!threadIds.has(id) && threadIds.size < MAX_THREAD_MESSAGES) {
        threadIds.add(id);
        next.push(id);
      }
    }
    frontier = next;
  }

  const idList = [...threadIds];
  const placeholders = idList.map(() => "?").join(", ");
  const messageRows = await env.DB.prepare(
    `SELECT id, user_id, content, created_at, parent_id
     FROM messages
     WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL
       AND id IN (${placeholders})
     ORDER BY created_at ASC`,
  )
    .bind(input.projectId, input.roomId, ...idList)
    .all();

  const messages = (messageRows.results ?? []).map((row) => ({
    id: Number(row.id),
    userId: row.user_id,
    content: String(row.content || ""),
    createdAt: row.created_at,
    parentId: row.parent_id ? Number(row.parent_id) : null,
  }));

  return {
    ok: true,
    rootId,
    messages,
    truncated: threadIds.size >= MAX_THREAD_MESSAGES,
  };
}

/**
 * @param {Array<{ userId: string, content: string }>} messages
 */
export function buildThreadTranscript(messages) {
  return messages
    .map((m) => {
      const text = String(m.content || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_CONTENT_CHARS);
      return `${m.userId}: ${text}`;
    })
    .join("\n");
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   messageId: number,
 *   logContext?: Record<string, unknown>,
 * }} input
 */
export async function summarizeThread(env, input) {
  const collected = await collectThreadMessages(env, input);
  if (!collected.ok) return collected;

  const { messages, rootId, truncated } = collected;
  if (messages.length < MIN_THREAD_MESSAGES) {
    return {
      ok: false,
      error: "thread_too_short",
      messageCount: messages.length,
      minRequired: MIN_THREAD_MESSAGES,
    };
  }

  const transcript = buildThreadTranscript(messages);
  const systemPrompt = [
    "You summarize chat reply threads for support and team conversations.",
    "Return 3–5 short bullet points covering: the question or topic, key decisions, open items, and who owns next steps if clear.",
    "Use plain text with leading '- ' bullets. No markdown headings or code fences.",
    "Be factual; do not invent details not present in the thread.",
  ].join(" ");

  const userPrompt = [
    `Summarize this reply thread (${messages.length} messages):`,
    "",
    transcript,
    "",
    "Thread TL;DR:",
  ].join("\n");

  const ai = await chatCompletion(env, {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    model: env.AI_SUMMARY_MODEL || env.AI_SUGGEST_MODEL || env.AI_MODEL,
    maxTokens: 320,
    temperature: 0.3,
    logContext: input.logContext,
  });

  if (!ai.ok) {
    return { ok: false, error: ai.error, status: ai.status };
  }

  const summary = ai.content.trim();
  if (!summary) {
    return { ok: false, error: "empty_summary" };
  }

  return {
    ok: true,
    summary,
    rootMessageId: rootId,
    messageCount: messages.length,
    truncated,
  };
}

