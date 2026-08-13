/**
 * CP-072: Validated outbound URL fetch with audit trail.
 */
import { assertSafeOutboundUrl, isPrivateUrl, safeOutboundFetch } from "./url-ssrf.js";
import { logInfo } from "./worker-log.js";

/**
 * @param {string} urlString
 * @param {*} [env]
 * @returns {{ ok: true, url: URL } | { ok: false, reason: string }}
 */
export function validateUrl(urlString, env) {
  if (!urlString || typeof urlString !== "string") {
    return { ok: false, reason: "invalid_url" };
  }
  if (isPrivateUrl(urlString, env)) {
    return { ok: false, reason: "ssrf_blocked" };
  }
  try {
    const url = assertSafeOutboundUrl(urlString, env);
    return { ok: true, url };
  } catch (err) {
    return { ok: false, reason: err?.message || "ssrf_blocked" };
  }
}

/**
 * @param {*} env
 * @param {{
 *   projectId?: string,
 *   feature: string,
 *   url: string,
 *   outcome: string,
 *   blockedReason?: string,
 *   httpStatus?: number,
 * }} entry
 */
export async function recordUrlFetchAudit(env, entry) {
  if (!env?.DB) return;
  const id = `ufa_${crypto.randomUUID().slice(0, 12)}`;
  await env.DB.prepare(
    `INSERT INTO url_fetch_audit
     (id, project_id, feature, url, outcome, blocked_reason, http_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      entry.projectId || null,
      entry.feature,
      String(entry.url).slice(0, 2048),
      entry.outcome,
      entry.blockedReason || null,
      entry.httpStatus ?? null,
      new Date().toISOString(),
    )
    .run()
    .catch(() => {});
}

/**
 * Validate, fetch, and audit an outbound URL.
 * @param {*} env
 * @param {{ url: string, projectId?: string, feature: string, init?: RequestInit }} opts
 */
export async function fetchUrlWithAudit(env, opts) {
  const validation = validateUrl(opts.url, env);
  if (!validation.ok) {
    await recordUrlFetchAudit(env, {
      projectId: opts.projectId,
      feature: opts.feature,
      url: opts.url,
      outcome: "blocked",
      blockedReason: validation.reason,
    });
    logInfo("url_fetch.blocked", {
      feature: opts.feature,
      url: opts.url,
      reason: validation.reason,
    });
    return { ok: false, error: validation.reason };
  }

  try {
    const response = await safeOutboundFetch(opts.url, opts.init, env);
    await recordUrlFetchAudit(env, {
      projectId: opts.projectId,
      feature: opts.feature,
      url: opts.url,
      outcome: response.ok ? "success" : "http_error",
      httpStatus: response.status,
    });
    return { ok: response.ok, response, status: response.status };
  } catch (err) {
    const reason = err?.message || "fetch_failed";
    await recordUrlFetchAudit(env, {
      projectId: opts.projectId,
      feature: opts.feature,
      url: opts.url,
      outcome: "error",
      blockedReason: reason,
    });
    return { ok: false, error: reason };
  }
}

export async function listUrlFetchAudit(env, { projectId, feature, limit = 50 }) {
  let sql = `SELECT id, project_id, feature, url, outcome, blocked_reason, http_status, created_at
             FROM url_fetch_audit WHERE project_id = ?`;
  const params = [projectId];
  if (feature) {
    sql += " AND feature = ?";
    params.push(feature);
  }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(Math.min(limit, 200));
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map((r) => ({
    id: r.id,
    projectId: r.project_id,
    feature: r.feature,
    url: r.url,
    outcome: r.outcome,
    blockedReason: r.blocked_reason,
    httpStatus: r.http_status,
    createdAt: r.created_at,
  }));
}
