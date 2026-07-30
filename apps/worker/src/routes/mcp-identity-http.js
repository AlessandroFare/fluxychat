import { resolveAdminContext } from "../lib/admin-route-context.js";
import {
  getMcpIdentityRegistry,
  registerMcpServer,
  registerMcpToolProvenance,
  listMcpToolAudit,
} from "../lib/mcp-identity-store.js";
import { MCP_SERVER_INFO } from "../lib/mcp-server.js";

export async function dispatchMcpIdentityRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/mcp-identity")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId } = ctx;

  if (request.method === "GET" && path === "/admin/mcp-identity/registry") {
    const registry = await getMcpIdentityRegistry(env, { projectId });
    return respond({
      registry,
      builtinServerInfo: MCP_SERVER_INFO,
    }, h);
  }

  if (request.method === "GET" && path === "/admin/mcp-identity/audit") {
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const entries = await listMcpToolAudit(env, { projectId, limit });
    return respond({ entries, count: entries.length }, h);
  }

  if (request.method === "POST" && path === "/admin/mcp-identity/servers") {
    const body = await request.json().catch(() => null);
    const result = await registerMcpServer(env, { projectId, ...body });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "POST" && path === "/admin/mcp-identity/tools") {
    const body = await request.json().catch(() => null);
    const result = await registerMcpToolProvenance(env, {
      projectId,
      serverName: body?.serverName,
      toolName: body?.toolName,
      instructions: body?.instructions,
      origin: body?.origin,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  return null;
}
