import { pickRouteDeps } from "./route-http-deps.js";
import {
  commitAgentVersion,
  createAgentConfig,
  deployAgentVersion,
  getAgentConfig,
  listAgentConfigs,
  listAgentMemories,
  upsertAgentMemory,
} from "../lib/agent-platform-worker.js";

export async function dispatchAgentPlatformRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/agents/platform/")) return null;

  if (path === "/agents/platform/agents" && request.method === "POST") {
    return dispatchCreate(request, h);
  }
  if (path === "/agents/platform/agents" && request.method === "GET") {
    return dispatchList(request, url, h);
  }

  const agentMatch = path.match(/^\/agents\/platform\/agents\/([^/]+)$/);
  if (agentMatch && request.method === "GET") {
    return dispatchGet(request, h, decodeURIComponent(agentMatch[1]));
  }

  const versionMatch = path.match(/^\/agents\/platform\/agents\/([^/]+)\/versions$/);
  if (versionMatch && request.method === "POST") {
    return dispatchVersion(request, h, decodeURIComponent(versionMatch[1]));
  }

  const deployMatch = path.match(/^\/agents\/platform\/agents\/([^/]+)\/deploy$/);
  if (deployMatch && request.method === "POST") {
    return dispatchDeploy(request, h, decodeURIComponent(deployMatch[1]));
  }

  const memoryMatch = path.match(/^\/agents\/platform\/agents\/([^/]+)\/memories$/);
  if (memoryMatch && request.method === "GET") {
    return dispatchListMemories(request, url, h, decodeURIComponent(memoryMatch[1]));
  }
  if (memoryMatch && request.method === "PUT") {
    return dispatchUpsertMemory(request, h, decodeURIComponent(memoryMatch[1]));
  }

  return null;
}

async function authContext(request, env, h) {
  const { verifyJwtAndGetContext, logError, requestLogCtx } = pickRouteDeps(h, [
    "verifyJwtAndGetContext",
    "logError",
    "requestLogCtx",
  ]);
  return verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
}

async function dispatchCreate(request, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await createAgentConfig(env, auth, body ?? {});
  if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchList(request, url, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const result = await listAgentConfigs(env, auth, {
    workspaceId: url.searchParams.get("workspaceId") || undefined,
    status: url.searchParams.get("status") || undefined,
    limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
  });
  return json(result, { headers: corsHeaders });
}

async function dispatchGet(request, h, agentId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const result = await getAgentConfig(env, auth, agentId);
  if (!result.ok) return json({ error: result.error }, { status: 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchVersion(request, h, agentId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await commitAgentVersion(env, auth, agentId, body ?? {});
  if (!result.ok) return json({ error: result.error }, { status: result.error === "not_found" ? 404 : 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchDeploy(request, h, agentId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await deployAgentVersion(env, auth, agentId, body ?? {});
  if (!result.ok) return json({ error: result.error }, { status: result.error === "not_found" ? 404 : 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchListMemories(request, url, h, agentId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const result = await listAgentMemories(env, auth, agentId, {
    userId: url.searchParams.get("userId") || undefined,
    limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
  });
  if (!result.ok) return json({ error: result.error }, { status: 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchUpsertMemory(request, h, agentId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await upsertAgentMemory(env, auth, agentId, body ?? {});
  if (!result.ok) return json({ error: result.error }, { status: result.error === "not_found" ? 404 : 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}
