import { pickRouteDeps } from "./route-http-deps.js";
import {
  getConsentStatusForUser,
  getProjectConsentSettings,
  listConsentEvents,
  recordConsentEvent,
  upsertProjectConsentSettings,
} from "../lib/consent-dpa.js";

function clientIp(request, env) {
  const cf = request.headers.get("CF-Connecting-IP");
  if (cf) return cf;
  if (env.TRUST_FORWARDED_FOR === "true") {
    const xff = request.headers.get("X-Forwarded-For");
    if (xff) return xff.split(",")[0]?.trim() || null;
  }
  return null;
}

export async function dispatchConsentDpaRoutes(request, url, h) {
  const path = url.pathname;
  const isAdmin = path.startsWith("/admin/consent");
  const isMember = path.startsWith("/consent/");
  if (!isAdmin && !isMember) return null;

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

  try {
    if (isAdmin && !hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    if (isAdmin && request.method === "GET" && path === "/admin/consent") {
      const settings = await getProjectConsentSettings(env, auth.projectId);
      return json({ ok: true, settings }, { headers: corsHeaders });
    }

    if (isAdmin && request.method === "PUT" && path === "/admin/consent") {
      const body = await request.json().catch(() => ({}));
      const result = await upsertProjectConsentSettings(env, auth.projectId, body);
      return json(result, { headers: corsHeaders });
    }

    if (isAdmin && request.method === "GET" && path === "/admin/consent/events") {
      const events = await listConsentEvents(env, {
        projectId: auth.projectId,
        limit: Number(url.searchParams.get("limit") || "50"),
        roomId: url.searchParams.get("roomId") ?? undefined,
        userId: url.searchParams.get("userId") ?? undefined,
      });
      return json({ ok: true, events }, { headers: corsHeaders });
    }

    if (isMember && request.method === "GET" && path === "/consent/status") {
      const roomId = url.searchParams.get("roomId") ?? undefined;
      const status = await getConsentStatusForUser(env, {
        projectId: auth.projectId,
        userId: auth.userId,
        roomId,
      });
      return json(status, { headers: corsHeaders });
    }

    if (isMember && request.method === "POST" && path === "/consent/acknowledge") {
      const body = await request.json().catch(() => ({}));
      const result = await recordConsentEvent(env, {
        projectId: auth.projectId,
        userId: auth.userId,
        roomId: body.roomId,
        eventType: body.eventType ?? body.action,
        dpaVersion: body.dpaVersion,
        clientIp: clientIp(request, env),
        userAgent: request.headers.get("User-Agent"),
        metadata: { source: body.source ?? "dashboard" },
      });
      if (!result.ok) return json(result, { status: 400, headers: corsHeaders });
      return json(result, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("consent_dpa.unhandled", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
