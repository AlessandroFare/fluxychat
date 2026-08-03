import { pickRouteDeps } from "./route-http-deps.js";
import {
  getAttachmentMediaJob,
  getProjectMediaSettings,
  listRecentMediaJobs,
  mapMediaJobRow,
  upsertProjectMediaSettings,
} from "../lib/media-pipeline.js";

export async function dispatchMediaPipelineRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/media") && !path.includes("/media-status")) return null;

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
    if (request.method === "GET" && path === "/admin/media/settings") {
      const settings = await getProjectMediaSettings(env, auth.projectId);
      return json({ ok: true, settings }, { headers: corsHeaders });
    }

    if (request.method === "PUT" && path === "/admin/media/settings") {
      const body = await request.json().catch(() => ({}));
      const result = await upsertProjectMediaSettings(env, auth.projectId, body);
      return json(result, { headers: corsHeaders });
    }

    if (request.method === "GET" && path === "/admin/media/jobs") {
      const fileKey = url.searchParams.get("fileKey");
      if (fileKey) {
        const row = await getAttachmentMediaJob(env, auth.projectId, fileKey);
        if (!row) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
        return json({ ok: true, job: mapMediaJobRow(row) }, { headers: corsHeaders });
      }
      const jobs = await listRecentMediaJobs(env, auth.projectId, Number(url.searchParams.get("limit") || 50));
      return json({ ok: true, jobs }, { headers: corsHeaders });
    }
  } catch (err) {
    logError("media_pipeline.route_failed", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }

  return null;
}
