import { pickRouteDeps } from "./route-http-deps.js";
import { searchMessages } from "../lib/message-search.js";
import { searchSemanticMessages, backfillEmbeddings } from "../lib/message-embeddings.js";
import { workerSharedLlmAllowed } from "../lib/hosted-saas-policy.js";

export async function dispatchSearchRoutes(request, url, h) {
  if (url.pathname === "/search/messages" && request.method === "GET") {
    return dispatchKeywordSearch(request, url, h);
  }
  if (url.pathname === "/search/messages/semantic" && request.method === "POST") {
    return dispatchSemanticSearch(request, url, h);
  }
  if (url.pathname === "/search/messages/backfill" && request.method === "POST") {
    return dispatchBackfill(request, url, h);
  }
  return null;
}

async function dispatchKeywordSearch(request, url, h) {
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

async function dispatchSemanticSearch(request, url, h) {
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

  if (env.SEMANTIC_SEARCH_ENABLED !== "true" && env.SEMANTIC_SEARCH_ENABLED !== "1") {
    return json({ error: "semantic_search_disabled" }, { status: 404, headers: corsHeaders });
  }

  if (!workerSharedLlmAllowed(env, auth.projectId)) {
    return json({ error: "llm_not_allowed" }, { status: 403, headers: corsHeaders });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders });
  }

  const query = body.query || "";
  const roomId = body.roomId?.trim() || null;
  if (roomId && !isValidId(roomId)) {
    return json({ error: "invalid_room_id" }, { status: 400, headers: corsHeaders });
  }

  const mode = body.mode || "hybrid";
  if (!["semantic", "hybrid"].includes(mode)) {
    return json({ error: "invalid_mode" }, { status: 400, headers: corsHeaders });
  }

  const result = await searchSemanticMessages(env, {
    query,
    projectId: auth.projectId,
    userId: auth.userId,
    roles: auth.roles,
    roomId,
    from: body.from || null,
    to: body.to || null,
    limit: body.limit ? Number(body.limit) : undefined,
    mode,
  });

  if (!result.ok) {
    const status =
      result.error === "query_required" ? 400 :
      result.error === "ai_not_configured" ? 503 :
      result.error === "ai_provider_failed" ? 502 : 400;
    return json({ error: result.error }, { status, headers: corsHeaders });
  }

  return json(
    { query: result.query, results: result.results, mode: result.mode },
    { headers: corsHeaders },
  );
}

async function dispatchBackfill(request, url, h) {
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

  if (!auth.roles?.includes("admin")) {
    return json({ error: "admin_required" }, { status: 403, headers: corsHeaders });
  }

  if (!workerSharedLlmAllowed(env, auth.projectId)) {
    return json({ error: "llm_not_allowed" }, { status: 403, headers: corsHeaders });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = await backfillEmbeddings(env, {
    projectId: auth.projectId,
    roomId: body.roomId || null,
    limit: body.limit || 500,
  });

  if (!result.ok) {
    return json({ error: result.error }, { status: 500, headers: corsHeaders });
  }

  return json(
    { ok: true, processed: result.processed, stored: result.stored, skipped: result.skipped },
    { headers: corsHeaders },
  );
}
