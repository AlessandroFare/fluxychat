function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function ipToNumber(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function ipInCidr(ip, network, prefix) {
  const ipNum = ipToNumber(ip);
  const netNum = ipToNumber(network);
  if (ipNum === null || netNum === null) return false;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipNum & mask) === (netNum & mask);
}

function normalizeClientIp(raw) {
  const ip = String(raw || "").trim();
  if (!ip) return "";
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) evaluates as its IPv4 form; other IPv6
  // addresses have no IPv4 representation.
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return mapped ? mapped[1] : ip;
}

export function isIpAllowed(clientIp, rules) {
  if (!rules || rules.length === 0) return true;
  if (!clientIp) return false;

  // Audit F-38: the old `split(":").pop()` produced garbage for IPv6 (e.g.
  // "2001:db8::1" → "1") and could even match an IPv4 rule from a crafted
  // address. Only IPv4 addresses are evaluated against IPv4 rules.
  const cleanIp = normalizeClientIp(clientIp);
  if (!cleanIp || cleanIp.includes(":")) return false;

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.cidr_prefix !== null && rule.cidr_prefix !== undefined) {
      if (ipInCidr(cleanIp, rule.ip_address, rule.cidr_prefix)) return true;
    } else {
      if (cleanIp === rule.ip_address) return true;
    }
  }
  return false;
}

export async function addWhitelistRule(env, { projectId, ipAddress, cidrPrefix, label }) {
  if (!ipAddress) return { error: "ipAddress is required" };

  const ipNum = ipToNumber(ipAddress);
  if (ipNum === null) return { error: "invalid IP address" };

  if (cidrPrefix !== null && cidrPrefix !== undefined) {
    if (cidrPrefix < 0 || cidrPrefix > 32) return { error: "cidrPrefix must be 0-32" };
  }

  const id = `ipw_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(
      "INSERT INTO project_ip_whitelist (id, project_id, ip_address, cidr_prefix, label, enabled, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)"
    )
      .bind(id, projectId, ipAddress, cidrPrefix || null, label || null, now)
      .run();
    return { id, created: true };
  } catch (err) {
    if (err.message?.includes("UNIQUE")) return { error: "rule_already_exists" };
    throw err;
  }
}

export async function removeWhitelistRule(env, { id, projectId }) {
  // Audit F-35: scoped to the caller's project — a foreign rule id is a no-op.
  const result = await env.DB.prepare(
    "DELETE FROM project_ip_whitelist WHERE id = ? AND project_id = ?"
  )
    .bind(id, projectId)
    .run();
  return { deleted: result.meta?.changes || 0 };
}

export async function listWhitelistRules(env, { projectId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM project_ip_whitelist WHERE project_id = ? ORDER BY created_at DESC"
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapRuleRow);
}

export async function toggleWhitelistRule(env, { id, projectId, enabled }) {
  // Audit F-35: scoped to the caller's project.
  const result = await env.DB.prepare(
    "UPDATE project_ip_whitelist SET enabled = ? WHERE id = ? AND project_id = ?"
  )
    .bind(enabled ? 1 : 0, id, projectId)
    .run();
  return { updated: result.meta?.changes || 0 };
}

export async function checkIpAccess(env, { projectId, clientIp }) {
  const rules = await env.DB.prepare(
    "SELECT * FROM project_ip_whitelist WHERE project_id = ? AND enabled = 1"
  )
    .bind(projectId)
    .all();

  const activeRules = rules.results || [];
  if (activeRules.length === 0) return { allowed: true, reason: "no_rules" };

  const allowed = isIpAllowed(clientIp, activeRules);
  return { allowed, reason: allowed ? "matched" : "not_whitelisted" };
}

/**
 * Audit F-35: apply the project whitelist to authenticated admin traffic.
 * Opt-in via `ENFORCE_IP_WHITELIST=true` — turning a hard lockout on by default
 * would strand admins whose address is not in an existing rule set.
 * @returns {Promise<{ blocked: boolean, reason?: string }>}
 */
export async function enforceProjectIpWhitelist(env, { projectId, clientIp }) {
  if (env?.ENFORCE_IP_WHITELIST !== "true") return { blocked: false };
  if (!projectId) return { blocked: false };
  const access = await checkIpAccess(env, { projectId, clientIp }).catch(() => null);
  if (!access) return { blocked: false };
  return access.allowed ? { blocked: false } : { blocked: true, reason: access.reason };
}

export async function getWhitelistStats(env, { projectId }) {
  const rows = await env.DB.prepare(
    "SELECT enabled, COUNT(*) as count FROM project_ip_whitelist WHERE project_id = ? GROUP BY enabled"
  )
    .bind(projectId)
    .all();

  const stats = { total: 0, enabled: 0, disabled: 0 };
  for (const r of rows.results || []) {
    stats.total += r.count;
    if (r.enabled) stats.enabled = r.count;
    else stats.disabled = r.count;
  }
  return stats;
}

function mapRuleRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    ipAddress: row.ip_address,
    cidrPrefix: row.cidr_prefix,
    label: row.label,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
  };
}
