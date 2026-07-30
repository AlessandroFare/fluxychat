import { pickRouteDeps } from "./route-http-deps.js";
import { resolveAdminContext } from "../lib/admin-route-context.js";
import {
  listMcpAppsCatalog,
  getMcpAppById,
  listInstalledMcpApps,
  installMcpApp,
  uninstallMcpApp,
} from "../lib/mcp-apps-catalog.js";

export async function dispatchMcpAppsRoutes(request, url, h) {
  const path = url.pathname;
  const { json: respond } = pickRouteDeps(h, ["json"]);

  if (request.method === "GET" && path === "/marketplace/mcp-apps") {
    const apps = listMcpAppsCatalog();
    return respond({ apps, count: apps.length }, h);
  }

  const appMatch = path.match(/^\/marketplace\/mcp-apps\/([^/]+)$/);
  if (appMatch && request.method === "GET") {
    const app = getMcpAppById(decodeURIComponent(appMatch[1]));
    if (!app) return respond({ error: "not_found" }, h, 404);
    return respond({ app }, h);
  }

  if (!path.startsWith("/admin/mcp-apps")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, projectId, userId } = ctx;

  if (request.method === "GET" && path === "/admin/mcp-apps/installed") {
    const installed = await listInstalledMcpApps(env, { projectId });
    return respond({ installed, count: installed.length }, h);
  }

  if (request.method === "POST" && path === "/admin/mcp-apps/install") {
    const body = await request.json().catch(() => null);
    if (!body?.appId) return respond({ error: "appId required" }, h, 400);
    const result = await installMcpApp(env, {
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
    const result = await uninstallMcpApp(env, { projectId, appId, agentId });
    return respond(result, h);
  }

  return null;
}
