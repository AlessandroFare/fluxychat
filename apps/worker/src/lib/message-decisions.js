const MAX_DECISION_CONTENT = 4000;
const MIN_TTL_SECONDS = 300;
const MAX_TTL_SECONDS = 60 * 60 * 24 * 30;
const VALID_ROOM_ROLES = new Set(["owner", "admin", "moderator", "mod", "member", "guest"]);
const ROLE_ALIASES = { mod: "moderator", moderator: "moderator" };

/**
 * @param {unknown} decisionBody
 */
export function parseDecisionCreateInput(decisionBody) {
  if (!decisionBody || typeof decisionBody !== "object") {
    return { ok: false, error: "decision object required" };
  }
  const content = String(decisionBody.content ?? decisionBody.text ?? "").trim();
  if (!content || content.length > MAX_DECISION_CONTENT) {
    return { ok: false, error: "decision.content required (max 4000 chars)" };
  }

  let requiredRoles = decisionBody.requiredRoles ?? decisionBody.required_roles;
  if (!Array.isArray(requiredRoles) || requiredRoles.length === 0) {
    const requiredAcks = Number(decisionBody.requiredAcks ?? decisionBody.required_acks ?? 1);
    const allowedRoles = decisionBody.allowedRoles ?? decisionBody.allowed_roles ?? ["admin", "owner"];
    if (!Number.isFinite(requiredAcks) || requiredAcks < 1) {
      return { ok: false, error: "decision.requiredRoles or requiredAcks required" };
    }
    requiredRoles = [{ role: String(allowedRoles[0] ?? "admin"), count: requiredAcks }];
  }

  /** @type {{ role: string, count: number }[]} */
  const normalized = [];
  for (const entry of requiredRoles) {
    const role = normalizeRoomRole(String(entry?.role ?? "").trim());
    const count = Number(entry?.count ?? 1);
    if (!role || !VALID_ROOM_ROLES.has(role)) {
      return { ok: false, error: `invalid decision role: ${entry?.role}` };
    }
    if (!Number.isFinite(count) || count < 1 || count > 50) {
      return { ok: false, error: "each decision role count must be 1-50" };
    }
    normalized.push({ role, count });
  }

  let ttlSeconds = Number(decisionBody.ttlSeconds ?? decisionBody.ttl_seconds ?? 172800);
  if (!Number.isFinite(ttlSeconds)) ttlSeconds = 172800;
  ttlSeconds = Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, Math.floor(ttlSeconds)));

  return { ok: true, content, requiredRoles: normalized, ttlSeconds };
}

function normalizeRoomRole(role) {
  const lower = role.toLowerCase();
  return ROLE_ALIASES[lower] ?? lower;
}

/**
 * @param {*} env
 * @param {string} roomId
 * @param {string} userId
 * @param {string[]} [jwtRoles]
 */
export async function getRoomMemberRole(env, roomId, userId, jwtRoles = []) {
  const row = await env.DB.prepare(
    "SELECT role FROM room_members WHERE room_id = ? AND user_id = ? LIMIT 1",
  )
    .bind(roomId, userId)
    .first();
  if (row?.role) return normalizeRoomRole(String(row.role));

  if (Array.isArray(jwtRoles)) {
    if (jwtRoles.includes("owner")) return "owner";
    if (jwtRoles.includes("admin")) return "admin";
    if (jwtRoles.includes("moderator") || jwtRoles.includes("mod")) return "moderator";
  }
  return "member";
}

/**
 * @param {{ role: string, count: number }[]} requiredRoles
 * @param {{ userId: string, role: string }[]} acks
 */
export function evaluateDecisionQuorum(requiredRoles, acks) {
  for (const req of requiredRoles) {
    const matches = acks.filter((a) => normalizeRoomRole(a.role) === req.role);
    if (matches.length < req.count) return false;
  }
  return true;
}

