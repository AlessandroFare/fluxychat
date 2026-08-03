import { pickRouteDeps } from "./route-http-deps.js";
import {
  listMergeConflicts,
  reportMergeConflict,
  resolveMergeConflict,
} from "../lib/message-merge-conflicts.js";

export async function dispatchMergeConflictsRoutes(request, url, h) {
  const path = url.pathname;
  const roomListMatch = path.match(/^\/rooms\/([^/]+)\/merge-conflicts$/);
  const resolveMatch = path.match(/^\/merge-conflicts\/([^/]+)\/resolve$/);

  if (!roomListMatch && !resolveMatch) return null;

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
    if (roomListMatch && request.method === "GET") {
      const roomId = decodeURIComponent(roomListMatch[1]);
      const conflicts = await listMergeConflicts(env, {
        projectId: auth.projectId,
        roomId,
        status: url.searchParams.get("status") ?? "open",
      });
      return json({ ok: true, conflicts }, { headers: corsHeaders });
    }

    if (roomListMatch && request.method === "POST") {
      if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator", "member"])) {
        return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      }
      const roomId = decodeURIComponent(roomListMatch[1]);
      const body = await request.json().catch(() => ({}));
      const result = await reportMergeConflict(env, {
        projectId: auth.projectId,
        roomId,
        messageKey: body.messageKey,
        messageId: body.messageId,
        clientMessageId: body.clientMessageId,
        parentMessageId: body.parentMessageId,
        versionA: body.versionA,
        versionB: body.versionB,
      });
      if (!result.ok) return json(result, { status: 400, headers: corsHeaders });
      return json(result, { status: result.duplicate ? 200 : 201, headers: corsHeaders });
    }

    if (resolveMatch && request.method === "POST") {
      if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
        return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      }
      const body = await request.json().catch(() => ({}));
      const result = await resolveMergeConflict(env, {
        projectId: auth.projectId,
        conflictId: resolveMatch[1],
        resolution: body.resolution,
        resolvedBy: auth.userId,
      });
      if (!result.ok) {
        const status = result.error === "not_found" ? 404 : 400;
        return json(result, { status, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("merge_conflicts.unhandled", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
