import { pickRouteDeps } from "./route-http-deps.js";
import {
  createIoTRule,
  getIoTDeviceHealth,
  getIoTShadow,
  ingestIoTReading,
  listIoTDevices,
  registerIoTDevice,
  updateIoTDesiredShadow,
} from "../lib/fluxy-iot.js";

export async function dispatchFluxyIoTRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/iot/")) return null;

  if (path === "/iot/devices" && request.method === "POST") {
    return dispatchRegister(request, h);
  }
  if (path === "/iot/devices" && request.method === "GET") {
    return dispatchList(request, url, h);
  }

  const readingMatch = path.match(/^\/iot\/devices\/([^/]+)\/readings$/);
  if (readingMatch && request.method === "POST") {
    return dispatchReading(request, h, decodeURIComponent(readingMatch[1]));
  }

  const shadowMatch = path.match(/^\/iot\/devices\/([^/]+)\/shadow$/);
  if (shadowMatch && request.method === "GET") {
    return dispatchGetShadow(request, h, decodeURIComponent(shadowMatch[1]));
  }
  if (shadowMatch && request.method === "PATCH") {
    return dispatchPatchShadow(request, h, decodeURIComponent(shadowMatch[1]));
  }

  const healthMatch = path.match(/^\/iot\/devices\/([^/]+)\/health$/);
  if (healthMatch && request.method === "GET") {
    return dispatchHealth(request, url, h, decodeURIComponent(healthMatch[1]));
  }

  if (path === "/iot/rules" && request.method === "POST") {
    return dispatchCreateRule(request, h);
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

async function dispatchRegister(request, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await registerIoTDevice(env, auth, body ?? {});
  if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchList(request, url, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const result = await listIoTDevices(env, auth, {
    fleetId: url.searchParams.get("fleetId") || undefined,
    limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
  });
  return json(result, { headers: corsHeaders });
}

async function dispatchReading(request, h, deviceId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await ingestIoTReading(env, auth, deviceId, body ?? {});
  if (!result.ok) return json({ error: result.error }, { status: result.error === "not_found" ? 404 : 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchGetShadow(request, h, deviceId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const result = await getIoTShadow(env, auth, deviceId);
  if (!result.ok) return json({ error: result.error }, { status: 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchHealth(request, url, h, deviceId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const result = await getIoTDeviceHealth(env, auth, deviceId, url.searchParams.get("sensor") || undefined);
  if (!result.ok) return json({ error: result.error }, { status: 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchPatchShadow(request, h, deviceId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await updateIoTDesiredShadow(env, auth, deviceId, body?.desired);
  if (!result.ok) return json({ error: result.error }, { status: 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchCreateRule(request, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await createIoTRule(env, auth, body ?? {});
  if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}
