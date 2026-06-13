import { resolveAdminContext } from "../lib/admin-route-context.js";
import {
  addWhitelistRule,
  removeWhitelistRule,
  listWhitelistRules,
  toggleWhitelistRule,
  checkIpAccess,
  getWhitelistStats,
} from "../lib/ip-whitelist.js";

export async function dispatchIpWhitelistRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/ip-whitelist")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId } = ctx;

  if (request.method === "GET" && path === "/admin/ip-whitelist") {
    const rules = await listWhitelistRules(env, { projectId });
    return respond({ rules }, h);
  }

  if (request.method === "POST" && path === "/admin/ip-whitelist") {
    const body = await request.json();
    const result = await addWhitelistRule(env, {
      projectId,
      ipAddress: body.ipAddress,
      cidrPrefix: body.cidrPrefix,
      label: body.label,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "DELETE" && path.match(/^\/admin\/ip-whitelist\/[^/]+$/)) {
    const id = path.split("/").pop();
    const result = await removeWhitelistRule(env, { id });
    return respond(result, h);
  }

  if (request.method === "PATCH" && path.match(/^\/admin\/ip-whitelist\/[^/]+$/)) {
    const id = path.split("/").pop();
    const body = await request.json();
    const result = await toggleWhitelistRule(env, { id, enabled: body.enabled });
    return respond(result, h);
  }

  if (request.method === "GET" && path === "/admin/ip-whitelist/check") {
    const clientIp = url.searchParams.get("ip") || h.requestIp;
    const result = await checkIpAccess(env, { projectId, clientIp });
    return respond(result, h);
  }

  if (request.method === "GET" && path === "/admin/ip-whitelist/stats") {
    const stats = await getWhitelistStats(env, { projectId });
    return respond({ stats }, h);
  }

  return null;
}
