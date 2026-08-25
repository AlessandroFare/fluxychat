/**
 * F3 — Cross-org commitment settlement (pluggable provider interface).
 *
 * THE PRODUCT PROMISE
 * -------------------
 * "A binding inter-company agreement negotiated by agents and settled
 * automatically, with a verifiable transcript."
 *
 * The negotiation machinery already exists (cross_org_commitments + human
 * quorum + private reserves + audit chain). This module closes the loop: the
 * moment both humans confirm, a settlement record is created through a
 * provider, so execution — manual today, x402/on-chain tomorrow — attaches at
 * exactly one seam.
 *
 * PROVIDERS
 * ---------
 * - "manual" (default, zero external deps): records intent + terms snapshot.
 *   Parties settle out of band; operator marks settled via markSettlement.
 * - "x402": NOT implemented here. x402 is HTTP-native payment (402 -> pay ->
 *   retry) aimed at machine-to-machine API access; wiring real funds requires
 *   a wallet/RPC decision that belongs to deployment config, not to this repo's
 *   core. The provider field + external_ref column exist so attaching it later
 *   needs NO migration and NO change to the commitment flow.
 */

import { sha256Hex } from "./audit-chain.js";

export const SETTLEMENT_PROVIDERS = Object.freeze(["manual"]);
export const DEFAULT_SETTLEMENT_PROVIDER = "manual";

/**
 * Extract the commercial summary from shared commitment terms. Private reserve
 * values are deliberately EXCLUDED — settlements are readable by both orgs.
 * @param {Record<string, unknown> | null | undefined} publicTerms
 */
export function deriveSettlementTerms(publicTerms) {
  const t = publicTerms && typeof publicTerms === "object" ? publicTerms : {};
  const amount = Number(
    t.unit_price_usd ?? t.price ?? t.amount ?? NaN,
  );
  return {
    amount: Number.isFinite(amount) ? amount : null,
    currency: typeof t.currency === "string" && t.currency ? t.currency : "USD",
  };
}

/** Pure status machine for a settlement lifecycle. */
export function canTransitionSettlement(from, to) {
  const allowed = {
    pending: ["settled", "failed"],
    failed: ["pending", "settled"],
    settled: [],
  };
  return (allowed[from] ?? []).includes(to);
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * Create the settlement row when a commitment reaches `committed`.
 * Idempotent per commitment (UNIQUE(commitment_id)): a double-confirm race
 * inserts once.
 *
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   crossOrgRoomId: string,
 *   commitmentId: string,
 *   publicTerms?: Record<string, unknown>,
 *   provider?: string,
 * }} input
 */
export async function createCommitmentSettlement(env, input) {
  if (!env?.DB) return { ok: false, reason: "db_missing" };
  const provider =
    input.provider && SETTLEMENT_PROVIDERS.includes(input.provider)
      ? input.provider
      : DEFAULT_SETTLEMENT_PROVIDER;
  const { amount, currency } = deriveSettlementTerms(input.publicTerms);
  const now = nowIso();
  // Deterministic id: same commitment always maps to the same settlement id,
  // so INSERT OR IGNORE gives us idempotency even across racing approvers.
  const id = await sha256Hex(`settlement:${input.projectId}:${input.commitmentId}`);

  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO cross_org_settlements
       (id, project_id, cross_org_room_id, commitment_id, provider, status,
        amount, currency, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
    )
      .bind(
        id,
        input.projectId,
        input.crossOrgRoomId,
        input.commitmentId,
        provider,
        amount,
        currency,
        now,
        now,
      )
      .run();
  } catch {
    return { ok: false, reason: "settlement_insert_failed" };
  }

  return { ok: true, settlementId: id, provider, amount, currency, status: "pending" };
}

/**
 * Fetch one settlement by commitment id.
 * @param {*} env
 */
export async function getSettlementByCommitment(env, projectId, commitmentId) {
  const row = await env.DB.prepare(
    `SELECT id, project_id, cross_org_room_id, commitment_id, provider, status,
            amount, currency, external_ref, created_at, updated_at
     FROM cross_org_settlements WHERE project_id = ? AND commitment_id = ?`,
  )
    .bind(projectId, commitmentId)
    .first();
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    crossOrgRoomId: row.cross_org_room_id,
    commitmentId: row.commitment_id,
    provider: row.provider,
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    externalRef: row.external_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Advance a settlement's status through the lifecycle.
 * @param {*} env
 */
export async function markSettlement(env, projectId, commitmentId, toStatus, { externalRef } = {}) {
  if (!["settled", "failed", "pending"].includes(toStatus)) {
    return { ok: false, reason: "invalid_status" };
  }
  const existing = await getSettlementByCommitment(env, projectId, commitmentId);
  if (!existing) return { ok: false, reason: "settlement_not_found" };
  if (!canTransitionSettlement(existing.status, toStatus)) {
    return { ok: false, reason: "invalid_transition", from: existing.status, to: toStatus };
  }

  await env.DB.prepare(
    `UPDATE cross_org_settlements
     SET status = ?, external_ref = COALESCE(?, external_ref), updated_at = ?
     WHERE project_id = ? AND commitment_id = ?`,
  )
    .bind(toStatus, externalRef ?? null, nowIso(), projectId, commitmentId)
    .run();

  return { ok: true, settlement: await getSettlementByCommitment(env, projectId, commitmentId) };
}
