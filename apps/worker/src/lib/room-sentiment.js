/**
 * Room mood timeline from reactions + lightweight message sentiment buckets.
 */

const POSITIVE = new Set(["👍", "❤️", "🎉", "✅", "😊", "🙌", "💯"]);
const NEGATIVE = new Set(["👎", "😡", "😢", "⚠️", "❌", "💀"]);

/**
 * @param {Record<string, number>} reactionsByEmoji
 */
export function scoreReactionMood(reactionsByEmoji) {
  let positive = 0;
  let negative = 0;
  let neutral = 0;
  for (const [emoji, count] of Object.entries(reactionsByEmoji || {})) {
    const n = Number(count) || 0;
    if (POSITIVE.has(emoji)) positive += n;
    else if (NEGATIVE.has(emoji)) negative += n;
    else neutral += n;
  }
  const total = positive + negative + neutral;
  if (total === 0) return { mood: "neutral", score: 0, positive, negative, neutral, total };
  const score = (positive - negative) / total;
  const mood = score > 0.15 ? "positive" : score < -0.15 ? "negative" : "neutral";
  return { mood, score: Math.round(score * 100) / 100, positive, negative, neutral, total };
}

/**
 * @param {*} env
 * @param {{ projectId: string, roomId: string, days?: number }} input
 */
export async function getRoomSentimentTimeline(env, input) {
  const days = Math.min(30, Math.max(1, Number(input.days) || 7));
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const reactions = await env.DB.prepare(
    `SELECT emoji, COUNT(*) as c, substr(created_at, 1, 10) as day
     FROM message_reactions mr
     JOIN messages m ON m.id = mr.message_id
     WHERE m.project_id = ? AND m.room_id = ? AND mr.created_at >= ?
     GROUP BY day, emoji`,
  )
    .bind(input.projectId, input.roomId, since)
    .all();

  /** @type {Record<string, Record<string, number>>} */
  const byDay = {};
  for (const row of reactions.results || []) {
    const day = String(row.day);
    if (!byDay[day]) byDay[day] = {};
    byDay[day][String(row.emoji)] = Number(row.c) || 0;
  }

  const timeline = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, emojis]) => ({
      day,
      ...scoreReactionMood(emojis),
      reactions: emojis,
    }));

  const aggregate = scoreReactionMood(
    timeline.reduce((acc, t) => {
      for (const [e, c] of Object.entries(t.reactions || {})) {
        acc[e] = (acc[e] || 0) + c;
      }
      return acc;
    }, {}),
  );

  return {
    ok: true,
    roomId: input.roomId,
    days,
    aggregate,
    timeline,
  };
}
