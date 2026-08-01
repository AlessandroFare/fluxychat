/**
 * PG-ZB-7 — MCP marketplace audit results from CI (mcp-audit-scanner).
 * @see https://github.com/adudley78/mcp-audit
 */

/**
 * @param {number} score
 */
export function auditGradeFromScore(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * @param {import("@cloudflare/workers-types").D1Database} db
 * @param {string} serverId
 */
export async function getLatestMarketplaceAudit(db, serverId) {
  if (!db) return null;
  const row = await db
    .prepare(
      `SELECT server_id, score, findings_json, severity_critical, severity_high,
              scanner_version, scanner_name, scanned_at
       FROM marketplace_audits
       WHERE server_id = ?
       ORDER BY scanned_at DESC
       LIMIT 1`,
    )
    .bind(serverId)
    .first();
  if (!row) return null;
  return {
    serverId: row.server_id,
    score: row.score,
    grade: auditGradeFromScore(Number(row.score)),
    severityCritical: row.severity_critical,
    severityHigh: row.severity_high,
    scannerVersion: row.scanner_version,
    scannerName: row.scanner_name,
    scannedAt: row.scanned_at,
    findings: parseFindingsJson(row.findings_json),
  };
}

/**
 * @param {import("@cloudflare/workers-types").D1Database} db
 * @param {{
 *   serverId: string,
 *   score?: number,
 *   grade?: string,
 *   severityCritical?: number,
 *   severityHigh?: number,
 *   findings?: unknown,
 *   scannerVersion?: string,
 *   scannerName?: string,
 * }} payload
 */
export async function recordMarketplaceAudit(db, payload) {
  if (!db) throw new Error("db_unavailable");
  const score = Number(payload.score ?? 0);
  const scannedAt = Date.now();
  await db
    .prepare(
      `INSERT INTO marketplace_audits
       (server_id, project_id, score, findings_json, severity_critical, severity_high, scanner_version, scanner_name, scanned_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      payload.serverId,
      score,
      JSON.stringify(payload.findings ?? []),
      Number(payload.severityCritical ?? 0),
      Number(payload.severityHigh ?? 0),
      payload.scannerVersion ?? "unknown",
      payload.scannerName ?? "mcp-audit",
      scannedAt,
    )
    .run();
  return {
    serverId: payload.serverId,
    score,
    grade: payload.grade ?? auditGradeFromScore(score),
    scannedAt,
  };
}

/**
 * @param {unknown} raw
 */
function parseFindingsJson(raw) {
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
