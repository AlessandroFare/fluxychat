/**
 * #50 Truth Market — internal-credits stake on verifiable claims.
 */
import { canAccessRoom } from "./room-access.js";

export const DEFAULT_TTL_SECONDS = 86_400;
export const MIN_TTL_SECONDS = 300;
export const MAX_TTL_SECONDS = 60 * 60 * 24 * 14;
export const MAX_CLAIM_CONTENT = 2000;
export const MAX_EVIDENCE = 4000;
export const DEFAULT_MIN_STAKE = 1;
export const DEFAULT_MAX_STAKE = 100;
export const DEFAULT_INITIAL_CREDITS = 50;
export const DISPUTE_RATE_LIMIT_WINDOW_SEC = 3600;
export const DISPUTE_RATE_LIMIT_MAX = 10;

const OPEN_STATES = new Set(["open", "disputed"]);
const TERMINAL_STATES = new Set([
  "verified_by_time",
  "disputed_confirmed",
  "disputed_rejected",
  "cancelled",
]);

function generateId(prefix) {
  return `${prefix}_${Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

function readStakeBounds(env) {
  const minStake = Number(env.TRUTH_MARKET_MIN_STAKE ?? DEFAULT_MIN_STAKE);
  const maxStake = Number(env.TRUTH_MARKET_MAX_STAKE ?? DEFAULT_MAX_STAKE);
  return {
    minStake: Number.isFinite(minStake) && minStake > 0 ? minStake : DEFAULT_MIN_STAKE,
    maxStake: Number.isFinite(maxStake) && maxStake > 0 ? maxStake : DEFAULT_MAX_STAKE,
  };
}

function mapClaimRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id,
    messageId: row.message_id != null ? Number(row.message_id) : null,
    agentId: row.agent_id,
    content: row.content,
    stakedByUserId: row.staked_by_user_id,
    stakeAmount: Number(row.stake_amount) || 0,
    currency: row.currency || "credits",
    ttlSeconds: Number(row.ttl_seconds) || DEFAULT_TTL_SECONDS,
    state: row.state,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

function mapDisputeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    claimId: row.claim_id,
    projectId: row.project_id,
    disputedByUserId: row.disputed_by_user_id,
    evidence: row.evidence,
    state: row.state,
    resolvedByUserId: row.resolved_by_user_id,
    outcome: row.outcome,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export async function getTruthCredits(env, { projectId, userId }) {
  const row = await env.DB.prepare(
    `SELECT balance, updated_at FROM truth_credits WHERE project_id = ? AND user_id = ? LIMIT 1`,
  )
    .bind(projectId, userId)
    .first();
  return {
    balance: Number(row?.balance ?? 0),
    updatedAt: row?.updated_at ?? null,
  };
}

export async function grantTruthCredits(env, { projectId, userId, amount, reason = "grant" }) {
  const delta = Number(amount);
  if (!Number.isFinite(delta) || delta <= 0) {
    return { ok: false, error: "amount must be positive" };
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO truth_credits (project_id, user_id, balance, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(project_id, user_id) DO UPDATE SET
       balance = truth_credits.balance + excluded.balance,
       updated_at = excluded.updated_at`,
  )
    .bind(projectId, userId, delta, now)
    .run();
  try {
    await env.DB.prepare(
      `INSERT INTO operational_audit_events (project_id, action, actor_user_id, details)
       VALUES (?, 'truth_market.credits_grant', ?, ?)`,
    )
      .bind(projectId, userId, JSON.stringify({ amount: delta, reason }))
      .run();
  } catch {
    /* non-critical */
  }
  const credits = await getTruthCredits(env, { projectId, userId });
  return { ok: true, credits };
}

async function ensureCreditsRow(env, { projectId, userId }) {
  const existing = await getTruthCredits(env, { projectId, userId });
  if (existing.balance > 0 || existing.updatedAt) return existing;
  const initial = Number(env.TRUTH_MARKET_INITIAL_CREDITS ?? DEFAULT_INITIAL_CREDITS);
  if (Number.isFinite(initial) && initial > 0) {
    await grantTruthCredits(env, {
      projectId,
      userId,
      amount: initial,
      reason: "initial_balance",
    });
    return getTruthCredits(env, { projectId, userId });
  }
  return existing;
}

async function adjustCredits(env, { projectId, userId, delta }) {
  await ensureCreditsRow(env, { projectId, userId });
  const now = new Date().toISOString();
  const row = await env.DB.prepare(
    `SELECT balance FROM truth_credits WHERE project_id = ? AND user_id = ? LIMIT 1`,
  )
    .bind(projectId, userId)
    .first();
  const current = Number(row?.balance ?? 0);
  const next = current + delta;
  if (next < 0) return { ok: false, error: "insufficient_credits", balance: current };
  await env.DB.prepare(
    `UPDATE truth_credits SET balance = ?, updated_at = ? WHERE project_id = ? AND user_id = ?`,
  )
    .bind(next, now, projectId, userId)
    .run();
  return { ok: true, balance: next };
}

