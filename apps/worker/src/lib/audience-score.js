/**
 * PH-112: Aggregate room reactions in a time window into a simple audience score.
 */

const POSITIVE = new Set(["👍", "❤️", "🔥", "👏", "+1", "💯"]);
const NEGATIVE = new Set(["👎", "❌", "-1"]);

/**
 * @param {{ emoji: string, count: number }[]} buckets
 */
export function scoreReactionBuckets(buckets) {
  let positive = 0;
  let negative = 0;
  let other = 0;
  for (const row of buckets) {
    const n = Number(row.count) || 0;
    if (POSITIVE.has(row.emoji)) positive += n;
    else if (NEGATIVE.has(row.emoji)) negative += n;
    else other += n;
  }
  const total = positive + negative + other;
  const score = total === 0 ? 0 : Math.round(((positive - negative) / total) * 100);
  return { positive, negative, other, total, score };
}

/**
 * @param {*} env
 * @param {{ projectId: string, roomId: string, windowMinutes?: number }} input
 */
export async function getRoomAudienceScore(env, input) {
  const windowMinutes = Math.min(24 * 60, Math.max(1, Number(input.windowMinutes) || 15));
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const rows = await env.DB.prepare(
    `SELECT emoji, COUNT(*) AS count
     FROM message_reactions
     WHERE project_id = ? AND room_id = ? AND created_at >= ?
     GROUP BY emoji
     ORDER BY count DESC
     LIMIT 50`,
  )
    .bind(input.projectId, input.roomId, since)
    .all();

  const buckets = (rows.results || []).map((r) => ({
    emoji: String(r.emoji),
    count: Number(r.count) || 0,
  }));
  return {
    roomId: input.roomId,
    windowMinutes,
    since,
    buckets,
    ...scoreReactionBuckets(buckets),
  };
}
