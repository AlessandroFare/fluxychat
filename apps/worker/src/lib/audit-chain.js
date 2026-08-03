/**
 * Append-only WORM-style audit hash chain per project (roadmap #20).
 * Rows are never updated or deleted by application code.
 */

export const AUDIT_CHAIN_GENESIS_HASH = "0".repeat(64);

export async function sha256Hex(input) {
  const data = new TextEncoder().encode(String(input));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function chainEnabled(env) {
  return env?.AUDIT_CHAIN_ENABLED === "true" || env?.AUDIT_CHAIN_ENABLED === "1";
}

/**
 * @param {*} env
 * @param {{ projectId: string, event: Record<string, unknown> }} input
 */
export async function appendRoomAuditChainEvent(env, input) {
  if (!env?.DB || !input?.projectId || !chainEnabled(env)) {
    return { ok: false, skipped: true };
  }

  const last = await env.DB.prepare(
    `SELECT event_hash FROM room_audit_chain WHERE project_id = ? ORDER BY id DESC LIMIT 1`,
  )
    .bind(input.projectId)
    .first();

  const prevHash = last?.event_hash ?? AUDIT_CHAIN_GENESIS_HASH;
  const createdAt = new Date().toISOString();
  const eventJson = JSON.stringify({ ...input.event, createdAt });
  const eventHash = await sha256Hex(`${prevHash}:${eventJson}`);

  await env.DB.prepare(
    `INSERT INTO room_audit_chain (project_id, prev_hash, event_hash, event_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(input.projectId, prevHash, eventHash, eventJson, createdAt)
    .run();

  return { ok: true, eventHash, prevHash };
}

/**
 * @param {*} env
 * @param {{ projectId: string, limit?: number }} input
 */
export async function verifyRoomAuditChain(env, input) {
  const limit = Math.min(Math.max(Number(input.limit ?? 5000), 1), 10000);
  const rows = await env.DB.prepare(
    `SELECT id, prev_hash, event_hash, event_json, created_at
     FROM room_audit_chain WHERE project_id = ? ORDER BY id ASC LIMIT ?`,
  )
    .bind(input.projectId, limit)
    .all();

  let prevHash = AUDIT_CHAIN_GENESIS_HASH;
  let valid = true;
  let firstBreakId = null;

  for (const row of rows.results || []) {
    if (row.prev_hash !== prevHash) {
      valid = false;
      firstBreakId = row.id;
      break;
    }
    const expected = await sha256Hex(`${row.prev_hash}:${row.event_json}`);
    if (expected !== row.event_hash) {
      valid = false;
      firstBreakId = row.id;
      break;
    }
    prevHash = row.event_hash;
  }

  return {
    ok: true,
    valid,
    count: (rows.results || []).length,
    firstBreakId,
    tipHash: prevHash,
  };
}

export async function exportRoomAuditChain(env, { projectId, limit = 500 }) {
  const capped = Math.min(Math.max(Number(limit), 1), 5000);
  const rows = await env.DB.prepare(
    `SELECT id, prev_hash, event_hash, event_json, created_at
     FROM room_audit_chain WHERE project_id = ? ORDER BY id ASC LIMIT ?`,
  )
    .bind(projectId, capped)
    .all();

  return {
    ok: true,
    projectId,
    entries: (rows.results || []).map((row) => ({
      id: row.id,
      prevHash: row.prev_hash,
      eventHash: row.event_hash,
      event: safeParseJson(row.event_json),
      createdAt: row.created_at,
    })),
  };
}

function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

/**
 * Export audit chain snapshot to R2 (WORM-style cold storage under audit-chain/ prefix).
 * Uses ATTACHMENTS bucket when AUDIT_CHAIN_R2 binding is not configured.
 */
export async function exportAuditChainToR2(env, { projectId, limit = 5000 }) {
  const bucket = env.AUDIT_CHAIN_R2 ?? env.ATTACHMENTS;
  if (!bucket?.put) {
    return { ok: false, error: "r2_not_configured" };
  }

  const exportData = await exportRoomAuditChain(env, { projectId, limit });
  const verify = await verifyRoomAuditChain(env, { projectId, limit });
  const exportedAt = new Date().toISOString();
  const payload = JSON.stringify({
    exportedAt,
    projectId,
    verify: {
      valid: verify.valid,
      count: verify.count,
      tipHash: verify.tipHash,
      firstBreakId: verify.firstBreakId ?? null,
    },
    entries: exportData.entries,
  });

  const key = `audit-chain/${projectId}/${exportedAt.replace(/[:.]/g, "-")}.json`;
  await bucket.put(key, payload, {
    httpMetadata: { contentType: "application/json" },
    customMetadata: {
      projectId,
      tipHash: verify.tipHash ?? "",
      entryCount: String(exportData.entries.length),
      chainValid: verify.valid ? "true" : "false",
    },
  });

  return {
    ok: true,
    key,
    bytes: payload.length,
    entryCount: exportData.entries.length,
    valid: verify.valid,
    tipHash: verify.tipHash,
  };
}

/**
 * Export audit chains for all projects with chain entries (scheduled job).
 */
export async function exportAllProjectAuditChainsToR2(env, { limitPerProject = 5000 } = {}) {
  if (env.AUDIT_CHAIN_R2_EXPORT_ENABLED === "false") {
    return { ok: true, skipped: true, exported: 0 };
  }

  const rows = await env.DB.prepare(
    `SELECT DISTINCT project_id FROM room_audit_chain ORDER BY project_id ASC`,
  ).all();

  let exported = 0;
  const results = [];
  for (const row of rows.results || []) {
    const result = await exportAuditChainToR2(env, {
      projectId: row.project_id,
      limit: limitPerProject,
    }).catch((err) => ({ ok: false, error: err?.message || "export_failed", projectId: row.project_id }));
    if (result.ok) exported++;
    results.push({ projectId: row.project_id, ...result });
  }

  return { ok: true, exported, projects: results.length, results };
}
