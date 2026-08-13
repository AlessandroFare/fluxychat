/**
 * CP-070: Agent tool policy HTTP routes.
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  evaluateToolPolicyDocument,
  getProjectToolPolicy,
  upsertProjectToolPolicy,
} from "../lib/agent-tool-policy.js";

export async function dispatchAgentToolPolicyRoutes(request, url, h) {
  const { env, json, corsHeaders, verifyJwtAndGetContext, logError, requestLogCtx, hasAnyRole } =
    pickRouteDeps(h, [
      "env",
      "json",
      "corsHeaders",
      "verifyJwtAndGetContext",
      "logError",
      "requestLogCtx",
      "hasAnyRole",
    ]);

  async function authAdmin() {
    const a = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!a || !hasAnyRole(a, ["owner", "admin"])) return null;
    return a;
  }

  if (url.pathname === "/agents/tool-policy" && request.method === "GET") {
    const a = await authAdmin();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const policy = await getProjectToolPolicy(env, a.projectId);
    return json({ policy, enabled: Boolean(policy) });
  }

  if (url.pathname === "/agents/tool-policy" && request.method === "PUT") {
    const a = await authAdmin();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    const result = await upsertProjectToolPolicy(env, {
      projectId: a.projectId,
      policy: body?.policy,
      enabled: body?.enabled !== false,
    });
    return json(result);
  }

  if (url.pathname === "/agents/tool-policy/evaluate" && request.method === "POST") {
    const a = await authAdmin();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    const policy = await getProjectToolPolicy(env, a.projectId);
    if (!policy) {
      return json({ allowed: true, requiresApproval: false, denied: false, effect: "allow" });
    }
    const decision = evaluateToolPolicyDocument(policy, {
      toolName: body?.toolName,
      input: body?.input,
      context: body?.context,
    });
    return json(decision);
  }

  return null;
}
