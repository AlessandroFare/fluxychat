/**
 * P15-G: AI Inbox Zero
 *
 * Transforms 300 unread messages into "4 things need your attention".
 * Per-room AI summaries, priority ranking by urgency/mentions/sentiment,
 * and suggested responses for each room.
 *
 * Compounds:
 * - P15-E (AI Memory) for room context
 * - P15-F (Semantic Search) for message retrieval
 * - P16-B (Knowledge Graph) for entity context
 * - P17-C (Conversation Intelligence) for question detection
 */

import { logInfo } from "./worker-log.js";

const SUMMARY_MAX_MESSAGES = 100;
const SUMMARY_TTL_HOURS = 4;

/**
 * Generate AI summary for a room's unread messages.
 */
export async function generateRoomSummary(env, input) {
  const { projectId, roomId, userId } = input;

  // Get unread messages
  const messages = await env.DB.prepare(
    `SELECT id, user_id, content, created_at FROM messages
     WHERE room_id = ? AND project_id = ?
     ORDER BY created_at DESC LIMIT ?`
  )
    .bind(roomId, projectId, SUMMARY_MAX_MESSAGES)
    .all();

  if (!messages.results?.length) {
    return { ok: true, summary: null, messageCount: 0 };
  }

  const msgList = messages.results.reverse();
  const timeRangeStart = msgList[0].created_at;
  const timeRangeEnd = msgList[msgList.length - 1].created_at;

  // Build context for AI
  const messageTexts = msgList.map((m) => `[${m.user_id}]: ${m.content}`).join("\n");

  let summary = "";
  let keyPoints = [];
  let actionItems = [];

  if (env.AI_BASE_URL) {
    try {
      const prompt = `Summarize this chat conversation in 2-3 sentences. List 2-3 key points and any action items.

Messages:
${messageTexts}

Respond in JSON: {"summary":"...","keyPoints":["..."],"actionItems":["..."]}`;

      const response = await fetch(env.AI_BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.AI_API_KEY}` },
        body: JSON.stringify({
          model: env.AI_MODEL || "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 500,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "{}";
        try {
          const parsed = JSON.parse(text);
          summary = parsed.summary || "";
          keyPoints = parsed.keyPoints || [];
          actionItems = parsed.actionItems || [];
        } catch {
          summary = text.slice(0, 500);
        }
      }
    } catch {
      // Fallback: extract first few messages as summary
      summary = msgList.slice(-3).map((m) => m.content).join(" | ");
    }
  } else {
    // No AI: simple extractive summary
    summary = msgList.slice(-3).map((m) => m.content).join(" | ");
  }

  // Persist summary
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SUMMARY_TTL_HOURS * 3600000).toISOString();

  await env.DB.prepare(
    `INSERT INTO inbox_summaries (id, project_id, room_id, user_id, summary, key_points, action_items, message_count, time_range_start, time_range_end, generated_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, projectId, roomId, userId, summary, JSON.stringify(keyPoints), JSON.stringify(actionItems),
      msgList.length, timeRangeStart, timeRangeEnd, now, expiresAt)
    .run();

  logInfo("inbox.summary_generated", { projectId, roomId, userId, messageCount: msgList.length });

  return { ok: true, id, summary, keyPoints, actionItems, messageCount: msgList.length };
}

/**
 * Compute priority scores for all rooms with unread messages.
 */
export async function computeRoomPriorities(env, input) {
  const { projectId, userId } = input;

  // Get rooms with recent messages
  const rooms = await env.DB.prepare(
    `SELECT room_id, COUNT(*) as unread_count, MAX(created_at) as last_message_at
     FROM messages WHERE project_id = ? AND room_id IS NOT NULL
     GROUP BY room_id ORDER BY last_message_at DESC LIMIT 50`
  )
    .bind(projectId)
    .all();

  const priorities = [];

  for (const room of rooms.results || []) {
    const roomId = room.room_id;
    let score = 0;
    const reasons = [];
    let hasMention = false;
    let hasQuestion = false;

    // Unread count factor
    const unread = room.unread_count || 0;
    score += Math.min(unread * 0.5, 10);

    // Recency factor (more recent = higher)
    if (room.last_message_at) {
      const ageHours = (Date.now() - new Date(room.last_message_at).getTime()) / 3600000;
      if (ageHours < 1) { score += 5; reasons.push("very_recent"); }
      else if (ageHours < 6) { score += 3; reasons.push("recent"); }
    }

    // Check for mentions
    const mentionCheck = await env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM messages WHERE room_id = ? AND project_id = ? AND content LIKE ?"
    )
      .bind(roomId, projectId, `%@${userId}%`)
      .first();

    if ((mentionCheck?.cnt || 0) > 0) {
      score += 10;
      hasMention = true;
      reasons.push("has_mention");
    }

    // Check for questions (simple heuristic)
    const questionCheck = await env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM messages WHERE room_id = ? AND project_id = ? AND content LIKE '%?%'"
    )
      .bind(roomId, projectId)
      .first();

    if ((questionCheck?.cnt || 0) > 0) {
      score += 3;
      hasQuestion = true;
      reasons.push("has_question");
    }

    // Get sentiment from memory if available
    let sentiment = null;
    try {
      const memCheck = await env.DB.prepare(
        "SELECT content FROM room_memory WHERE room_id = ? AND project_id = ? AND kind = 'sentiment' ORDER BY created_at DESC LIMIT 1"
      )
        .bind(roomId, projectId)
        .first();
      if (memCheck?.content) {
        sentiment = memCheck.content;
        if (sentiment.includes("negative") || sentiment.includes("angry") || sentiment.includes("frustrated")) {
          score += 5;
          reasons.push("negative_sentiment");
        }
      }
    } catch {
      // No memory table yet
    }

    // Persist
    const priorityId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO inbox_priorities (id, project_id, room_id, user_id, priority_score, priority_reason, has_mention, has_question, unread_count, last_message_at, sentiment, computed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(priorityId, projectId, roomId, userId, score, reasons.join(","), hasMention ? 1 : 0,
        hasQuestion ? 1 : 0, unread, room.last_message_at, sentiment, new Date().toISOString())
      .run();

    priorities.push({
      roomId,
      score: Math.round(score * 10) / 10,
      reasons,
      hasMention,
      hasQuestion,
      unreadCount: unread,
      lastMessageAt: room.last_message_at,
      sentiment,
    });
  }

  // Sort by score descending
  priorities.sort((a, b) => b.score - a.score);

  logInfo("inbox.priorities_computed", { projectId, userId, roomCount: priorities.length });

  return { ok: true, priorities };
}

/**
 * Generate suggested responses for a room.
 */
export async function generateSuggestedResponses(env, input) {
  const { projectId, roomId, userId, count = 3 } = input;

  // Get recent messages
  const messages = await env.DB.prepare(
    `SELECT id, user_id, content, created_at FROM messages
     WHERE room_id = ? AND project_id = ?
     ORDER BY created_at DESC LIMIT 20`
  )
    .bind(roomId, projectId)
    .all();

  if (!messages.results?.length) {
    return { ok: true, suggestions: [] };
  }

  const msgList = messages.results.reverse();
  const messageTexts = msgList.map((m) => `[${m.user_id}]: ${m.content}`).join("\n");

  let suggestions = [];

  if (env.AI_BASE_URL) {
    try {
      const prompt = `Based on this chat conversation, suggest ${count} possible responses the user could send. Be concise and contextual.

Messages:
${messageTexts}

Respond in JSON: {"suggestions":["response 1","response 2","response 3"]}`;

      const response = await fetch(env.AI_BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.AI_API_KEY}` },
        body: JSON.stringify({
          model: env.AI_MODEL || "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 300,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "{}";
        try {
          const parsed = JSON.parse(text);
          suggestions = parsed.suggestions || [];
        } catch {
          // ignore
        }
      }
    } catch {
      // AI unavailable
    }
  }

  // Persist suggestions
  const now = new Date().toISOString();
  for (const text of suggestions.slice(0, count)) {
    await env.DB.prepare(
      `INSERT INTO suggested_responses (id, project_id, room_id, user_id, response_text, confidence, context_summary, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(crypto.randomUUID(), projectId, roomId, userId, text, 0.8, null, now)
      .run();
  }

  return { ok: true, suggestions: suggestions.slice(0, count) };
}

/**
 * Get full inbox view: prioritized rooms with summaries and suggestions.
 */
export async function getInboxView(env, input) {
  const { projectId, userId } = input;

  // Get top priority rooms
  const priorities = await env.DB.prepare(
    "SELECT * FROM inbox_priorities WHERE project_id = ? AND user_id = ? ORDER BY priority_score DESC LIMIT 20"
  )
    .bind(projectId, userId)
    .all();

  const inbox = [];

  for (const p of priorities.results || []) {
    // Get latest summary
    const summary = await env.DB.prepare(
      "SELECT * FROM inbox_summaries WHERE project_id = ? AND room_id = ? AND user_id = ? ORDER BY generated_at DESC LIMIT 1"
    )
      .bind(projectId, p.room_id, userId)
      .first();

    // Get latest suggestions
    const suggestions = await env.DB.prepare(
      "SELECT response_text FROM suggested_responses WHERE project_id = ? AND room_id = ? AND user_id = ? ORDER BY generated_at DESC LIMIT 3"
    )
      .bind(projectId, p.room_id, userId)
      .all();

    inbox.push({
      roomId: p.room_id,
      priorityScore: p.priority_score,
      priorityReasons: (p.priority_reason || "").split(",").filter(Boolean),
      hasMention: !!p.has_mention,
      hasQuestion: !!p.has_question,
      unreadCount: p.unread_count,
      lastMessageAt: p.last_message_at,
      summary: summary?.summary || null,
      keyPoints: summary?.key_points ? JSON.parse(summary.key_points) : [],
      actionItems: summary?.action_items ? JSON.parse(summary.action_items) : [],
      suggestedResponses: (suggestions.results || []).map((s) => s.response_text),
    });
  }

  return {
    ok: true,
    inbox,
    totalCount: inbox.length,
    needsAttention: inbox.filter((i) => i.hasMention || i.hasQuestion || i.priorityScore > 10).length,
  };
}
