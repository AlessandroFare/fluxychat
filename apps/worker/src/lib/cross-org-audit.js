/**
 * Bilateral hash-chain audit log for Cross-Org Agent Rooms (#32).
 */

import { sha256Hex, AUDIT_CHAIN_GENESIS_HASH } from "./audit-chain.js";

/**
 * @param {*} env
 * @param {{ crossOrgRoomId: string, projectId: string, orgId?: string, event: Record<string, unknown> }} input
 */
export async function appendCrossOrgAuditEvent(env, input) {
  const last = await env.DB.prepare(
    `SELECT event_hash FROM cross_org_audit_log
     WHERE cross_org_room_id = ? ORDER BY id DESC LIMIT 1`,
  )
    .bind(input.crossOrgRoomId)
    .first();

  const prevHash = last?.event_hash ?? AUDIT_CHAIN_GENESIS_HASH;
  const createdAt = new Date().toISOString();
  const eventJson = JSON.stringify({ ...input.event, createdAt });
  const eventHash = await sha256Hex(`${prevHash}:${eventJson}`);

  const insert = await env.DB.prepare(
    `INSERT INTO cross_org_audit_log
     (cross_org_room_id, project_id, prev_hash, event_hash, event_json, org_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      input.crossOrgRoomId,
      input.projectId,
      prevHash,
      eventHash,
      eventJson,
      input.orgId ?? null,
      createdAt,
    )
    .run();

  return {
    ok: true,
    id: insert.meta.last_row_id,
    eventHash,
    prevHash,
    createdAt,
  };
}

/**
 * @param {*} env
 * @param {{ crossOrgRoomId: string, projectId: string, limit?: number }} input
 */
export async function listCrossOrgAuditLog(env, input) {
  const limit = Math.min(Math.max(Number(input.limit ?? 200), 1), 1000);
  const rows = await env.DB.prepare(
    `SELECT id, prev_hash, event_hash, event_json, org_id, created_at
     FROM cross_org_audit_log
     WHERE cross_org_room_id = ? AND project_id = ?
     ORDER BY id ASC LIMIT ?`,
  )
    .bind(input.crossOrgRoomId, input.projectId, limit)
    .all();

  return (rows.results || []).map((row) => ({
    id: Number(row.id),
    prevHash: String(row.prev_hash),
    eventHash: String(row.event_hash),
    orgId: row.org_id ? String(row.org_id) : null,
    event: safeParseJson(row.event_json),
    createdAt: String(row.created_at),
  }));
}

/**
 * @param {*} env
 * @param {{ crossOrgRoomId: string, projectId: string, limit?: number }} input
 */
export async function verifyCrossOrgAuditChain(env, input) {
  const entries = await listCrossOrgAuditLog(env, input);
  let prevHash = AUDIT_CHAIN_GENESIS_HASH;
  for (const entry of entries) {
    if (entry.prevHash !== prevHash) {
      return { ok: true, valid: false, count: entries.length, firstBreakId: entry.id };
    }
    const expected = await sha256Hex(`${entry.prevHash}:${JSON.stringify(entry.event)}`);
    if (expected !== entry.eventHash) {
      return { ok: true, valid: false, count: entries.length, firstBreakId: entry.id };
    }
    prevHash = entry.eventHash;
  }
  return { ok: true, valid: true, count: entries.length, tipHash: prevHash };
}

function safeParseJson(raw) {
  try {
    return JSON.parse(String(raw));
  } catch {
    return { raw: String(raw) };
  }
}
