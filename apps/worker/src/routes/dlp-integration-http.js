import { resolveAdminContext } from "../lib/admin-route-context.js";
import {
  createIntegration, updateIntegration, deleteIntegration,
  listIntegrations, getIntegration,
  scanWithIntegration, getScanHistory, getDlpIntegrationStats,
} from "../lib/dlp-integrations.js";

export async function dispatchDlpIntegrationRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/dlp-integrations")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId } = ctx;

  if (request.method === "GET" && path === "/admin/dlp-integrations") {
    const integrations = await listIntegrations(env, { projectId });
    return respond({ integrations }, h);
  }

  if (request.method === "POST" && path === "/admin/dlp-integrations") {
    const body = await request.json();
    const result = await createIntegration(env, {
      projectId,
      name: body.name,
      provider: body.provider,
      endpointUrl: body.endpointUrl,
      apiKey: body.apiKey,
      config: body.config,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "PATCH" && path.match(/^\/admin\/dlp-integrations\/[^/]+$/)) {
    const id = path.split("/").pop();
    const body = await request.json();
    const result = await updateIntegration(env, { id, projectId, ...body });
    return respond(result, h);
  }

  if (request.method === "DELETE" && path.match(/^\/admin\/dlp-integrations\/[^/]+$/)) {
    const id = path.split("/").pop();
    const result = await deleteIntegration(env, { id, projectId });
    return respond(result, h);
  }

  if (request.method === "POST" && path === "/admin/dlp-integrations/scan") {
    const body = await request.json();
    const result = await scanWithIntegration(env, {
      integrationId: body.integrationId,
      projectId,
      messageId: body.messageId,
      roomId: body.roomId,
      content: body.content,
      metadata: body.metadata,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h);
  }

  if (request.method === "GET" && path === "/admin/dlp-integrations/scans") {
    const integrationId = url.searchParams.get("integrationId");
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const scans = await getScanHistory(env, { projectId, integrationId, limit });
    return respond({ scans }, h);
  }

  if (request.method === "GET" && path === "/admin/dlp-integrations/stats") {
    const stats = await getDlpIntegrationStats(env, { projectId });
    return respond({ stats }, h);
  }

  return null;
}