export async function createTruthClaim(env, auth, input) {
  const projectId = auth.projectId;
  const roomId = String(input.roomId || "").trim();
  if (!roomId) return { ok: false, error: "roomId required" };

  const allowed = await canAccessRoom(env, auth, roomId);
  if (!allowed) return { ok: false, error: "forbidden" };

  const content = String(input.content ?? "").trim();
  if (!content || content.length > MAX_CLAIM_CONTENT) {
    return { ok: false, error: "content required (max 2000 chars)" };
  }

  const { minStake, maxStake } = readStakeBounds(env);
  const stakeAmount = Number(input.stakeAmount ?? input.stake ?? minStake);
  if (!Number.isFinite(stakeAmount) || stakeAmount < minStake || stakeAmount > maxStake) {
    return { ok: false, error: `stake must be between ${minStake} and ${maxStake} credits` };
  }

  let ttlSeconds = Number(input.ttlSeconds ?? DEFAULT_TTL_SECONDS);
  if (!Number.isFinite(ttlSeconds)) ttlSeconds = DEFAULT_TTL_SECONDS;
  ttlSeconds = Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, Math.floor(ttlSeconds)));

  const messageId = input.messageId != null ? Number(input.messageId) : null;
  if (messageId != null && messageId > 0) {
    const msg = await env.DB.prepare(
      `SELECT id FROM messages WHERE project_id = ? AND room_id = ? AND id = ? AND deleted_at IS NULL LIMIT 1`,
    )
      .bind(projectId, roomId, messageId)
      .first();
    if (!msg) return { ok: false, error: "message_not_found" };
  }

  const debit = await adjustCredits(env, {
    projectId,
    userId: auth.userId,
    delta: -stakeAmount,
  });
  if (!debit.ok) return { ok: false, error: debit.error, balance: debit.balance };

  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  const id = generateId("claim");

  await env.DB.prepare(
    `INSERT INTO truth_claims (
      id, project_id, room_id, message_id, agent_id, content,
      staked_by_user_id, stake_amount, currency, ttl_seconds, state, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'credits', ?, 'open', ?, ?)`,
  )
    .bind(
      id,
      projectId,
      roomId,
      messageId,
      input.agentId ? String(input.agentId) : null,
      content,
      auth.userId,
      stakeAmount,
      ttlSeconds,
      expiresAt,
      createdAt,
    )
    .run();

  return { ok: true, claim: mapClaimRow({
    id,
    project_id: projectId,
    room_id: roomId,
    message_id: messageId,
    agent_id: input.agentId ?? null,
    content,
    staked_by_user_id: auth.userId,
    stake_amount: stakeAmount,
    currency: "credits",
    ttl_seconds: ttlSeconds,
    state: "open",
    expires_at: expiresAt,
    created_at: createdAt,
    resolved_at: null,
  }) };
}

export async function listTruthClaims(env, { projectId, roomId, state, limit = 50 }) {
  let sql = `SELECT * FROM truth_claims WHERE project_id = ?`;
  const params = [projectId];
  if (roomId) {
    sql += ` AND room_id = ?`;
    params.push(roomId);
  }
  if (state) {
    sql += ` AND state = ?`;
    params.push(state);
  } else {
    sql += ` AND state IN ('open', 'disputed')`;
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));

  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapClaimRow);
}

export async function getTruthClaim(env, projectId, claimId) {
  const row = await env.DB.prepare(
    `SELECT * FROM truth_claims WHERE project_id = ? AND id = ? LIMIT 1`,
  )
    .bind(projectId, claimId)
    .first();
  return mapClaimRow(row);
}

export async function getTruthDisputesForClaim(env, projectId, claimId) {
  const rows = await env.DB.prepare(
    `SELECT * FROM truth_disputes WHERE project_id = ? AND claim_id = ? ORDER BY created_at ASC`,
  )
    .bind(projectId, claimId)
    .all();
  return (rows.results || []).map(mapDisputeRow);
}

