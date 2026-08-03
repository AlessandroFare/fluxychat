import { pickRouteDeps } from "./route-http-deps.js";
import {
  assertProjectWriteResidency,
  getProjectResidencySettings,
  resolveWorkerRegion,
  upsertProjectResidencySettings,
  VALID_REGIONS,
} from "../lib/data-residency-settings.js";

export async function dispatchDataResidencyRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/data-residency")) return null;

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
  if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
    return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  try {
    if (request.method === "GET" && path === "/admin/data-residency") {
      const settings = await getProjectResidencySettings(env, auth.projectId);
      return json(
        {
          ok: true,
          settings,
          workerRegion: resolveWorkerRegion(env),
          validRegions: VALID_REGIONS,
        },
        { headers: corsHeaders },
      );
    }

    if (request.method === "PUT" && path === "/admin/data-residency") {
      const body = await request.json().catch(() => ({}));
      const result = await upsertProjectResidencySettings(env, auth.projectId, {
        primaryRegion: body.primaryRegion,
        allowedRegions: body.allowedRegions,
        inferenceRegion: body.inferenceRegion,
        enforceWrites: body.enforceWrites,
      });
      if (!result.ok) return json(result, { status: 400, headers: corsHeaders });
      return json(result, { headers: corsHeaders });
    }

    if (request.method === "GET" && path === "/admin/data-residency/check") {
      const check = await assertProjectWriteResidency(env, auth.projectId, {
        operation: "admin_check",
      });
      return json(
        {
          ok: check.ok,
          workerRegion: resolveWorkerRegion(env),
          ...check,
        },
        { status: check.ok ? 200 : 403, headers: corsHeaders },
      );
    }

    return null;
  } catch (err) {
    logError("data_residency.unhandled", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
