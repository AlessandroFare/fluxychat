import { pickRouteDeps } from "./route-http-deps.js";
import { resolveAdminContext } from "../lib/admin-route-context.js";
import {
  listMcpAppsCatalog,
  getMcpAppByIdWithAudit,
  listInstalledMcpApps,
  installMcpApp,
  uninstallMcpApp,
} from "../lib/mcp-apps-catalog.js";
import { recordMarketplaceAudit } from "../lib/marketplace-audit.js";
import { listTemplateMarketplace, registerTemplateCommit } from "../lib/template-marketplace.js";
import { verifyWebhookSignature } from "../lib/webhook-batch-verify.js";

export async function dispatchMcpAppsRoutes(request, url, h) {
  const path = url.pathname;
  const { json: respond } = pickRouteDeps(h, ["json"]);
  const env = h?.env ?? {};

  if (request.method === "POST" && path === "/internal/marketplace/audit-result") {
    const secret = String(env.MARKETPLACE_AUDIT_HMAC_SECRET || "").trim();
    if (!secret) return respond({ error: "audit_webhook_not_configured" }, h, 503);

    const rawBody = await request.text();
    const signature = request.headers.get("X-Fluxy-Signature");
    const verified = await verifyWebhookSignature(secret, rawBody, signature ?? "");
    if (!verified.valid) return respond({ error: "invalid_signature" }, h, 401);

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return respond({ error: "invalid_json" }, h, 400);
    }

    if (!body?.serverId || typeof body.serverId !== "string") {
      return respond({ error: "serverId required" }, h, 400);
    }

    if (!env.DB) return respond({ error: "db_unavailable" }, h, 503);

    try {
      const recorded = await recordMarketplaceAudit(env.DB, {
        serverId: body.serverId,
        score: body.score,
        grade: body.grade,
        severityCritical: body.severityCritical,
        severityHigh: body.severityHigh,
        findings: body.findings,
        scannerVersion: body.scannerVersion,
        scannerName: body.scannerName ?? "mcp-audit",
      });
      return respond({ ok: true, audit: recorded }, h, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : "record_failed";
      return respond({ error: message }, h, 500);
    }
  }

  if (request.method === "GET" && path === "/marketplace/templates") {
    const category = url.searchParams.get("category") || undefined;
    const templates = await listTemplateMarketplace(env, { category });
    return respond({ templates, count: templates.length }, h);
  }

  if (request.method === "POST" && path === "/internal/marketplace/template-commit") {
    const secret = String(env.MARKETPLACE_AUDIT_HMAC_SECRET || "").trim();
    if (!secret) return respond({ error: "webhook_not_configured" }, h, 503);

    const rawBody = await request.text();
    const signature = request.headers.get("X-Fluxy-Signature");
    const verified = await verifyWebhookSignature(secret, rawBody, signature ?? "");
    if (!verified.valid) return respond({ error: "invalid_signature" }, h, 401);

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return respond({ error: "invalid_json" }, h, 400);
    }
    if (!body?.templateId) return respond({ error: "templateId required" }, h, 400);
    if (!env.DB) return respond({ error: "db_unavailable" }, h, 503);

    try {
      const result = await registerTemplateCommit(env, {
        templateId: body.templateId,
        version: body.version,
        lastCommitAt: body.lastCommitAt,
      });
      return respond({ ok: true, ...result }, h, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : "register_failed";
      return respond({ error: message }, h, 500);
    }
  }

  if (request.method === "GET" && path === "/marketplace/mcp-apps") {
    const apps = await listMcpAppsCatalog(env);
    return respond({ apps, count: apps.length }, h);
  }

  const appMatch = path.match(/^\/marketplace\/mcp-apps\/([^/]+)$/);
  if (appMatch && request.method === "GET") {
    const app = await getMcpAppByIdWithAudit(env, decodeURIComponent(appMatch[1]));
    if (!app) return respond({ error: "not_found" }, h, 404);
    return respond({ app }, h);
  }

  if (!path.startsWith("/admin/mcp-apps")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env: adminEnv, projectId, userId } = ctx;

  if (request.method === "GET" && path === "/admin/mcp-apps/installed") {
    const installed = await listInstalledMcpApps(adminEnv, { projectId });
    return respond({ installed, count: installed.length }, h);
  }

  if (request.method === "POST" && path === "/admin/mcp-apps/install") {
    const body = await request.json().catch(() => null);
    if (!body?.appId) return respond({ error: "appId required" }, h, 400);
    const result = await installMcpApp(adminEnv, {
      projectId,
      appId: body.appId,
      agentId: body.agentId,
      installedBy: userId,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "DELETE" && path === "/admin/mcp-apps/install") {
    const appId = url.searchParams.get("appId");
    const agentId = url.searchParams.get("agentId");
    if (!appId) return respond({ error: "appId required" }, h, 400);
    const result = await uninstallMcpApp(adminEnv, { projectId, appId, agentId });
    return respond(result, h);
  }

  return null;
}
