import { resolveAdminContext } from "../lib/admin-route-context.js";
import {
  assessEuAiActCompliance,
  buildEuAiActTechnicalDocumentation,
  getAgentEuAiActProfile,
  getProjectEuAiActSettings,
  listAgentEuAiActProfiles,
  listEuAiActAuditLog,
  upsertAgentEuAiActProfile,
  upsertProjectEuAiActSettings,
  ANNEX_III_CATEGORIES,
} from "../lib/eu-ai-act-compliance.js";

export async function dispatchEuAiActRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/eu-ai-act")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId, userId } = ctx;

  if (request.method === "GET" && path === "/admin/eu-ai-act/settings") {
    const settings = await getProjectEuAiActSettings(env, projectId);
    return respond({ settings, annexIIICategories: ANNEX_III_CATEGORIES }, h);
  }

  if (request.method === "PATCH" && path === "/admin/eu-ai-act/settings") {
    const body = await request.json().catch(() => null);
    const settings = await upsertProjectEuAiActSettings(env, projectId, body ?? {});
    return respond({ settings }, h);
  }

  if (request.method === "GET" && path === "/admin/eu-ai-act/agents") {
    const profiles = await listAgentEuAiActProfiles(env, projectId);
    return respond({ profiles }, h);
  }

  const agentMatch = path.match(/^\/admin\/eu-ai-act\/agents\/([^/]+)$/);
  if (agentMatch) {
    const agentId = decodeURIComponent(agentMatch[1]);
    if (request.method === "GET") {
      const profile = await getAgentEuAiActProfile(env, projectId, agentId);
      return respond({ profile }, h);
    }
    if (request.method === "PUT" || request.method === "PATCH") {
      const body = await request.json().catch(() => null);
      const result = await upsertAgentEuAiActProfile(env, projectId, agentId, body ?? {}, userId);
      if (result.error) return respond(result, h, 400);
      return respond(result, h);
    }
  }

  if (request.method === "GET" && path === "/admin/eu-ai-act/assessment") {
    const assessment = await assessEuAiActCompliance(env, projectId);
    return respond({ assessment }, h);
  }

  if (request.method === "GET" && path === "/admin/eu-ai-act/technical-documentation") {
    const documentation = await buildEuAiActTechnicalDocumentation(env, projectId);
    return respond({ documentation }, h);
  }

  if (request.method === "GET" && path === "/admin/eu-ai-act/audit-log") {
    const agentId = url.searchParams.get("agentId")?.trim() || undefined;
    const limit = Number(url.searchParams.get("limit") || 100);
    const events = await listEuAiActAuditLog(env, projectId, { limit, agentId });
    return respond({ events }, h);
  }

  return null;
}
