import { pickRouteDeps } from "./route-http-deps.js";
import { readDeviceBearer } from "../lib/device-secret.js";
import {
  authenticateIoTDevice,
  ackIoTAlarm,
  assignIoTAlarm,
  clearIoTAlarm,
  createIoTRpc,
  createIoTRule,
  deleteIoTDevice,
  deleteIoTReadings,
  deleteIoTRpc,
  getIoTDevice,
  getIoTDeviceHealth,
  getIoTShadow,
  ingestIoTReading,
  listIoTAlarms,
  listIoTDevices,
  listIoTReadingKeys,
  listIoTReadings,
  listIoTRules,
  listPersistentIoTRpc,
  mergeIoTReported,
  pullIoTRpc,
  registerIoTDevice,
  replyIoTRpc,
  unassignIoTAlarm,
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
  if (readingMatch && request.method === "GET") {
    return dispatchListReadings(request, url, h, decodeURIComponent(readingMatch[1]));
  }
  if (readingMatch && request.method === "DELETE") {
    return dispatchDeleteReadings(request, url, h, decodeURIComponent(readingMatch[1]));
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

  const keysMatch = path.match(/^\/iot\/devices\/([^/]+)\/readings\/keys$/);
  if (keysMatch && request.method === "GET") {
    return dispatchReadingKeys(request, h, decodeURIComponent(keysMatch[1]));
  }

  const rpcPersistent = path.match(/^\/iot\/devices\/([^/]+)\/rpc\/persistent$/);
  if (rpcPersistent && request.method === "GET") {
    return dispatchListPersistentRpc(request, h, decodeURIComponent(rpcPersistent[1]));
  }
  const rpcMatch = path.match(/^\/iot\/devices\/([^/]+)\/rpc$/);
  if (rpcMatch && request.method === "GET") {
    return dispatchPullRpc(request, h, decodeURIComponent(rpcMatch[1]));
  }
  if (rpcMatch && request.method === "POST") {
    return dispatchCreateRpc(request, h, decodeURIComponent(rpcMatch[1]));
  }
  const rpcReplyMatch = path.match(/^\/iot\/devices\/([^/]+)\/rpc\/([^/]+)$/);
  if (rpcReplyMatch && request.method === "POST") {
    return dispatchReplyRpc(request, h, decodeURIComponent(rpcReplyMatch[1]), decodeURIComponent(rpcReplyMatch[2]));
  }
  if (rpcReplyMatch && request.method === "DELETE") {
    return dispatchDeleteRpc(request, h, decodeURIComponent(rpcReplyMatch[1]), decodeURIComponent(rpcReplyMatch[2]));
  }

  const deviceOne = path.match(/^\/iot\/devices\/([^/]+)$/);
  if (deviceOne && request.method === "GET") {
    return dispatchGetDevice(request, h, decodeURIComponent(deviceOne[1]));
  }
  if (deviceOne && request.method === "DELETE") {
    return dispatchDeleteDevice(request, h, decodeURIComponent(deviceOne[1]));
  }

  if (path === "/iot/rules" && request.method === "GET") {
    return dispatchListRules(request, h);
  }
  if (path === "/iot/rules" && request.method === "POST") {
    return dispatchCreateRule(request, h);
  }

  if (path === "/iot/alarms" && request.method === "GET") {
    return dispatchListAlarms(request, url, h);
  }
  const alarmAck = path.match(/^\/iot\/alarms\/([^/]+)\/ack$/);
  if (alarmAck && request.method === "POST") {
    return dispatchAckAlarm(request, h, decodeURIComponent(alarmAck[1]));
  }
  const alarmClear = path.match(/^\/iot\/alarms\/([^/]+)\/clear$/);
  if (alarmClear && request.method === "POST") {
    return dispatchClearAlarm(request, h, decodeURIComponent(alarmClear[1]));
  }
  const alarmAssign = path.match(/^\/iot\/alarms\/([^/]+)\/assign$/);
  if (alarmAssign && request.method === "POST") {
    return dispatchAssignAlarm(request, h, decodeURIComponent(alarmAssign[1]));
  }
  if (alarmAssign && request.method === "DELETE") {
    return dispatchUnassignAlarm(request, h, decodeURIComponent(alarmAssign[1]));
  }

  return null;
}

async function deviceOrJwt(request, env, h, deviceId) {
  const deviceKey = readDeviceBearer(request);
  if (deviceKey.startsWith("iot_")) {
    const device = await authenticateIoTDevice(env, deviceKey);
    if (!device || device.id !== deviceId) return null;
    return { projectId: device.projectId, userId: device.id, deviceAuth: true };
  }
  return authContext(request, env, h);
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
  const deviceKey = readDeviceBearer(request);
  let auth = null;
  if (deviceKey.startsWith("iot_")) {
    const device = await authenticateIoTDevice(env, deviceKey);
    if (!device || device.id !== deviceId) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    auth = { projectId: device.projectId, userId: device.id };
  } else {
    auth = await authContext(request, env, h);
  }
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await ingestIoTReading(env, auth, deviceId, body ?? {});
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : result.error === "quota_exceeded" ? 429 : 400;
    return json({ error: result.error, retryAfterSeconds: result.retryAfterSeconds }, { status, headers: corsHeaders });
  }
  return json(result, { headers: corsHeaders });
}

