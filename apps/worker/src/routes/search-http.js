import { pickRouteDeps } from "./route-http-deps.js";
import { searchMessages } from "../lib/message-search.js";

export async function dispatchSearchRoutes(request, url, h) {
  if (url.pathname !== "/search/messages" || request.method !== "GET") {
    return null;
  }

  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    isValidId,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "isValidId",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const query = url.searchParams.get("q") || url.searchParams.get("query") || "";
  const roomId = url.searchParams.get("roomId")?.trim() || null;
  if (roomId && !isValidId(roomId)) {
    return json({ error: "invalid_room_id" }, { status: 400, headers: corsHeaders });
  }

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const limit = url.searchParams.get("limit");

  const result = await searchMessages(env, {
    projectId: auth.projectId,
    userId: auth.userId,
    roles: auth.roles,
    query,
    roomId,
    from: from || null,
    to: to || null,
    limit: limit ? Number(limit) : undefined,
  });

  if (!result.ok) {
    const status =
      result.status ||
      (result.error === "query_required" ? 400 : result.error === "forbidden" ? 403 : 400);
    return json({ error: result.error }, { status, headers: corsHeaders });
  }

  return json(
    { query: result.query, results: result.results },
    { headers: corsHeaders },
  );
}