/**
 * @param {{
 *   messageId: number,
 *   requiredRoles: { role: string, count: number }[],
 *   acks: { userId: string, role: string, ackedAt: string }[],
 *   state: string,
 *   expiresAt: string,
 *   ttlSeconds: number,
 *   content: string,
 * }} input
 */
export function buildDecisionSnapshot(input) {
  const progress = input.requiredRoles.map((req) => {
    const matched = input.acks.filter((a) => normalizeRoomRole(a.role) === req.role);
    return {
      role: req.role,
      required: req.count,
      current: matched.length,
      ackedBy: matched.map((a) => ({ userId: a.userId, ackedAt: a.ackedAt })),
    };
  });
  const totalRequired = input.requiredRoles.reduce((s, r) => s + r.count, 0);
  const totalCurrent = progress.reduce((s, p) => s + p.current, 0);
  return {
    messageId: input.messageId,
    content: input.content,
    state: input.state,
    requiredRoles: input.requiredRoles,
    progress,
    totalRequired,
    totalCurrent,
    quorumMet: input.state === "decided",
    expiresAt: input.expiresAt,
    ttlSeconds: input.ttlSeconds,
    acks: input.acks,
  };
}

/**
 * @param {*} env
 * @param {{
 *   messageId: number,
 *   projectId: string,
 *   roomId: string,
 *   content: string,
 *   requiredRoles: { role: string, count: number }[],
 *   ttlSeconds: number,
 *   createdBy: string,
 * }} row
 */
export async function insertMessageDecision(env, row) {
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + row.ttlSeconds * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO message_decisions
     (message_id, project_id, room_id, content, required_roles_json, ttl_seconds,
      expires_at, state, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
  )
    .bind(
      row.messageId,
      row.projectId,
      row.roomId,
      row.content,
      JSON.stringify(row.requiredRoles),
      row.ttlSeconds,
      expiresAt,
      row.createdBy,
      createdAt,
    )
    .run();
  return buildDecisionSnapshot({
    messageId: row.messageId,
    content: row.content,
    requiredRoles: row.requiredRoles,
    acks: [],
    state: "pending",
    expiresAt,
    ttlSeconds: row.ttlSeconds,
  });
}

/**
 * @param {*} env
 * @param {number} messageId
 * @param {string} projectId
 */
export async function getMessageDecision(env, messageId, projectId) {
  const row = await env.DB.prepare(
    `SELECT message_id, room_id, content, required_roles_json, ttl_seconds,
            expires_at, state, created_by, created_at, decided_at
     FROM message_decisions WHERE message_id = ? AND project_id = ? LIMIT 1`,
  )
    .bind(messageId, projectId)
    .first();
  if (!row) return null;

  const ackRows = await env.DB.prepare(
    `SELECT user_id, role, acked_at FROM message_decision_acks WHERE message_id = ? ORDER BY acked_at ASC`,
  )
    .bind(messageId)
    .all();

  const requiredRoles = JSON.parse(String(row.required_roles_json || "[]"));
  const acks = (ackRows.results || []).map((a) => ({
    userId: String(a.user_id),
    role: normalizeRoomRole(String(a.role)),
    ackedAt: String(a.acked_at),
  }));

  return buildDecisionSnapshot({
    messageId: Number(row.message_id),
    content: String(row.content),
    requiredRoles,
    acks,
    state: String(row.state),
    expiresAt: String(row.expires_at),
    ttlSeconds: Number(row.ttl_seconds),
  });
}

/**
 * @param {*} env
 * @param {{
 *   messageId: number,
 *   projectId: string,
 *   roomId: string,
 *   userId: string,
 *   jwtRoles?: string[],
 * }} input
 */
