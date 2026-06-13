import { isPrivateUrl, safeOutboundFetch } from "./url-ssrf.js";

function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const PROVIDERS = {
  microsoft_purview: { name: "Microsoft Purview", defaultHeaders: { "Content-Type": "application/json" } },
  symantec: { name: "Symantec DLP", defaultHeaders: { "Content-Type": "application/json" } },
  forcepoint: { name: "Forcepoint DLP", defaultHeaders: { "Content-Type": "application/json" } },
  digitalguardian: { name: "Digital Guardian", defaultHeaders: { "Content-Type": "application/json" } },
  custom_webhook: { name: "Custom Webhook", defaultHeaders: { "Content-Type": "application/json" } },
};

export function getProviderInfo(provider) {
  return PROVIDERS[provider] || null;
}

export async function createIntegration(env, { projectId, name, provider, endpointUrl, apiKey, config }) {
  if (!name || !provider || !endpointUrl) return { error: "name, provider, and endpointUrl are required" };
  if (!PROVIDERS[provider]) return { error: `provider must be one of: ${Object.keys(PROVIDERS).join(", ")}` };

  const id = `dlpi_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO dlp_integrations (id, project_id, name, provider, endpoint_url, api_key_encrypted, config, enabled, scan_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`
  )
    .bind(id, projectId, name, provider, endpointUrl, apiKey || null, config ? JSON.stringify(config) : null, now, now)
    .run();

  return { id, created: true };
}

export async function updateIntegration(env, { id, projectId, name, endpointUrl, apiKey, config, enabled }) {
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const params = [now];

  if (name !== undefined) { sets.push("name = ?"); params.push(name); }
  if (endpointUrl !== undefined) { sets.push("endpoint_url = ?"); params.push(endpointUrl); }
  if (apiKey !== undefined) { sets.push("api_key_encrypted = ?"); params.push(apiKey); }
  if (config !== undefined) { sets.push("config = ?"); params.push(JSON.stringify(config)); }
  if (enabled !== undefined) { sets.push("enabled = ?"); params.push(enabled ? 1 : 0); }

  params.push(id, projectId);
  const result = await env.DB.prepare(
    `UPDATE dlp_integrations SET ${sets.join(", ")} WHERE id = ? AND project_id = ?`
  )
    .bind(...params)
    .run();
  return { updated: result.meta?.changes || 0 };
}

export async function deleteIntegration(env, { id, projectId }) {
  const result = await env.DB.prepare(
    "DELETE FROM dlp_integrations WHERE id = ? AND project_id = ?"
  )
    .bind(id, projectId)
    .run();
  return { deleted: result.meta?.changes || 0 };
}

export async function listIntegrations(env, { projectId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM dlp_integrations WHERE project_id = ? ORDER BY created_at DESC"
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapIntegrationRow);
}

export async function getIntegration(env, { id, projectId }) {
  const row = await env.DB.prepare(
    "SELECT * FROM dlp_integrations WHERE id = ? AND project_id = ?"
  )
    .bind(id, projectId)
    .first();
  return row ? mapIntegrationRow(row) : null;
}

