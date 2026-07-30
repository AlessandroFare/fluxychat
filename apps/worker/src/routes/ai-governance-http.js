import { resolveAdminContext } from "../lib/admin-route-context.js";
import {
  getGovernanceRegistry,
  registerModel,
  registerPrompt,
  registerTool,
  runPreDeployEvaluation,
  exportGovernanceEvidence,
} from "../lib/ai-governance-registry.js";

export async function dispatchAiGovernanceRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/ai-governance")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId, userId } = ctx;

  if (request.method === "GET" && path === "/admin/ai-governance/registry") {
    const registry = await getGovernanceRegistry(env, { projectId });
    return respond({ registry }, h);
  }

  if (request.method === "GET" && path === "/admin/ai-governance/evidence") {
    const evidence = await exportGovernanceEvidence(env, { projectId });
    return respond(evidence, h);
  }

  if (request.method === "POST" && path === "/admin/ai-governance/models") {
    const body = await request.json().catch(() => null);
    const result = await registerModel(env, { projectId, ...body, approvedBy: body?.approvedBy ?? userId });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "POST" && path === "/admin/ai-governance/prompts") {
    const body = await request.json().catch(() => null);
    const result = await registerPrompt(env, { projectId, ...body });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "POST" && path === "/admin/ai-governance/tools") {
    const body = await request.json().catch(() => null);
    const result = await registerTool(env, { projectId, ...body });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "POST" && path === "/admin/ai-governance/evaluate") {
    const body = await request.json().catch(() => null);
    const result = await runPreDeployEvaluation(env, {
      projectId,
      targetId: body?.targetId,
      targetType: body?.targetType,
      approver: userId,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h);
  }

  return null;
}
