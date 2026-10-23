import { depsEnv } from "./deps-env.js";
import { requireAdminJwt, requireJwt } from "./route-jwt-auth.js";
import { enforceProjectIpWhitelist } from "./ip-whitelist.js";
import { clientIpFromRequest } from "./client-ip.js";
import { logInfo } from "./worker-log.js";

/**
 * Resolve authenticated admin context for /admin/* style routes.
 * Returns { auth, env, json, projectId } or { response }.
 */
export async function resolveAdminContext(
  request,
  h,
  allowedRoles = ["owner", "admin"],
) {
  const env = depsEnv(h);
  const json = h.json;
  const verifyJwtAndGetContext = h.verifyJwtAndGetContext;
  const hasAnyRole = h.hasAnyRole;
  if (!json || !verifyJwtAndGetContext || !hasAnyRole) {
    return {
      response: new Response(JSON.stringify({ error: "server_misconfigured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...(h.corsHeaders || {}) },
      }),
    };
  }
  const gate = await requireAdminJwt(
    request,
    verifyJwtAndGetContext,
    env,
    json,
    hasAnyRole,
    allowedRoles,
  );
  if (gate.response) return { response: gate.response };

  // Audit F-35: when the operator enables enforcement, an enabled project
  // whitelist gates admin access instead of being decorative.
  const ipCheck = await enforceProjectIpWhitelist(env, {
    projectId: gate.auth.projectId,
    clientIp: clientIpFromRequest(request, env),
  });
  if (ipCheck.blocked) {
    logInfo("ip_whitelist.blocked", {
      projectId: gate.auth.projectId,
      userId: gate.auth.userId,
      reason: ipCheck.reason,
    });
    return {
      response: new Response(JSON.stringify({ error: "ip_not_whitelisted" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...(h.corsHeaders || {}) },
      }),
    };
  }

  return {
    auth: gate.auth,
    env,
    json,
    projectId: gate.auth.projectId,
    userId: gate.auth.userId,
    roles: gate.auth.roles,
  };
}

/** Member-level JWT (any authenticated project member). */
export async function resolveMemberContext(request, h) {
  const env = depsEnv(h);
  const json = h.json;
  const verifyJwtAndGetContext = h.verifyJwtAndGetContext;
  if (!json || !verifyJwtAndGetContext) {
    return {
      response: new Response(JSON.stringify({ error: "server_misconfigured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...(h.corsHeaders || {}) },
      }),
    };
  }
  const gate = await requireJwt(request, verifyJwtAndGetContext, env, json);
  if (gate.response) return { response: gate.response };
  return {
    auth: gate.auth,
    env,
    json,
    projectId: gate.auth.projectId,
    userId: gate.auth.userId,
    roles: gate.auth.roles,
  };
}
