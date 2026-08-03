import { getRoomCatchUpForUser } from "./room-catch-up.js";
import { chatCompletion } from "./ai-chat-completion.js";

const MAX_DIGEST_MESSAGES = 40;
const MAX_TRANSCRIPT_CHARS = 12000;

/**
 * Rank unread messages by relevance: direct mentions first, then recency.
 * @param {Array<{ id: number, content: string, user_id: string, created_at: string }>} rows
 * @param {string} userId
 */
export function rankCatchUpMessages(rows, userId) {
  const uid = String(userId).toLowerCase();
  return [...rows].sort((a, b) => {
    const aMention = String(a.content || "").toLowerCase().includes(`@${uid}`) ? 1 : 0;
    const bMention = String(b.content || "").toLowerCase().includes(`@${uid}`) ? 1 : 0;
    if (aMention !== bMention) return bMention - aMention;
    return Number(b.id) - Number(a.id);
  });
}

function buildTranscript(messages) {
  const lines = messages.map(
    (m) => `[${m.user_id}] ${String(m.content || "").replace(/\s+/g, " ").trim().slice(0, 400)}`,
  );
  let text = lines.join("\n");
  if (text.length > MAX_TRANSCRIPT_CHARS) {
    text = text.slice(0, MAX_TRANSCRIPT_CHARS) + "\n…";
  }
  return text;
}

/**
 * Smart catch-up: relevance-ranked subset + AI summary bullets.
 * @param {*} env
 * @param {{ projectId: string, roomId: string, userId: string, logContext?: Record<string, unknown> }} input
 */
export async function getSmartCatchUpDigest(env, input) {
  const base = await getRoomCatchUpForUser(env.DB, input);
  if (base.unreadCount === 0) {
    return {
      ok: true,
      ...base,
      digest: null,
      highlights: [],
      messageSampleCount: 0,
    };
  }

  const { results } = await env.DB.prepare(
    `SELECT id, user_id, content, created_at FROM messages
     WHERE project_id = ? AND room_id = ? AND id > ? AND deleted_at IS NULL
     ORDER BY id ASC LIMIT ?`,
  )
    .bind(input.projectId, input.roomId, base.lastReadMessageId, MAX_DIGEST_MESSAGES)
    .all();

  const rows = (results || []).map((r) => ({
    id: Number(r.id),
    user_id: String(r.user_id),
    content: String(r.content || ""),
    created_at: String(r.created_at),
  }));

  const ranked = rankCatchUpMessages(rows, input.userId);
  const transcript = buildTranscript(ranked);

  const ai = await chatCompletion(env, {
    messages: [
      {
        role: "system",
        content:
          "You summarize what a user missed in a team chat. Return 3–5 short bullet points with leading '- '. Prioritize mentions, decisions, and action items. Be factual.",
      },
      {
        role: "user",
        content: `User "${input.userId}" was away. ${base.unreadCount} unread messages. Summarize the most important:\n\n${transcript}`,
      },
    ],
    model: env.AI_SUMMARY_MODEL || env.AI_SUGGEST_MODEL || env.AI_MODEL,
    maxTokens: 280,
    temperature: 0.3,
    logContext: input.logContext,
  });

  if (!ai.ok) {
    return {
      ok: true,
      ...base,
      digest: null,
      highlights: ranked.slice(0, 5).map((m) => ({
        messageId: m.id,
        userId: m.user_id,
        preview: m.content.slice(0, 160),
      })),
      messageSampleCount: ranked.length,
      digestError: ai.error,
    };
  }

  const bullets = ai.content
    .split("\n")
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 6);

  return {
    ok: true,
    ...base,
    digest: ai.content.trim(),
    highlights: bullets.length
      ? bullets.map((text, i) => ({ index: i, text }))
      : ranked.slice(0, 3).map((m) => ({
          messageId: m.id,
          userId: m.user_id,
          preview: m.content.slice(0, 160),
        })),
    messageSampleCount: ranked.length,
  };
}
