import { pickRouteDeps } from "./route-http-deps.js";
import { getTenantUsageSnapshot } from "../lib/tenant-usage.js";

export async function dispatchTenantUsageRoutes(request, url, h) {
  if (url.pathname !== "/admin/tenant-usage" || request.method !== "GET") {
    return null;
  }

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
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }
  if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
    return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  const snapshot = await getTenantUsageSnapshot(env, auth.projectId);
  return json({ ok: true, usage: snapshot }, { headers: corsHeaders });
}
