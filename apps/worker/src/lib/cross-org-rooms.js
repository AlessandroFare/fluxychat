/**
 * Cross-Org Agent Rooms (#32) — neutral host, escrow commitments, human gates.
 */

import { appendCrossOrgAuditEvent } from "./cross-org-audit.js";

const MAX_ROOM_NAME_LENGTH = 128;

function validateRoomName(name) {
  if (typeof name !== "string") {
    return { valid: false, error: "name must be a string" };
  }
  const trimmed = name.trim();
  if (!trimmed.length) return { valid: false, error: "name cannot be empty" };
  if (trimmed.length > MAX_ROOM_NAME_LENGTH) {
    return { valid: false, error: `name exceeds maximum length of ${MAX_ROOM_NAME_LENGTH} characters` };
  }
  return { valid: true, name: trimmed };
}

/**
 * @param {*} row
 */
export function mapCrossOrgRoomRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    roomId: String(row.room_id),
    name: String(row.name),
    orgAId: String(row.org_a_id),
    orgBId: String(row.org_b_id),
    orgAAgentId: row.org_a_agent_id ? String(row.org_a_agent_id) : null,
    orgBAgentId: row.org_b_agent_id ? String(row.org_b_agent_id) : null,
    maxRounds: Number(row.max_rounds) || 5,
    status: String(row.status),
    createdAt: String(row.created_at),
    createdBy: String(row.created_by),
  };
}

/**
 * @param {*} row
 */
