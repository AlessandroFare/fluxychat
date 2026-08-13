/**
 * PH-102: Presence-aware escalation chain.
 * Agent (or system) waits for a human; cron nudges the next online user in the chain.
 */
import { fetchAggregatedRoomLive, fanoutRoomInternal } from "./room-shard.js";
import { logInfo } from "./worker-log.js";

const MIN_NUDGE_SECONDS = 60;
const MAX_NUDGE_SECONDS = 86400;
const MAX_CHAIN_LENGTH = 20;
const MAX_USER_ID_LEN = 128;

function nowIso() {
  return new Date().toISOString();
}

function generateId() {
  return crypto.randomUUID();
}

/**
 * @param {unknown} chain
 * @returns {string[] | null}
 */
export function parseEscalationChain(chain) {
  if (!Array.isArray(chain)) return null;
  const normalized = chain
    .map((id) => String(id).trim())
    .filter((id) => id.length > 0 && id.length <= MAX_USER_ID_LEN);
  if (!normalized.length || normalized.length > MAX_CHAIN_LENGTH) return null;
  return normalized;
}

/**
 * Pick the next user in chain who is online, starting at tier index.
 * Skips users before currentTierIndex; wraps if everyone offline at this tier.
 * @param {string[]} chain
 * @param {Set<string>} onlineUserIds
 * @param {number} startTierIndex
 * @param {string | null} [skipUserId]
 * @returns {{ userId: string, tierIndex: number } | null}
 */
export function pickNextOnlineInChain(chain, onlineUserIds, startTierIndex, skipUserId) {
  if (!chain.length) return null;
  const start = Math.max(0, Math.min(startTierIndex, chain.length - 1));

  for (let offset = 0; offset < chain.length; offset++) {
    const tierIndex = (start + offset) % chain.length;
    const userId = chain[tierIndex];
    if (skipUserId && userId === skipUserId && offset < chain.length - 1) continue;
    if (onlineUserIds.has(userId)) {
      return { userId, tierIndex };
    }
  }
  return null;
}

function mapRow(row) {
  if (!row) return null;
  let chain = [];
  try {
    chain = JSON.parse(String(row.escalation_chain_json || "[]"));
  } catch {
    chain = [];
  }
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id,
    status: row.status,
    awaitingUserId: row.awaiting_user_id ?? null,
    escalationChain: chain,
    currentTierIndex: row.current_tier_index ?? 0,
    nudgeIntervalSeconds: row.nudge_interval_seconds ?? 300,
    awaitingResponseSince: row.awaiting_response_since,
    lastNudgeAt: row.last_nudge_at ?? null,
    lastNudgedUserId: row.last_nudged_user_id ?? null,
    resolvedAt: row.resolved_at ?? null,
    resolvedReason: row.resolved_reason ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * @param {*} env
 * @param {{ projectId: string, roomId: string }} scope
 */
export async function getActivePresenceEscalation(env, scope) {
  const row = await env.DB.prepare(
    `SELECT * FROM room_presence_escalations
     WHERE project_id = ? AND room_id = ? AND status = 'awaiting'
     LIMIT 1`,
  )
    .bind(scope.projectId, scope.roomId)
    .first();
  return mapRow(row);
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   escalationChain: string[],
 *   awaitingUserId?: string | null,
 *   nudgeIntervalSeconds?: number,
 * }} input
 */