export async function ackMessageDecision(env, input) {
  const row = await env.DB.prepare(
    `SELECT room_id, required_roles_json, expires_at, state, content, ttl_seconds
     FROM message_decisions WHERE message_id = ? AND project_id = ? LIMIT 1`,
  )
    .bind(input.messageId, input.projectId)
    .first();

  if (!row) return { ok: false, error: "decision_not_found", status: 404 };
  if (row.room_id !== input.roomId) return { ok: false, error: "room_mismatch", status: 403 };
  if (row.state !== "pending") {
    return { ok: false, error: `decision_${row.state}`, status: 409 };
  }
  if (new Date(String(row.expires_at)).getTime() <= Date.now()) {
    await env.DB.prepare(
      `UPDATE message_decisions SET state = 'expired_no_quorum' WHERE message_id = ? AND project_id = ?`,
    )
      .bind(input.messageId, input.projectId)
      .run();
    return { ok: false, error: "decision_expired", status: 410 };
  }

  const memberRole = await getRoomMemberRole(env, input.roomId, input.userId, input.jwtRoles);
  const requiredRoles = JSON.parse(String(row.required_roles_json || "[]"));
  const allowedRoles = new Set(requiredRoles.map((r) => normalizeRoomRole(String(r.role))));
  if (!allowedRoles.has(memberRole)) {
    return { ok: false, error: "role_not_eligible", status: 403 };
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR REPLACE INTO message_decision_acks (message_id, user_id, role, acked_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(input.messageId, input.userId, memberRole, now)
    .run();

  const ackRows = await env.DB.prepare(
    `SELECT user_id, role, acked_at FROM message_decision_acks WHERE message_id = ?`,
  )
    .bind(input.messageId)
    .all();
  const acks = (ackRows.results || []).map((a) => ({
    userId: String(a.user_id),
    role: normalizeRoomRole(String(a.role)),
    ackedAt: String(a.acked_at),
  }));

  let state = "pending";
  if (evaluateDecisionQuorum(requiredRoles, acks)) {
    state = "decided";
    await env.DB.prepare(
      `UPDATE message_decisions SET state = 'decided', decided_at = ? WHERE message_id = ? AND project_id = ?`,
    )
      .bind(now, input.messageId, input.projectId)
      .run();
  }

  const decision = buildDecisionSnapshot({
    messageId: input.messageId,
    content: String(row.content),
    requiredRoles,
    acks,
    state,
    expiresAt: String(row.expires_at),
    ttlSeconds: Number(row.ttl_seconds),
  });

  return { ok: true, decision, memberRole };
}

/**
 * Expire pending decisions past TTL. Called from scheduled cron.
 * @param {*} env
 * @param {{ limit?: number }} [opts]
 */
export async function expirePendingDecisions(env, opts = {}) {
  const limit = Math.min(500, Math.max(1, Number(opts.limit) || 100));
  const now = new Date().toISOString();
  const { results } = await env.DB.prepare(
    `SELECT message_id, project_id, room_id FROM message_decisions
     WHERE state = 'pending' AND expires_at <= ? LIMIT ?`,
  )
    .bind(now, limit)
    .all();

  let expired = 0;
  for (const row of results || []) {
    await env.DB.prepare(
      `UPDATE message_decisions SET state = 'expired_no_quorum' WHERE message_id = ? AND project_id = ? AND state = 'pending'`,
    )
      .bind(row.message_id, row.project_id)
      .run();
    expired += 1;
  }
  return { ok: true, expired, checked: (results || []).length };
}

/**
 * Find decisions expiring within warning window for notifications.
 * @param {*} env
 * @param {{ withinHours?: number, limit?: number }} [opts]
 */
export async function listDecisionsExpiringSoon(env, opts = {}) {
  const withinHours = Number(opts.withinHours) || 12;
  const limit = Math.min(200, Number(opts.limit) || 50);
  const now = new Date();
  const until = new Date(now.getTime() + withinHours * 3600 * 1000).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT message_id, project_id, room_id, content, expires_at
     FROM message_decisions
     WHERE state = 'pending' AND expires_at > ? AND expires_at <= ?
     LIMIT ?`,
  )
    .bind(now.toISOString(), until, limit)
    .all();
  return results || [];
}