async function dispatchListReadings(request, url, h, deviceId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const result = await listIoTReadings(env, auth, deviceId, {
    sensor: url.searchParams.get("sensor") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    limit: url.searchParams.get("limit") || undefined,
  });
  if (!result.ok) return json({ error: result.error }, { status: 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchDeleteReadings(request, url, h, deviceId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const result = await deleteIoTReadings(env, auth, deviceId, {
    sensor: url.searchParams.get("sensor") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
  });
  if (!result.ok) return json({ error: result.error }, { status: 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchGetShadow(request, h, deviceId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await deviceOrJwt(request, env, h, deviceId);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const result = await getIoTShadow(env, auth, deviceId);
  if (!result.ok) return json({ error: result.error }, { status: 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchReadingKeys(request, h, deviceId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const result = await listIoTReadingKeys(env, auth, deviceId);
  if (!result.ok) return json({ error: result.error }, { status: 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchPullRpc(request, h, deviceId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await deviceOrJwt(request, env, h, deviceId);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const result = await pullIoTRpc(env, auth, deviceId);
  return json(result, { headers: corsHeaders });
}

async function dispatchCreateRpc(request, h, deviceId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await deviceOrJwt(request, env, h, deviceId);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  if (auth.deviceAuth) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await createIoTRpc(env, auth, deviceId, body ?? {});
  if (!result.ok) return json({ error: result.error }, { status: result.error === "not_found" ? 404 : 400, headers: corsHeaders });
  return json(result, { status: 201, headers: corsHeaders });
}

async function dispatchReplyRpc(request, h, deviceId, rpcId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await deviceOrJwt(request, env, h, deviceId);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await replyIoTRpc(env, auth, deviceId, rpcId, body?.result ?? body);
  if (!result.ok) return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchListPersistentRpc(request, h, deviceId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  return json(await listPersistentIoTRpc(env, auth, deviceId), { headers: corsHeaders });
}

async function dispatchDeleteRpc(request, h, deviceId, rpcId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const result = await deleteIoTRpc(env, auth, deviceId, rpcId);
  if (!result.ok) return json({ error: result.error }, { status: result.status || 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchGetDevice(request, h, deviceId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const result = await getIoTDevice(env, auth, deviceId);
  if (!result.ok) return json({ error: result.error }, { status: 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchDeleteDevice(request, h, deviceId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const result = await deleteIoTDevice(env, auth, deviceId);
  if (!result.ok) return json({ error: result.error }, { status: result.status || 404, headers: corsHeaders });
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
  const auth = await deviceOrJwt(request, env, h, deviceId);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  if (auth.deviceAuth || body?.reported) {
    const result = await mergeIoTReported(env, auth, deviceId, body?.reported ?? body);
    if (!result.ok) return json({ error: result.error }, { status: 404, headers: corsHeaders });
    return json(result, { headers: corsHeaders });
  }
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

async function dispatchListRules(request, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  return json(await listIoTRules(env, auth), { headers: corsHeaders });
}

async function dispatchListAlarms(request, url, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  return json(await listIoTAlarms(env, auth, { deviceId: url.searchParams.get("deviceId") || undefined }), { headers: corsHeaders });
}

async function dispatchAckAlarm(request, h, alarmId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const result = await ackIoTAlarm(env, auth, alarmId);
  if (!result.ok) return json({ error: result.error }, { status: result.status || 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchClearAlarm(request, h, alarmId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const result = await clearIoTAlarm(env, auth, alarmId);
  if (!result.ok) return json({ error: result.error }, { status: result.status || 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchAssignAlarm(request, h, alarmId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const body = await request.json().catch(() => null);
  const result = await assignIoTAlarm(env, auth, alarmId, body?.assigneeId);
  if (!result.ok) return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchUnassignAlarm(request, h, alarmId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const result = await unassignIoTAlarm(env, auth, alarmId);
  if (!result.ok) return json({ error: result.error }, { status: result.status || 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}