export function mapCommitmentRow(row) {
  if (!row) return null;
  let terms = {};
  try {
    terms = JSON.parse(String(row.terms_json || "{}"));
  } catch {
    terms = {};
  }
  return {
    id: String(row.id),
    crossOrgRoomId: String(row.cross_org_room_id),
    roomId: String(row.room_id),
    proposedByOrg: String(row.proposed_by_org),
    proposedByAgent: row.proposed_by_agent ? String(row.proposed_by_agent) : null,
    terms,
    state: String(row.state),
    roundNumber: Number(row.round_number) || 1,
    ttlSeconds: Number(row.ttl_seconds) || 86400,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    humanAConfirmedAt: row.human_a_confirmed_at ? String(row.human_a_confirmed_at) : null,
    humanBConfirmedAt: row.human_b_confirmed_at ? String(row.human_b_confirmed_at) : null,
    parentCommitmentId: row.parent_commitment_id ? String(row.parent_commitment_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   userId: string,
 *   name: string,
 *   orgAId: string,
 *   orgBId: string,
 *   orgAAgentId?: string,
 *   orgBAgentId?: string,
 *   maxRounds?: number,
 *   roomId?: string,
 * }} input
 */
export async function createCrossOrgRoom(env, input) {
  const nameValidation = validateRoomName(input.name);
  if (!nameValidation.valid) return { ok: false, reason: nameValidation.error };

  const orgAId = String(input.orgAId || "").trim();
  const orgBId = String(input.orgBId || "").trim();
  if (!orgAId || !orgBId || orgAId === orgBId) {
    return { ok: false, reason: "invalid_org_pair" };
  }

  const now = new Date().toISOString();
  const crossOrgId = crypto.randomUUID();
  const roomId = input.roomId?.trim() || `cross-org-${crossOrgId.slice(0, 8)}`;
  const maxRounds = Math.min(20, Math.max(1, Number(input.maxRounds) || 5));

  await env.DB.prepare(
    `INSERT INTO rooms (id, project_id, type, name, created_at)
     VALUES (?, ?, 'cross_org', ?, ?)`,
  )
    .bind(roomId, input.projectId, nameValidation.name, now)
    .run();

  await env.DB.prepare(
    `INSERT INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)`,
  )
    .bind(roomId, input.userId, now)
    .run();

  await env.DB.prepare(
    `INSERT INTO cross_org_rooms
     (id, project_id, room_id, name, org_a_id, org_b_id, org_a_agent_id, org_b_agent_id,
      max_rounds, status, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
  )
    .bind(
      crossOrgId,
      input.projectId,
      roomId,
      nameValidation.name,
      orgAId,
      orgBId,
      input.orgAAgentId ?? null,
      input.orgBAgentId ?? null,
      maxRounds,
      now,
      input.userId,
    )
    .run();

  await appendCrossOrgAuditEvent(env, {
    crossOrgRoomId: crossOrgId,
    projectId: input.projectId,
    orgId: orgAId,
    event: { type: "room.created", orgAId, orgBId, roomId },
  });

  const row = await getCrossOrgRoom(env, input.projectId, crossOrgId);
  return { ok: true, room: row };
}

/** @param {*} env @param {string} projectId @param {string} crossOrgRoomId */
export async function getCrossOrgRoom(env, projectId, crossOrgRoomId) {
  const row = await env.DB.prepare(
    `SELECT * FROM cross_org_rooms WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, crossOrgRoomId)
    .first();
  return mapCrossOrgRoomRow(row);
}

/** @param {*} env @param {string} projectId */
export async function listCrossOrgRooms(env, projectId) {
  const rows = await env.DB.prepare(
    `SELECT * FROM cross_org_rooms WHERE project_id = ? ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapCrossOrgRoomRow);
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   crossOrgRoomId: string,
 *   orgId: string,
 *   agentId: string,
 *   publicKeyB64: string,
 *   capabilities?: string[],
 *   card: Record<string, unknown>,
 * }} input
 */
export async function registerCrossOrgAgent(env, input) {
  const room = await getCrossOrgRoom(env, input.projectId, input.crossOrgRoomId);
  if (!room) return { ok: false, reason: "room_not_found" };
  if (input.orgId !== room.orgAId && input.orgId !== room.orgBId) {
    return { ok: false, reason: "org_not_in_room" };
  }
  if (!input.publicKeyB64?.trim() || !input.agentId?.trim()) {
    return { ok: false, reason: "agent_identity_required" };
  }

  const now = new Date().toISOString();
  const cardJson = JSON.stringify({
    ...input.card,
    agent_id: input.agentId,
    org_id: input.orgId,
    public_key: input.publicKeyB64,
    capabilities: input.capabilities ?? [],
    issued_at: now,
  });

  await env.DB.prepare(
    `INSERT INTO cross_org_agent_identities
     (cross_org_room_id, project_id, org_id, agent_id, public_key_b64, capabilities_json, card_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(cross_org_room_id, org_id, agent_id) DO UPDATE SET
       public_key_b64 = excluded.public_key_b64,
       capabilities_json = excluded.capabilities_json,
       card_json = excluded.card_json`,
  )
    .bind(
      input.crossOrgRoomId,
      input.projectId,
      input.orgId,
      input.agentId,
      input.publicKeyB64.trim(),
      JSON.stringify(input.capabilities ?? []),
      cardJson,
      now,
    )
    .run();

  if (input.orgId === room.orgAId) {
    await env.DB.prepare(
      `UPDATE cross_org_rooms SET org_a_agent_id = ? WHERE id = ? AND project_id = ?`,
    )
      .bind(input.agentId, input.crossOrgRoomId, input.projectId)
      .run();
  } else {
    await env.DB.prepare(
      `UPDATE cross_org_rooms SET org_b_agent_id = ? WHERE id = ? AND project_id = ?`,
    )
      .bind(input.agentId, input.crossOrgRoomId, input.projectId)
      .run();
  }

  await appendCrossOrgAuditEvent(env, {
    crossOrgRoomId: input.crossOrgRoomId,
    projectId: input.projectId,
    orgId: input.orgId,
    event: { type: "agent.registered", agentId: input.agentId, orgId: input.orgId },
  });

  return { ok: true, agentId: input.agentId, orgId: input.orgId };
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   crossOrgRoomId: string,
 *   proposedByOrg: string,
 *   proposedByAgent?: string,
 *   terms: Record<string, unknown>,
 *   ttlSeconds?: number,
 * }} input
 */
/**
 * Optional private floor: reject offers below floorPrice / min_price.
 * @param {Record<string, unknown>} terms
 */
export function assertNegotiationFloorPrice(terms) {
  if (!terms || typeof terms !== "object") return { ok: true };
  const floor = Number(terms.floorPrice ?? terms.min_price ?? terms.minPrice);
  const price = Number(terms.unit_price_usd ?? terms.price ?? terms.amount);
  if (!Number.isFinite(floor)) return { ok: true };
  if (!Number.isFinite(price)) return { ok: false, reason: "price_required_with_floor" };
  if (price < floor) return { ok: false, reason: "below_floor_price", floor, price };
  return { ok: true };
}

export async function proposeCommitment(env, input) {
  const room = await getCrossOrgRoom(env, input.projectId, input.crossOrgRoomId);
  if (!room) return { ok: false, reason: "room_not_found" };
  if (input.proposedByOrg !== room.orgAId && input.proposedByOrg !== room.orgBId) {
    return { ok: false, reason: "org_not_in_room" };
  }

  const floorCheck = assertNegotiationFloorPrice(input.terms ?? {});
  if (!floorCheck.ok) return floorCheck;

  const now = new Date().toISOString();
  const commitmentId = crypto.randomUUID();
  const ttlSeconds = Math.min(604800, Math.max(300, Number(input.ttlSeconds) || 86400));
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO cross_org_commitments
     (id, cross_org_room_id, project_id, room_id, proposed_by_org, proposed_by_agent,
      terms_json, state, round_number, ttl_seconds, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'proposed', 1, ?, ?, ?, ?)`,
  )
    .bind(
      commitmentId,
      input.crossOrgRoomId,
      input.projectId,
      room.roomId,
      input.proposedByOrg,
      input.proposedByAgent ?? null,
      JSON.stringify(input.terms ?? {}),
      ttlSeconds,
      expiresAt,
      now,
      now,
    )
    .run();

  await appendCrossOrgAuditEvent(env, {
    crossOrgRoomId: input.crossOrgRoomId,
    projectId: input.projectId,
    orgId: input.proposedByOrg,
    event: { type: "commitment.proposed", commitmentId, terms: input.terms },
  });

  return { ok: true, commitment: await getCommitment(env, input.projectId, commitmentId) };
}

/** @param {*} env @param {string} projectId @param {string} commitmentId */
export async function getCommitment(env, projectId, commitmentId) {
  const row = await env.DB.prepare(
    `SELECT * FROM cross_org_commitments WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, commitmentId)
    .first();
  return mapCommitmentRow(row);
}

/** @param {*} env @param {string} projectId @param {string} crossOrgRoomId */
export async function listCommitments(env, projectId, crossOrgRoomId) {
  const rows = await env.DB.prepare(
    `SELECT * FROM cross_org_commitments
     WHERE project_id = ? AND cross_org_room_id = ?
     ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(projectId, crossOrgRoomId)
    .all();
  return (rows.results || []).map(mapCommitmentRow);
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   commitmentId: string,
 *   counterByOrg: string,
 *   terms: Record<string, unknown>,
 *   proposedByAgent?: string,
 * }} input
 */
export async function counterCommitment(env, input) {
  const existing = await getCommitment(env, input.projectId, input.commitmentId);
  if (!existing) return { ok: false, reason: "commitment_not_found" };
  if (!["proposed", "countered"].includes(existing.state)) {
    return { ok: false, reason: "invalid_state_for_counter" };
  }

  const room = await getCrossOrgRoom(env, input.projectId, existing.crossOrgRoomId);
  if (!room) return { ok: false, reason: "room_not_found" };
  if (input.counterByOrg !== room.orgAId && input.counterByOrg !== room.orgBId) {
    return { ok: false, reason: "org_not_in_room" };
  }
  if (input.counterByOrg === existing.proposedByOrg) {
    return { ok: false, reason: "cannot_counter_own_proposal" };
  }

  const floorCheck = assertNegotiationFloorPrice(input.terms ?? {});
  if (!floorCheck.ok) return floorCheck;

  const nextRound = existing.roundNumber + 1;
  if (nextRound > room.maxRounds) {
    return { ok: false, reason: "max_rounds_exceeded", maxRounds: room.maxRounds };
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE cross_org_commitments SET
       terms_json = ?, state = 'countered', round_number = ?, proposed_by_org = ?,
       proposed_by_agent = ?, human_a_confirmed_at = NULL, human_b_confirmed_at = NULL,
       updated_at = ?
     WHERE id = ? AND project_id = ?`,
  )
    .bind(
      JSON.stringify(input.terms ?? {}),
      nextRound,
      input.counterByOrg,
      input.proposedByAgent ?? null,
      now,
      input.commitmentId,
      input.projectId,
    )
    .run();

  await appendCrossOrgAuditEvent(env, {
    crossOrgRoomId: existing.crossOrgRoomId,
    projectId: input.projectId,
    orgId: input.counterByOrg,
    event: { type: "commitment.countered", commitmentId: input.commitmentId, round: nextRound },
  });

  return { ok: true, commitment: await getCommitment(env, input.projectId, input.commitmentId) };
}

/**
 * Human approval gate — both orgs must confirm before committed.
 * @param {*} env
 * @param {{ projectId: string, commitmentId: string, orgId: string, userId: string }} input
 */
export async function approveCommitment(env, input) {
  const existing = await getCommitment(env, input.projectId, input.commitmentId);
  if (!existing) return { ok: false, reason: "commitment_not_found" };
  if (["committed", "expired", "rejected"].includes(existing.state)) {
    return { ok: false, reason: "commitment_closed", state: existing.state };
  }
  if (existing.expiresAt && Date.parse(existing.expiresAt) < Date.now()) {
    await env.DB.prepare(
      `UPDATE cross_org_commitments SET state = 'expired', updated_at = ? WHERE id = ?`,
    )
      .bind(new Date().toISOString(), input.commitmentId)
      .run();
    return { ok: false, reason: "commitment_expired" };
  }

  const room = await getCrossOrgRoom(env, input.projectId, existing.crossOrgRoomId);
  if (!room) return { ok: false, reason: "room_not_found" };

  const isOrgA = input.orgId === room.orgAId;
  const isOrgB = input.orgId === room.orgBId;
  if (!isOrgA && !isOrgB) return { ok: false, reason: "org_not_in_room" };

  const now = new Date().toISOString();
  let humanA = existing.humanAConfirmedAt;
  let humanB = existing.humanBConfirmedAt;
  if (isOrgA) humanA = now;
  if (isOrgB) humanB = now;

  let nextState = "pending_human_both";
  if (humanA && !humanB) nextState = "pending_human_b";
  else if (!humanA && humanB) nextState = "pending_human_a";
  else if (humanA && humanB) nextState = "committed";

  await env.DB.prepare(
    `UPDATE cross_org_commitments SET
       human_a_confirmed_at = ?, human_b_confirmed_at = ?, state = ?, updated_at = ?
     WHERE id = ? AND project_id = ?`,
  )
    .bind(humanA, humanB, nextState, now, input.commitmentId, input.projectId)
    .run();

  await appendCrossOrgAuditEvent(env, {
    crossOrgRoomId: existing.crossOrgRoomId,
    projectId: input.projectId,
    orgId: input.orgId,
    event: {
      type: nextState === "committed" ? "commitment.committed" : "commitment.human_approved",
      commitmentId: input.commitmentId,
      userId: input.userId,
      state: nextState,
    },
  });

  return { ok: true, commitment: await getCommitment(env, input.projectId, input.commitmentId) };
}

/** @param {*} env */
export async function expireStaleCrossOrgCommitments(env) {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE cross_org_commitments SET state = 'expired', updated_at = ?
     WHERE state NOT IN ('committed', 'expired', 'rejected')
       AND expires_at IS NOT NULL AND expires_at < ?`,
  )
    .bind(now, now)
    .run();
  return { expired: Number(result.meta?.changes || 0) };
}