export async function startPresenceEscalation(env, input) {
  const chain = parseEscalationChain(input.escalationChain);
  if (!chain) return { ok: false, error: "invalid_escalation_chain" };

  const existing = await getActivePresenceEscalation(env, {
    projectId: input.projectId,
    roomId: input.roomId,
  });
  if (existing) return { ok: false, error: "escalation_already_active", watch: existing };

  const nudgeIntervalSeconds = clampNudgeInterval(input.nudgeIntervalSeconds);
  const now = nowIso();
  const id = generateId();
  const awaitingUserId =
    typeof input.awaitingUserId === "string" && input.awaitingUserId.trim()
      ? input.awaitingUserId.trim()
      : chain[0];

  await env.DB.prepare(
    `INSERT INTO room_presence_escalations (
      id, project_id, room_id, status, awaiting_user_id, escalation_chain_json,
      current_tier_index, nudge_interval_seconds, awaiting_response_since,
      last_nudge_at, last_nudged_user_id, resolved_at, resolved_reason, created_at, updated_at
    ) VALUES (?, ?, ?, 'awaiting', ?, ?, 0, ?, ?, NULL, NULL, NULL, NULL, ?, ?)`,
  )
    .bind(
      id,
      input.projectId,
      input.roomId,
      awaitingUserId,
      JSON.stringify(chain),
      nudgeIntervalSeconds,
      now,
      now,
      now,
    )
    .run();

  await recordEscalationAudit(env, {
    projectId: input.projectId,
    roomId: input.roomId,
    watchId: id,
    action: "started",
    detail: { awaitingUserId, chainLength: chain.length },
  });

  return {
    ok: true,
    watch: mapRow({
      id,
      project_id: input.projectId,
      room_id: input.roomId,
      status: "awaiting",
      awaiting_user_id: awaitingUserId,
      escalation_chain_json: JSON.stringify(chain),
      current_tier_index: 0,
      nudge_interval_seconds: nudgeIntervalSeconds,
      awaiting_response_since: now,
      last_nudge_at: null,
      last_nudged_user_id: null,
      resolved_at: null,
      resolved_reason: null,
      created_at: now,
      updated_at: now,
    }),
  };
}

/**
 * @param {*} env
 * @param {{ projectId: string, roomId: string, reason?: string }} input
 */
export async function resolvePresenceEscalation(env, input) {
  const active = await getActivePresenceEscalation(env, {
    projectId: input.projectId,
    roomId: input.roomId,
  });
  if (!active) return { ok: false, error: "no_active_escalation" };

  const now = nowIso();
  const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 256) : "resolved";

  await env.DB.prepare(
    `UPDATE room_presence_escalations
     SET status = 'resolved', resolved_at = ?, resolved_reason = ?, updated_at = ?
     WHERE id = ? AND project_id = ?`,
  )
    .bind(now, reason, now, active.id, input.projectId)
    .run();

  await recordEscalationAudit(env, {
    projectId: input.projectId,
    roomId: input.roomId,
    watchId: active.id,
    action: "resolved",
    detail: { reason },
  });

  return { ok: true, resolvedAt: now, reason };
}

/**
 * @param {*} env
 * @param {{ projectId: string, roomId: string, responderUserId: string }} input
 */
export async function markPresenceEscalationResponded(env, input) {
  const active = await getActivePresenceEscalation(env, {
    projectId: input.projectId,
    roomId: input.roomId,
  });
  if (!active) return { ok: false, error: "no_active_escalation" };

  const chain = active.escalationChain;
  const isParticipant =
    input.responderUserId === active.awaitingUserId ||
    chain.includes(input.responderUserId) ||
    input.responderUserId === active.lastNudgedUserId;

  if (!isParticipant) return { ok: false, error: "not_escalation_participant" };

  return resolvePresenceEscalation(env, {
    projectId: input.projectId,
    roomId: input.roomId,
    reason: "human_responded",
  });
}

function clampNudgeInterval(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 300;
  return Math.min(MAX_NUDGE_SECONDS, Math.max(MIN_NUDGE_SECONDS, Math.floor(n)));
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   watchId: string,
 *   action: string,
 *   detail?: Record<string, unknown>,
 * }} input
 */
async function recordEscalationAudit(env, input) {
  if (!env?.DB) return;
  const now = nowIso();
  try {
    await env.DB.prepare(
      `INSERT INTO operational_audit_events (
        project_id, event_type, room_id, actor_user_id, payload_json, created_at
      ) VALUES (?, ?, ?, NULL, ?, ?)`,
    )
      .bind(
        input.projectId,
        `presence_escalation.${input.action}`,
        input.roomId,
        JSON.stringify({
          watchId: input.watchId,
          ...(input.detail ?? {}),
        }),
        now,
      )
      .run();
  } catch {
    /* audit best-effort */
  }
}

/**
 * Process one awaiting watch. Idempotent per nudge interval.
 * @param {*} env
 * @param {*} row
 */