export async function fileTruthDispute(env, auth, { claimId, evidence }) {
  const projectId = auth.projectId;
  const claim = await getTruthClaim(env, projectId, claimId);
  if (!claim) return { ok: false, error: "claim_not_found" };
  if (claim.state !== "open") return { ok: false, error: "claim_not_disputable" };
  if (claim.stakedByUserId === auth.userId) {
    return { ok: false, error: "cannot_dispute_own_claim" };
  }

  const allowed = await canAccessRoom(env, auth, claim.roomId);
  if (!allowed) return { ok: false, error: "forbidden" };

  const evidenceText = String(evidence ?? "").trim();
  if (!evidenceText || evidenceText.length > MAX_EVIDENCE) {
    return { ok: false, error: "evidence required (max 4000 chars)" };
  }

  const since = new Date(Date.now() - DISPUTE_RATE_LIMIT_WINDOW_SEC * 1000).toISOString();
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM truth_disputes
     WHERE project_id = ? AND disputed_by_user_id = ? AND created_at >= ?`,
  )
    .bind(projectId, auth.userId, since)
    .first();
  if (Number(recent?.c || 0) >= DISPUTE_RATE_LIMIT_MAX) {
    return { ok: false, error: "dispute_rate_limit_exceeded" };
  }

  const id = generateId("dispute");
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO truth_disputes (
      id, claim_id, project_id, disputed_by_user_id, evidence, state, created_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
  )
    .bind(id, claimId, projectId, auth.userId, evidenceText, now)
    .run();

  await env.DB.prepare(
    `UPDATE truth_claims SET state = 'disputed' WHERE id = ? AND project_id = ? AND state = 'open'`,
  )
    .bind(claimId, projectId)
    .run();

  return {
    ok: true,
    dispute: mapDisputeRow({
      id,
      claim_id: claimId,
      project_id: projectId,
      disputed_by_user_id: auth.userId,
      evidence: evidenceText,
      state: "pending",
      resolved_by_user_id: null,
      outcome: null,
      created_at: now,
      resolved_at: null,
    }),
  };
}

export async function resolveTruthDispute(env, auth, { claimId, disputeId, outcome }) {
  const projectId = auth.projectId;
  const normalized = String(outcome || "").trim().toLowerCase();
  if (normalized !== "confirmed" && normalized !== "rejected") {
    return { ok: false, error: "outcome must be confirmed or rejected" };
  }

  const claim = await getTruthClaim(env, projectId, claimId);
  if (!claim) return { ok: false, error: "claim_not_found" };
  if (claim.state !== "disputed") return { ok: false, error: "claim_not_in_dispute" };

  const disputeRow = await env.DB.prepare(
    `SELECT * FROM truth_disputes
     WHERE project_id = ? AND claim_id = ? AND id = ? AND state = 'pending' LIMIT 1`,
  )
    .bind(projectId, claimId, disputeId)
    .first();
  if (!disputeRow) return { ok: false, error: "dispute_not_found" };

  const now = new Date().toISOString();
  const claimState = normalized === "confirmed" ? "disputed_confirmed" : "disputed_rejected";

  await env.DB.prepare(
    `UPDATE truth_disputes
     SET state = 'resolved', outcome = ?, resolved_by_user_id = ?, resolved_at = ?
     WHERE id = ? AND project_id = ?`,
  )
    .bind(normalized, auth.userId, now, disputeId, projectId)
    .run();

  await env.DB.prepare(
    `UPDATE truth_claims SET state = ?, resolved_at = ? WHERE id = ? AND project_id = ?`,
  )
    .bind(claimState, now, claimId, projectId)
    .run();

  if (normalized === "confirmed") {
    await adjustCredits(env, {
      projectId,
      userId: disputeRow.disputed_by_user_id,
      delta: claim.stakeAmount,
    });
  } else {
    await adjustCredits(env, {
      projectId,
      userId: claim.stakedByUserId,
      delta: claim.stakeAmount,
    });
  }

  try {
    await env.DB.prepare(
      `INSERT INTO operational_audit_events (project_id, action, actor_user_id, details)
       VALUES (?, 'truth_market.dispute_resolved', ?, ?)`,
    )
      .bind(
        projectId,
        auth.userId,
        JSON.stringify({ claimId, disputeId, outcome: normalized, stakeAmount: claim.stakeAmount }),
      )
      .run();
  } catch {
    /* non-critical */
  }

  return {
    ok: true,
    claim: await getTruthClaim(env, projectId, claimId),
    dispute: mapDisputeRow({
      ...disputeRow,
      state: "resolved",
      outcome: normalized,
      resolved_by_user_id: auth.userId,
      resolved_at: now,
    }),
  };
}

export async function expireOpenTruthClaims(env) {
  const now = new Date().toISOString();
  const rows = await env.DB.prepare(
    `SELECT * FROM truth_claims
     WHERE state = 'open' AND expires_at <= ?
     ORDER BY expires_at ASC
     LIMIT 100`,
  )
    .bind(now)
    .all();

  let expired = 0;
  for (const row of rows.results || []) {
    const claim = mapClaimRow(row);
    if (!claim || !OPEN_STATES.has(claim.state) || claim.state !== "open") continue;

    await env.DB.prepare(
      `UPDATE truth_claims SET state = 'verified_by_time', resolved_at = ? WHERE id = ? AND state = 'open'`,
    )
      .bind(now, claim.id)
      .run();

    await adjustCredits(env, {
      projectId: claim.projectId,
      userId: claim.stakedByUserId,
      delta: claim.stakeAmount,
    });
    expired++;
  }
  return { expired };
}

export function isTerminalClaimState(state) {
  return TERMINAL_STATES.has(state);
}
