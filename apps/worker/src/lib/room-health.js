/**
 * @param {import("@cloudflare/workers-types").D1Database} db
 * @param {{ projectId: string, roomId: string }} scope
 */
export async function computeRoomHealthScore(db, { projectId, roomId }) {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [msgHour, msgDay, modRecent, dlqFailed, members] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) as c FROM messages
         WHERE project_id = ? AND room_id = ? AND created_at >= ? AND deleted_at IS NULL`,
      )
      .bind(projectId, roomId, hourAgo)
      .first(),
    db
      .prepare(
        `SELECT COUNT(*) as c FROM messages
         WHERE project_id = ? AND room_id = ? AND created_at >= ? AND deleted_at IS NULL`,
      )
      .bind(projectId, roomId, dayAgo)
      .first(),
    db
      .prepare(
        `SELECT COUNT(*) as c FROM moderation_events
         WHERE project_id = ? AND room_id = ? AND created_at >= ?`,
      )
      .bind(projectId, roomId, dayAgo)
      .first(),
    db
      .prepare(
        `SELECT COUNT(*) as c FROM webhook_deliveries
         WHERE project_id = ? AND status = 'failed' AND created_at >= ?`,
      )
      .bind(projectId, dayAgo)
      .first(),
    db
      .prepare(
        `SELECT COUNT(*) as c FROM room_members WHERE room_id = ?`,
      )
      .bind(roomId)
      .first(),
  ]);

  const messagesLastHour = Number(msgHour?.c) || 0;
  const messagesLastDay = Number(msgDay?.c) || 0;
  const moderationEvents24h = Number(modRecent?.c) || 0;
  const webhookFailures24h = Number(dlqFailed?.c) || 0;
  const memberCount = Number(members?.c) || 0;

  let score = 100;
  const signals = [];

  if (webhookFailures24h > 20) {
    score -= 25;
    signals.push({ level: "warn", code: "webhook_dlq", detail: `${webhookFailures24h} failed deliveries (24h)` });
  } else if (webhookFailures24h > 5) {
    score -= 10;
    signals.push({ level: "info", code: "webhook_retries", detail: `${webhookFailures24h} failed deliveries (24h)` });
  }

  if (moderationEvents24h > 10) {
    score -= 20;
    signals.push({ level: "warn", code: "moderation_spike", detail: `${moderationEvents24h} moderation events (24h)` });
  }

  if (messagesLastHour === 0 && memberCount > 1) {
    score -= 5;
    signals.push({ level: "info", code: "quiet_room", detail: "No messages in the last hour" });
  }

  score = Math.max(0, Math.min(100, score));
  const status = score >= 80 ? "healthy" : score >= 55 ? "degraded" : "at_risk";

  return {
    score,
    status,
    signals,
    metrics: {
      messagesLastHour,
      messagesLastDay,
      moderationEvents24h,
      webhookFailures24h,
      memberCount,
    },
  };
}
