/**
 * NW-106 — GET /threads (my reply threads)
 */
import { pickRouteDeps } from "./route-http-deps.js";
import { listUserThreads } from "../lib/message-threads.js";

export async function dispatchMessageThreadsRoutes(request, url, h) {
  if (url.pathname !== "/threads" || request.method !== "GET") {
    return null;
  }

  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const limitRaw = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) ? limitRaw : undefined;
  const unreadOnly =
    url.searchParams.get("unread") === "1" ||
    url.searchParams.get("filter") === "unread";

  const result = await listUserThreads(env, {
    projectId: auth.projectId,
    userId: auth.userId,
    roles: auth.roles,
    limit,
    unreadOnly,
  });

  return json(result, { status: 200, headers: corsHeaders });
}