export function buildScanPayload(provider, { messageId, roomId, content, metadata }) {
  const base = {
    messageId,
    roomId,
    content,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  switch (provider) {
    case "microsoft_purview":
      return { ScanRequest: { Content: content, ContentType: "Message", Source: "FluxyChat", Metadata: base } };
    case "symantec":
      return { dlpScan: { text: content, channel: "chat", messageId, roomId, ...metadata } };
    case "forcepoint":
      return { contentScan: { payload: content, context: { messageId, roomId, ...metadata } } };
    case "digitalguardian":
      return { inspection: { data: content, labels: ["chat", "user-generated"], ...metadata } };
    default:
      return base;
  }
}

export function parseScanResponse(provider, response) {
  if (!response) return { verdict: "error", violations: [] };

  switch (provider) {
    case "microsoft_purview":
      return {
        verdict: response.ScanResult?.Classification === "Violation" ? "violation" : "clean",
        violations: response.ScanResult?.Violations || [],
      };
    case "symantec":
      return {
        verdict: response.matchFound ? "violation" : "clean",
        violations: response.violations || [],
      };
    case "forcepoint":
      return {
        verdict: response.policyViolations?.length > 0 ? "violation" : "clean",
        violations: response.policyViolations || [],
      };
    case "digitalguardian":
      return {
        verdict: response.classifications?.some((c) => c.sensitive) ? "violation" : "clean",
        violations: response.classifications?.filter((c) => c.sensitive) || [],
      };
    default:
      return {
        verdict: response.verdict || (response.violations?.length > 0 ? "violation" : "clean"),
        violations: response.violations || [],
      };
  }
}

export async function scanWithIntegration(env, { integrationId, projectId, messageId, roomId, content, metadata }) {
  const integration = await getIntegration(env, { id: integrationId, projectId });
  if (!integration) return { error: "integration_not_found" };
  if (!integration.enabled) return { error: "integration_disabled" };

  const scanId = `dlps_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  const startTime = Date.now();

  const payload = buildScanPayload(integration.provider, { messageId, roomId, content, metadata });

  if (isPrivateUrl(integration.endpointUrl)) {
    return { error: "endpoint_url_blocked", verdict: "blocked" };
  }

  try {
    const response = await safeOutboundFetch(integration.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(integration.apiKey ? { Authorization: `Bearer ${integration.apiKey}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    const latencyMs = Date.now() - startTime;
    const body = await response.json().catch(() => null);
    const { verdict, violations } = parseScanResponse(integration.provider, body);

    await env.DB.prepare(
      `INSERT INTO dlp_integration_scans (id, integration_id, project_id, message_id, room_id, status, verdict, violations, response_code, latency_ms, scanned_at)
       VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)`
    )
      .bind(scanId, integrationId, projectId, messageId || null, roomId || null, verdict, JSON.stringify(violations), response.status, latencyMs, now)
      .run();

    await env.DB.prepare(
      "UPDATE dlp_integrations SET last_scan_at = ?, scan_count = scan_count + 1 WHERE id = ?"
    )
      .bind(now, integrationId)
      .run();

    return { scanId, verdict, violations, latencyMs, status: "completed" };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    await env.DB.prepare(
      `INSERT INTO dlp_integration_scans (id, integration_id, project_id, message_id, room_id, status, verdict, violations, latency_ms, scanned_at)
       VALUES (?, ?, ?, ?, ?, 'failed', 'error', ?, ?, ?)`
    )
      .bind(scanId, integrationId, projectId, messageId || null, roomId || null, JSON.stringify([{ error: err.message }]), latencyMs, now)
      .run();

    return { scanId, verdict: "error", violations: [{ error: err.message }], latencyMs, status: "failed" };
  }
}

export async function getScanHistory(env, { projectId, integrationId, limit }) {
  let sql = "SELECT * FROM dlp_integration_scans WHERE project_id = ?";
  const params = [projectId];
  if (integrationId) { sql += " AND integration_id = ?"; params.push(integrationId); }
  sql += " ORDER BY scanned_at DESC LIMIT ?";
  params.push(limit || 50);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapScanRow);
}

export async function getDlpIntegrationStats(env, { projectId }) {
  const integrations = await env.DB.prepare(
    "SELECT provider, enabled, scan_count FROM dlp_integrations WHERE project_id = ?"
  )
    .bind(projectId)
    .all();

  const scans = await env.DB.prepare(
    "SELECT status, verdict, COUNT(*) as count, AVG(latency_ms) as avg_latency FROM dlp_integration_scans WHERE project_id = ? GROUP BY status, verdict"
  )
    .bind(projectId)
    .all();

  const byProvider = {};
  for (const i of integrations.results || []) {
    if (!byProvider[i.provider]) byProvider[i.provider] = { enabled: 0, disabled: 0, totalScans: 0 };
    if (i.enabled) byProvider[i.provider].enabled++;
    else byProvider[i.provider].disabled++;
    byProvider[i.provider].totalScans += i.scan_count;
  }

  const byStatus = {};
  for (const s of scans.results || []) {
    byStatus[`${s.status}:${s.verdict}`] = { count: s.count, avgLatency: Math.round(s.avg_latency || 0) };
  }

  return { byProvider, byStatus, totalIntegrations: (integrations.results || []).length };
}

function mapIntegrationRow(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name, provider: row.provider,
    endpointUrl: row.endpoint_url, hasApiKey: !!row.api_key_encrypted,
    config: row.config ? JSON.parse(row.config) : null,
    enabled: row.enabled === 1, lastScanAt: row.last_scan_at, scanCount: row.scan_count,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapScanRow(row) {
  return {
    id: row.id, integrationId: row.integration_id, projectId: row.project_id,
    messageId: row.message_id, roomId: row.room_id, status: row.status,
    verdict: row.verdict, violations: row.violations ? JSON.parse(row.violations) : [],
    responseCode: row.response_code, latencyMs: row.latency_ms, scannedAt: row.scanned_at,
  };
}
