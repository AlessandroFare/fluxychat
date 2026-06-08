import { pickRouteDeps } from "./route-http-deps.js";
import {
  getDigestPreferences,
  upsertDigestPreferences,
  runDailyDigest,
  previousDigestDate,
} from "../lib/daily-digest.js";

export async function dispatchDigestRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    hasAnyRole,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "hasAnyRole",
  ]);

  if (url.pathname === "/digest/preferences" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const preferences = await getDigestPreferences(env, auth.projectId, auth.userId);
    return json({ preferences }, { headers: corsHeaders });
  }

  if (url.pathname === "/digest/preferences" && request.method === "PATCH") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "invalid_body" }, { status: 400, headers: corsHeaders });
    }
    const result = await upsertDigestPreferences(env, auth.projectId, auth.userId, {
      enabled: body.enabled,
      email: body.email,
      emailEnabled: body.emailEnabled,
      webPushEnabled: body.webPushEnabled,
      inAppEnabled: body.inAppEnabled,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: 400, headers: corsHeaders });
    }
    return json({ preferences: result.preferences }, { headers: corsHeaders });
  }

  if (url.pathname === "/admin/digest/run" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
    const body = await request.json().catch(() => ({}));
    const digestDate =
      typeof body?.digestDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.digestDate)
        ? body.digestDate
        : previousDigestDate();
    const result = await runDailyDigest(env, {
      digestDate,
      maxUsers: body?.maxUsers,
      force: true,
    });
    return json({ result }, { headers: corsHeaders });
  }

  return null;
}
