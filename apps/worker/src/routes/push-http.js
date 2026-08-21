/**
 * Push device registration (P10-SB7) + Web Push / VAPID (P10-ext, Pusher Beams gap).
 * @returns {Promise<Response|null>}
 */
import { pickRouteDeps } from "./route-http-deps.js";
import { parsePushDeviceBody } from "../lib/http-body.js";
import {
  registerPushDevice,
  unregisterPushDevice,
  listPushDevices,
  isPushEnabled,
  registerWebPushSubscription,
  unregisterWebPushSubscription,
  listWebPushSubscriptions,
  getVapidPublicKeyForProject,
  recordPushDeliveryAck,
} from "../lib/push-notifications.js";
import {
  getProjectPushConfig,
  listProjectPushConfigs,
  upsertProjectPushConfig,
} from "../lib/push-config.js";

export async function dispatchPushRoutes(request, url, h) {
  const { env, corsHeaders, json, verifyJwtAndGetContext, logError, requestLogCtx, hasAnyRole } =
    pickRouteDeps(h, [
      "env",
      "corsHeaders",
      "json",
      "verifyJwtAndGetContext",
      "logError",
      "requestLogCtx",
      "hasAnyRole",
    ]);

  if (url.pathname === "/push/devices" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const devices = await listPushDevices(env, auth.projectId, auth.userId);
    return json({ enabled: isPushEnabled(env), devices });
  }

  if (url.pathname === "/push/devices" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const body = await request.json().catch(() => null);
    const parsed = parsePushDeviceBody(body);
    if (!parsed.ok) {
      return json({ error: parsed.error }, { status: 400 });
    }
    const result = await registerPushDevice(env, {
      projectId: auth.projectId,
      userId: auth.userId,
      platform: parsed.platform,
      token: parsed.token,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: 400 });
    }
    return json({ ok: true, id: result.id });
  }

  const deleteMatch = url.pathname.match(/^\/push\/devices\/([^/]+)$/);
  if (deleteMatch && request.method === "DELETE") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    await unregisterPushDevice(env, auth.projectId, auth.userId, deleteMatch[1]);
    return json({ ok: true });
  }

  // ---------- Web Push / VAPID ----------

  // Public endpoint (no auth): clients need the VAPID public key before they
  // can call `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`.
  // The key is not sensitive — it is published in the `aud` of the VAPID JWT.
  if (url.pathname === "/push/web/vapid-public-key" && request.method === "GET") {
    const projectId =
      url.searchParams.get("projectId") ||
      request.headers.get("X-Fluxy-Project-Id") ||
      env.DEFAULT_PROJECT_ID ||
      "default";
    if (!projectId) {
      return json({ error: "projectId required" }, { status: 400 });
    }
    const publicKey = await getVapidPublicKeyForProject(env, projectId);
    if (!publicKey) {
      return json({ error: "vapid_unavailable" }, { status: 503 });
    }
    const subject =
      env.VAPID_SUBJECT ||
      (env.PUBLIC_APP_URL ? `https://${new URL(env.PUBLIC_APP_URL).host}` : "mailto:admin@fluxychat.local");
    return json({ publicKey, subject });
  }

  if (url.pathname === "/push/web/subscribe" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const body = await request.json().catch(() => null);
    const result = await registerWebPushSubscription(env, {
      projectId: auth.projectId,
      userId: auth.userId,
      endpoint: body?.endpoint,
      p256dh: body?.keys?.p256dh,
      auth: body?.keys?.auth,
      userAgent: request.headers.get("User-Agent") || body?.userAgent,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: 400 });
    }
    return json({ ok: true });
  }

  if (url.pathname === "/push/web/subscriptions" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const subs = await listWebPushSubscriptions(env, auth.projectId, auth.userId);
    return json({ subscriptions: subs });
  }

  const webDeleteMatch = url.pathname.match(/^\/push\/web\/subscribe\/(.+)$/);
  if (webDeleteMatch && request.method === "DELETE") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const result = await unregisterWebPushSubscription(
      env,
      auth.projectId,
      auth.userId,
      decodeURIComponent(webDeleteMatch[1])
    );
    if (!result.ok) {
      return json({ error: result.error }, { status: 400 });
    }
    return json({ ok: true, removed: result.removed });
  }

  // ---------- CP-003: Delivery ack ----------

  if (url.pathname === "/push/delivery-ack" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const body = await request.json().catch(() => null);
    const result = await recordPushDeliveryAck(env, {
      projectId: auth.projectId,
      userId: auth.userId,
      roomId: body?.roomId,
      messageId: body?.messageId,
      platform: body?.platform || "web",
      deliveryLogId: body?.deliveryLogId,
      clientMeta: body?.clientMeta,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: 400 });
    }
    return json({ ok: true, id: result.id });
  }

  // ---------- CP-005: Per-project push config (admin) ----------

  if (url.pathname === "/push/config" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth || !hasAnyRole(auth, ["owner", "admin"])) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const environment = url.searchParams.get("environment") || undefined;
    if (environment) {
      const config = await getProjectPushConfig(env, auth.projectId, environment);
      return json({ config });
    }
    const configs = await listProjectPushConfigs(env, auth.projectId);
    return json({ configs });
  }

  if (url.pathname === "/push/config" && request.method === "PUT") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth || !hasAnyRole(auth, ["owner", "admin"])) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const body = await request.json().catch(() => null);
    const result = await upsertProjectPushConfig(env, {
      projectId: auth.projectId,
      environment: body?.environment,
      fcmServerKey: body?.fcmServerKey,
      fcmProjectId: body?.fcmProjectId,
      fcmServiceAccountJson: body?.fcmServiceAccountJson,
      apnsKeyId: body?.apnsKeyId,
      apnsTeamId: body?.apnsTeamId,
      apnsBundleId: body?.apnsBundleId,
      apnsPrivateKeyPem: body?.apnsPrivateKeyPem,
      apnsUseSandbox: body?.apnsUseSandbox,
      webPushEnabled: body?.webPushEnabled,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: 400 });
    }
    return json({ ok: true, id: result.id, environment: result.environment });
  }

  return null;
}

