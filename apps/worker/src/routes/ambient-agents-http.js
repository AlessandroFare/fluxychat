import { pickRouteDeps } from "./route-http-deps.js";
import {
  createAgentPolicy,
  deleteAgentPolicy,
  dispatchAmbientEvent,
  executeAmbientPolicy,
  listAgentPolicies,
  listAgentPolicyRuns,
  mapAgentPolicyRow,
} from "../lib/ambient-agents.js";

export async function dispatchAmbientAgentsRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/ambient")) return null;

  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    hasAnyRole,
    logError,
    requestLogCtx,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "logError",
    "requestLogCtx",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
    return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  try {
    if (request.method === "GET" && path === "/admin/ambient/policies") {
      const triggerType = url.searchParams.get("triggerType") ?? undefined;
      const policies = await listAgentPolicies(env, {
        projectId: auth.projectId,
        triggerType,
      });
      return json({ ok: true, policies }, { headers: corsHeaders });
    }

    if (request.method === "POST" && path === "/admin/ambient/policies") {
      const body = await request.json().catch(() => ({}));
      const result = await createAgentPolicy(env, {
        projectId: auth.projectId,
        name: body.name,
        triggerType: body.triggerType,
        triggerPattern: body.triggerPattern,
        agentId: body.agentId,
        roomId: body.roomId,
        maxAutonomy: body.maxAutonomy,
        promptTemplate: body.promptTemplate,
        cooldownSeconds: body.cooldownSeconds,
      });
      if (!result.ok) return json(result, { status: 400, headers: corsHeaders });
      return json(result, { status: 201, headers: corsHeaders });
    }

    const policyMatch = path.match(/^\/admin\/ambient\/policies\/([^/]+)$/);
    if (policyMatch && request.method === "DELETE") {
      const result = await deleteAgentPolicy(env, {
        projectId: auth.projectId,
        policyId: decodeURIComponent(policyMatch[1]),
      });
      return json(result, { headers: corsHeaders });
    }

    const triggerMatch = path.match(/^\/admin\/ambient\/policies\/([^/]+)\/trigger$/);
    if (triggerMatch && request.method === "POST") {
      const policyId = decodeURIComponent(triggerMatch[1]);
      const body = await request.json().catch(() => ({}));
      const row = await env.DB.prepare(
        `SELECT * FROM agent_policies WHERE id = ? AND project_id = ?`,
      )
        .bind(policyId, auth.projectId)
        .first();
      const policy = mapAgentPolicyRow(row);
      if (!policy) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
      const result = await executeAmbientPolicy(env, policy, {
        triggerType: policy.triggerType,
        triggerKey: body.triggerKey || policy.triggerPattern,
        roomId: body.roomId || policy.roomId,
        payload: body.payload || {},
        userId: auth.userId,
        traceId: body.traceId,
      });
      return json(result, { headers: corsHeaders });
    }

    if (request.method === "POST" && path === "/admin/ambient/dispatch") {
      const body = await request.json().catch(() => ({}));
      const triggerType = String(body.triggerType ?? "").trim();
      const triggerKey = String(body.triggerKey ?? "").trim();
      if (!triggerType || !triggerKey) {
        return json({ error: "triggerType and triggerKey required" }, { status: 400, headers: corsHeaders });
      }
      const result = await dispatchAmbientEvent(env, {
        projectId: auth.projectId,
        triggerType,
        triggerKey,
        roomId: body.roomId,
        payload: body.payload,
        userId: auth.userId,
        traceId: body.traceId,
      });
      return json(result, { headers: corsHeaders });
    }

    if (request.method === "GET" && path === "/admin/ambient/runs") {
      const policyId = url.searchParams.get("policyId") ?? undefined;
      const runs = await listAgentPolicyRuns(env, {
        projectId: auth.projectId,
        policyId,
        limit: url.searchParams.get("limit"),
      });
      return json({ ok: true, runs }, { headers: corsHeaders });
    }

    return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
  } catch (err) {
    logError("ambient.route_failed", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
