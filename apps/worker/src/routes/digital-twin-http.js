import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessRoom } from "../lib/room-access.js";
import {
  addSpatialEntity,
  createSpatialScene,
  deleteSpatialScene,
  getSpatialScene,
  grantSpatialAgent,
  listSpatialScenes,
} from "../lib/digital-twin.js";

export async function dispatchDigitalTwinRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/spatial/")) return null;

  if (path === "/spatial/scenes" && request.method === "POST") {
    return dispatchCreateScene(request, h);
  }
  if (path === "/spatial/scenes" && request.method === "GET") {
    return dispatchListScenes(request, url, h);
  }

  const sceneMatch = path.match(/^\/spatial\/scenes\/([^/]+)$/);
  if (sceneMatch && request.method === "GET") {
    return dispatchGetScene(request, h, decodeURIComponent(sceneMatch[1]));
  }
  if (sceneMatch && request.method === "DELETE") {
    return dispatchDeleteScene(request, h, decodeURIComponent(sceneMatch[1]));
  }

  const entityMatch = path.match(/^\/spatial\/scenes\/([^/]+)\/entities$/);
  if (entityMatch && request.method === "POST") {
    return dispatchAddEntity(request, h, decodeURIComponent(entityMatch[1]));
  }

  const grantMatch = path.match(/^\/spatial\/scenes\/([^/]+)\/grants$/);
  if (grantMatch && request.method === "POST") {
    return dispatchGrant(request, h, decodeURIComponent(grantMatch[1]));
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

async function dispatchCreateScene(request, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const body = await request.json().catch(() => null);
  if (body?.roomId) {
    const allowed = await canAccessRoom(env, auth, body.roomId);
    if (!allowed) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  const result = await createSpatialScene(env, body ?? {}, auth);
  if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchListScenes(request, url, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const result = await listSpatialScenes(env, auth, {
    roomId: url.searchParams.get("roomId") || undefined,
    limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
  });
  return json(result, { headers: corsHeaders });
}

async function dispatchGetScene(request, h, sceneId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const result = await getSpatialScene(env, auth, sceneId);
  if (!result.ok) return json({ error: result.error }, { status: 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchDeleteScene(request, h, sceneId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const result = await deleteSpatialScene(env, auth, sceneId);
  if (!result.ok) return json({ error: result.error }, { status: 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchAddEntity(request, h, sceneId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const body = await request.json().catch(() => null);
  const result = await addSpatialEntity(env, auth, sceneId, body ?? {});
  if (!result.ok) return json({ error: result.error }, { status: result.error === "not_found" ? 404 : 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchGrant(request, h, sceneId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const body = await request.json().catch(() => null);
  const result = await grantSpatialAgent(env, auth, sceneId, body ?? {});
  if (!result.ok) return json({ error: result.error }, { status: result.error === "not_found" ? 404 : 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}
