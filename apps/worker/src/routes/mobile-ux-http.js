import { resolveMemberContext, resolveAdminContext } from "../lib/admin-route-context.js";
import { pickRouteDeps } from "./route-http-deps.js";
import {
  logPushDelivery,
  getPushDeliveryStats,
  enqueueOfflineMessage,
  getPendingOfflineMessages,
  markOfflineMessagesSent,
  sweepExpiredOfflineQueue,
  registerDevice,
  listDevices,
  deactivateDevice,
  generatePWAManifest,
} from "../lib/mobile-ux.js";

export async function dispatchMobileUxRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/api/mobile") && !path.match(/^\/api\/(push|offline|device|pwa)/)) {
    return null;
  }

  const { json: respond } = pickRouteDeps(h, ["json"]);
  const { route, params } = parseMobileRoute(url.pathname);

  if (route === "pwa_manifest") {
    return respond(generatePWAManifest(), h);
  }

  if (route === "offline_sweep") {
    const sweepCtx = await resolveAdminContext(request, h);
    if (sweepCtx.response) return sweepCtx.response;
    const result = await sweepExpiredOfflineQueue(sweepCtx.env);
    return respond(result, h);
  }

  const ctx = await resolveMemberContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, projectId, userId } = ctx;

  if (route === "push_log") {
    const body = await request.json().catch(() => ({}));
    const result = await logPushDelivery(env, {
      projectId,
      userId: body.userId || userId,
      roomId: body.roomId,
      messageId: body.messageId,
      platform: body.platform,
      status: body.status,
      errorMessage: body.errorMessage,
    });
    return respond(result, h);
  }

  if (route === "push_stats") {
    const result = await getPushDeliveryStats(env, {
      projectId,
      userId: url.searchParams.get("userId") || params.userId || userId,
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    return respond(result, h);
  }

  if (route === "offline_enqueue") {
    const body = await request.json().catch(() => ({}));
    const result = await enqueueOfflineMessage(env, {
      projectId,
      userId: body.userId || userId,
      roomId: body.roomId,
      clientId: body.clientId,
      content: body.content,
      tempId: body.tempId,
    });
    return respond(result, h);
  }

  if (route === "offline_pending") {
    const result = await getPendingOfflineMessages(env, {
      projectId,
      userId: url.searchParams.get("userId") || userId,
      roomId: params.roomId || url.searchParams.get("roomId"),
    });
    return respond(result, h);
  }

  if (route === "offline_sync") {
    const body = await request.json().catch(() => ({}));
    const ids = body.ids || [];
    if (!ids.length) return respond({ ok: true, sent: 0 }, h);
    const result = await markOfflineMessagesSent(env, { ids });
    return respond(result, h);
  }

  if (route === "device_register") {
    const body = await request.json().catch(() => ({}));
    const result = await registerDevice(env, {
      projectId,
      userId: body.userId || userId,
      platform: body.platform,
      endpoint: body.endpoint,
      pushToken: body.pushToken,
      appVersion: body.appVersion,
      osVersion: body.osVersion,
      deviceModel: body.deviceModel,
    });
    return respond(result, h);
  }

  if (route === "device_list") {
    const targetUserId = url.searchParams.get("userId") || params.userId || userId;
    if (!targetUserId) return respond({ ok: true, devices: [], count: 0 }, h);
    const result = await listDevices(env, { projectId, userId: targetUserId });
    return respond(result, h);
  }

  if (route === "device_deactivate") {
    const body = await request.json().catch(() => ({}));
    const result = await deactivateDevice(env, {
      projectId,
      userId: body.userId || userId,
      deviceId: params.deviceId || body.deviceId,
    });
    return respond(result, h);
  }

  return null;
}

function parseMobileRoute(pathname) {
  const segments = pathname.replace(/^\/api\/mobile\/?/, "").replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const params = {};

  if (segments[0] === "push") {
    return { route: `push_${segments[1]}`, params: { id: segments[2] } };
  }
  if (segments[0] === "offline") {
    return { route: `offline_${segments[1]}`, params: { roomId: segments[2] } };
  }
  if (segments[0] === "device") {
    return { route: `device_${segments[1]}`, params: { deviceId: segments[2] } };
  }
  if (segments[0] === "pwa" && segments[1] === "manifest") {
    return { route: "pwa_manifest", params };
  }

  return { route: segments.join("_"), params };
}
