const CLIP_CLIENT_IDS = 100;

export function foldReactionSummary(messageId, rows) {
  const unique = {};
  const multiple = {};
  for (const row of rows || []) {
    const emoji = String(row.emoji || "");
    const userId = String(row.user_id || row.userId || "");
    if (!emoji || !userId) continue;
    const bucket = unique[emoji] || { total: 0, clientIds: [] };
    if (!bucket.clientIds.includes(userId)) {
      bucket.clientIds.push(userId);
      bucket.total = bucket.clientIds.length;
      unique[emoji] = bucket;
    }
    const counts = multiple[emoji] || {
      total: 0,
      clientIds: {},
      totalUnidentified: 0,
      clipped: false,
      totalClientIds: 0,
    };
    counts.total += 1;
    counts.clientIds[userId] = (counts.clientIds[userId] || 0) + 1;
    multiple[emoji] = counts;
  }
  for (const counts of Object.values(multiple)) {
    const ids = Object.keys(counts.clientIds);
    counts.totalClientIds = ids.length;
    if (ids.length > CLIP_CLIENT_IDS) {
      counts.clipped = true;
      const kept = {};
      for (const id of ids.slice(0, CLIP_CLIENT_IDS)) kept[id] = counts.clientIds[id];
      counts.clientIds = kept;
    }
  }
  return { messageId, unique, distinct: unique, multiple };
}

export const INSERT_REACTION_SQL =
  "INSERT INTO message_reactions (project_id, message_id, room_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?, ?)";
export const DELETE_USER_MESSAGE_REACTIONS_SQL =
  "DELETE FROM message_reactions WHERE project_id = ? AND message_id = ? AND room_id = ? AND user_id = ?";
export const DELETE_USER_EMOJI_REACTIONS_SQL =
  "DELETE FROM message_reactions WHERE project_id = ? AND message_id = ? AND room_id = ? AND user_id = ? AND emoji = ?";
export const SELECT_USER_EMOJI_REACTION_SQL =
  "SELECT id FROM message_reactions WHERE project_id = ? AND message_id = ? AND room_id = ? AND user_id = ? AND emoji = ? LIMIT 1";

const MAX_MULTIPLE_COUNT = 100;

export function normalizeReactionType(value, fallback = "distinct") {
  const type = String(value || "").toLowerCase();
  if (type === "unique" || type === "distinct" || type === "multiple") return type;
  return fallback;
}

export function planReactionMutation(op, input = {}) {
  const type = normalizeReactionType(input.type);
  const name = String(input.name || input.emoji || "").trim();
  if (op === "remove") {
    if (type === "unique") return { type, deleteScope: "user", inserts: 0 };
    if (!name) return { type, error: "name required for distinct/multiple delete" };
    return { type, deleteScope: "user-emoji", inserts: 0, name };
  }
  if (!name) return { type, error: "emoji required" };
  if (type === "unique") return { type, deleteScope: "user", inserts: 1, name };
  if (type === "distinct") return { type, deleteScope: "none", insertIfMissing: true, inserts: 0, name };
  const count = Math.min(Math.max(Number(input.count) || 1, 1), MAX_MULTIPLE_COUNT);
  return { type, deleteScope: "none", inserts: count, name };
}

/**
 * Apply a unique/distinct/multiple plan to D1 (REST and WS share this).
 * @param {{ prepare: (sql: string) => { bind: (...args: unknown[]) => { run: () => Promise<unknown>; first: () => Promise<unknown> } } }} db
 */
export async function applyReactionPlan(db, ctx, plan) {
  const projectId = ctx.projectId;
  const messageId = ctx.messageId;
  const roomId = ctx.roomId;
  const userId = ctx.userId;
  const now = ctx.now;
  const emoji = String(plan.name || ctx.emoji || "");
  if (plan.deleteScope === "user") {
    await db.prepare(DELETE_USER_MESSAGE_REACTIONS_SQL).bind(projectId, messageId, roomId, userId).run();
  } else if (plan.deleteScope === "user-emoji") {
    await db.prepare(DELETE_USER_EMOJI_REACTIONS_SQL).bind(projectId, messageId, roomId, userId, emoji).run();
  }
  if (plan.insertIfMissing) {
    const found = await db
      .prepare(SELECT_USER_EMOJI_REACTION_SQL)
      .bind(projectId, messageId, roomId, userId, emoji)
      .first();
    if (!found) {
      await db.prepare(INSERT_REACTION_SQL).bind(projectId, messageId, roomId, userId, emoji, now).run();
    }
  }
  for (let i = 0; i < (plan.inserts || 0); i += 1) {
    await db.prepare(INSERT_REACTION_SQL).bind(projectId, messageId, roomId, userId, emoji, now).run();
  }
}
