import { pickRouteDeps } from "./route-http-deps.js";
import {
  extractKnowledgeGraph,
  persistKnowledgeGraph,
  queryKnowledgeGraph,
  getEntityTimeline,
  getRoomGraph,
} from "../lib/knowledge-graph.js";
import { workerSharedLlmAllowed } from "../lib/hosted-saas-policy.js";

export async function dispatchKnowledgeGraphRoutes(request, url, h) {
  const path = url.pathname;

  if (path === "/rooms/kg/extract" && request.method === "POST") {
    return dispatchExtract(request, url, h);
  }
  if (path.match(/^\/rooms\/[^/]+\/kg$/) && request.method === "GET") {
    return dispatchGetRoomGraph(request, url, h);
  }
  if (path.match(/^\/rooms\/[^/]+\/kg$/) && request.method === "POST") {
    return dispatchQueryGraph(request, url, h);
  }
  if (path.match(/^\/rooms\/[^/]+\/kg\/extract$/) && request.method === "POST") {
    return dispatchExtractForRoom(request, url, h);
  }
  if (path.match(/^\/kg\/nodes\/[^/]+\/timeline$/) && request.method === "GET") {
    return dispatchNodeTimeline(request, url, h);
  }
  if (path.match(/^\/kg\/nodes\/[^/]+$/) && request.method === "GET") {
    return dispatchGetNode(request, url, h);
  }
  if (path.match(/^\/kg\/query$/) && request.method === "POST") {
    return dispatchQueryProject(request, url, h);
  }
  return null;
}

async function dispatchExtract(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError, isValidId,
  } = pickRouteDeps(h, [
    "env", "json", "corsHeaders", "requestLogCtx",
    "verifyJwtAndGetContext", "logError", "isValidId",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  if (env.KNOWLEDGE_GRAPH_ENABLED !== "true" && env.KNOWLEDGE_GRAPH_ENABLED !== "1") {
    return json({ error: "knowledge_graph_disabled" }, { status: 404, headers: corsHeaders });
  }

  if (!workerSharedLlmAllowed(env, auth.projectId)) {
    return json({ error: "llm_not_allowed" }, { status: 403, headers: corsHeaders });
  }

  let body;
  try { body = await request.json(); } catch {
    return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders });
  }

  const roomId = body.roomId;
  if (!roomId || !isValidId(roomId)) {
    return json({ error: "invalid_room_id" }, { status: 400, headers: corsHeaders });
  }

  const extracted = await extractKnowledgeGraph(env, {
    projectId: auth.projectId,
    roomId,
    since: body.since || null,
  });

  if (!extracted.ok) {
    const status = extracted.error === "ai_not_configured" ? 503 :
      extracted.error === "ai_provider_failed" ? 502 : 400;
    return json({ error: extracted.error }, { status, headers: corsHeaders });
  }

  const persisted = await persistKnowledgeGraph(env, {
    projectId: auth.projectId,
    roomId,
    nodes: extracted.nodes,
    edges: extracted.edges,
  });

  return json(
    {
      nodesExtracted: extracted.nodes.length,
      edgesExtracted: extracted.edges.length,
      nodesInserted: persisted.nodesInserted,
      edgesInserted: persisted.edgesInserted,
    },
    { headers: corsHeaders },
  );
}

async function dispatchGetRoomGraph(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError, isValidId,
  } = pickRouteDeps(h, [
    "env", "json", "corsHeaders", "requestLogCtx",
    "verifyJwtAndGetContext", "logError", "isValidId",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const pathParts = url.pathname.split("/");
  const roomId = pathParts[1];
  if (!isValidId(roomId)) {
    return json({ error: "invalid_room_id" }, { status: 400, headers: corsHeaders });
  }

  const limit = url.searchParams.get("limit");

  const result = await getRoomGraph(env, {
    projectId: auth.projectId,
    roomId,
    limit: limit ? Number(limit) : undefined,
  });

  return json(result, { headers: corsHeaders });
}

async function dispatchExtractForRoom(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError, isValidId,
  } = pickRouteDeps(h, [
    "env", "json", "corsHeaders", "requestLogCtx",
    "verifyJwtAndGetContext", "logError", "isValidId",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  if (env.KNOWLEDGE_GRAPH_ENABLED !== "true" && env.KNOWLEDGE_GRAPH_ENABLED !== "1") {
    return json({ error: "knowledge_graph_disabled" }, { status: 404, headers: corsHeaders });
  }

  if (!workerSharedLlmAllowed(env, auth.projectId)) {
    return json({ error: "llm_not_allowed" }, { status: 403, headers: corsHeaders });
  }

  const pathParts = url.pathname.split("/");
  const roomId = pathParts[1];
  if (!isValidId(roomId)) {
    return json({ error: "invalid_room_id" }, { status: 400, headers: corsHeaders });
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }

  const extracted = await extractKnowledgeGraph(env, {
    projectId: auth.projectId,
    roomId,
    since: body.since || null,
  });

  if (!extracted.ok) {
    const status = extracted.error === "ai_not_configured" ? 503 :
      extracted.error === "ai_provider_failed" ? 502 : 400;
    return json({ error: extracted.error }, { status, headers: corsHeaders });
  }

  const persisted = await persistKnowledgeGraph(env, {
    projectId: auth.projectId,
    roomId,
    nodes: extracted.nodes,
    edges: extracted.edges,
  });

  return json(
    {
      nodesExtracted: extracted.nodes.length,
      edgesExtracted: extracted.edges.length,
      nodesInserted: persisted.nodesInserted,
      edgesInserted: persisted.edgesInserted,
    },
    { headers: corsHeaders },
  );
}

async function dispatchNodeTimeline(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError,
  } = pickRouteDeps(h, [
    "env", "json", "corsHeaders", "requestLogCtx",
    "verifyJwtAndGetContext", "logError",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const pathParts = url.pathname.split("/");
  const nodeId = pathParts[3];

  const result = await getEntityTimeline(env, {
    projectId: auth.projectId,
    nodeId,
  });

  if (!result.ok) {
    return json({ error: result.error }, { status: 404, headers: corsHeaders });
  }

  return json(result, { headers: corsHeaders });
}

async function dispatchGetNode(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError,
  } = pickRouteDeps(h, [
    "env", "json", "corsHeaders", "requestLogCtx",
    "verifyJwtAndGetContext", "logError",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const pathParts = url.pathname.split("/");
  const nodeId = pathParts[3];

  const result = await queryKnowledgeGraph(env, {
    projectId: auth.projectId,
    nodeId,
  });

  if (!result.ok) {
    return json({ error: result.error }, { status: 500, headers: corsHeaders });
  }

  return json(result, { headers: corsHeaders });
}

async function dispatchQueryProject(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError,
  } = pickRouteDeps(h, [
    "env", "json", "corsHeaders", "requestLogCtx",
    "verifyJwtAndGetContext", "logError",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  let body;
  try { body = await request.json(); } catch {
    return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders });
  }

  const result = await queryKnowledgeGraph(env, {
    projectId: auth.projectId,
    roomId: body.roomId || null,
    nodeType: body.nodeType || null,
    edgeType: body.edgeType || null,
    nodeId: body.nodeId || null,
    limit: body.limit || undefined,
    includeSuperseded: body.includeSuperseded === true,
  });

  return json(result, { headers: corsHeaders });
}
