/**
 * CP-072: URL fetch audit HTTP routes.
 */
import { pickRouteDeps } from "./route-http-deps.js";
import { listUrlFetchAudit, validateUrl } from "../lib/url-fetch-audit.js";

export async function dispatchUrlFetchAuditRoutes(request, url, h) {
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

  if (url.pathname === "/security/url-fetch-audit" && request.method === "GET") {
    const a = await authAdmin();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const entries = await listUrlFetchAudit(env, {
      projectId: a.projectId,
      feature: url.searchParams.get("feature") || undefined,
      limit: parseInt(url.searchParams.get("limit") || "50", 10),
    });
    return json({ entries });
  }

  if (url.pathname === "/security/url-fetch-audit/validate" && request.method === "POST") {
    const a = await authAdmin();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    const result = validateUrl(body?.url, env);
    return json(result);
  }

  return null;
}