export async function processPresenceEscalationWatch(env, row) {
  const watch = mapRow(row);
  if (!watch || watch.status !== "awaiting") return { action: "skip" };

  const nowMs = Date.now();
  const lastNudgeMs = watch.lastNudgeAt ? Date.parse(watch.lastNudgeAt) : 0;
  const sinceMs = Date.parse(watch.awaitingResponseSince);
  const intervalMs = watch.nudgeIntervalSeconds * 1000;
  const elapsedSinceStart = nowMs - sinceMs;

  if (elapsedSinceStart < intervalMs) {
    return { action: "waiting", watchId: watch.id };
  }

  const dueForNudge = !watch.lastNudgeAt || nowMs - lastNudgeMs >= intervalMs;
  if (!dueForNudge) {
    return { action: "already_nudged", watchId: watch.id, userId: watch.lastNudgedUserId };
  }

  const live = await fetchAggregatedRoomLive(env, watch.projectId, watch.roomId);
  const online = new Set(
    (live.users || []).filter((uid) => uid && !String(uid).startsWith("recovered:")),
  );

  if (watch.awaitingUserId && online.has(watch.awaitingUserId) && !watch.lastNudgeAt) {
    return { action: "awaiting_primary_online", watchId: watch.id };
  }

  const next = pickNextOnlineInChain(
    watch.escalationChain,
    online,
    watch.currentTierIndex,
    watch.lastNudgedUserId,
  );

  if (!next) {
    return { action: "no_one_online", watchId: watch.id };
  }

  const nudgeKey = `${watch.id}:${next.tierIndex}:${next.userId}`;
  if (watch.lastNudgedUserId === next.userId && watch.lastNudgeAt) {
    return { action: "already_nudged", watchId: watch.id, userId: next.userId };
  }

  const now = nowIso();
  await env.DB.prepare(
    `UPDATE room_presence_escalations
     SET current_tier_index = ?, last_nudge_at = ?, last_nudged_user_id = ?, updated_at = ?
     WHERE id = ? AND project_id = ? AND status = 'awaiting'`,
  )
    .bind(next.tierIndex, now, next.userId, now, watch.id, watch.projectId)
    .run();

  await fanoutRoomInternal(env, watch.projectId, watch.roomId, "/announce", {
    method: "POST",
    body: JSON.stringify({
      type: "server_event",
      roomId: watch.roomId,
      name: "presence_escalation.nudge",
      userId: "system",
      data: {
        watchId: watch.id,
        nudgedUserId: next.userId,
        tierIndex: next.tierIndex,
        awaitingUserId: watch.awaitingUserId,
      },
      at: now,
    }),
  });

  await recordEscalationAudit(env, {
    projectId: watch.projectId,
    roomId: watch.roomId,
    watchId: watch.id,
    action: "nudged",
    detail: { userId: next.userId, tierIndex: next.tierIndex, nudgeKey },
  });

  logInfo("presence_escalation.nudged", {
    projectId: watch.projectId,
    roomId: watch.roomId,
    userId: next.userId,
    tierIndex: next.tierIndex,
  });

  return {
    action: "nudged",
    watchId: watch.id,
    userId: next.userId,
    tierIndex: next.tierIndex,
  };
}

/**
 * Cron tick: process all awaiting watches (idempotent).
 * @param {*} env
 * @param {{ projectId?: string, limit?: number }} [opts]
 */
export async function tickPresenceEscalations(env, opts = {}) {
  if (!env?.DB) return { processed: 0, results: [] };

  let sql = `SELECT * FROM room_presence_escalations WHERE status = 'awaiting'`;
  const binds = [];
  if (opts.projectId) {
    sql += ` AND project_id = ?`;
    binds.push(opts.projectId);
  }
  sql += ` ORDER BY awaiting_response_since ASC LIMIT ?`;
  binds.push(Math.min(100, Math.max(1, Number(opts.limit) || 50)));

  const rows = await env.DB.prepare(sql).bind(...binds).all();
  const results = [];

  for (const row of rows.results || []) {
    const result = await processPresenceEscalationWatch(env, row);
    results.push(result);
  }

  return { processed: results.length, results };
}
