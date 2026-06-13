/**
 * P19-E: Realtime Notifications Engine HTTP Routes.
 *
 * Channels: POST/GET /enterprise/notifications/channels, GET/DELETE /enterprise/notifications/channels/:id
 * Rules:    POST/GET /enterprise/notifications/rules, DELETE /enterprise/notifications/rules/:id
 * Send:     POST /enterprise/notifications/send, POST /enterprise/notifications/bulk, POST /enterprise/notifications/broadcast
 * User:     GET /enterprise/notifications/user, POST /enterprise/notifications/:id/read, POST /enterprise/notifications/read-all
 * Stats:    GET /enterprise/notifications/unread, GET /enterprise/notifications/stats
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  createChannel, getChannel, listChannels, deleteChannel,
  createRule, listRules, deleteRule,
  sendNotification, sendBulkNotifications, broadcastNotification,
  getUserNotifications, markAsRead, markAllAsRead, getUnreadCount, getNotificationStats,
} from "../lib/realtime-notifications.js";

export async function dispatchNotificationEngineRoutes(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError, hasAnyRole,
  } = pickRouteDeps(h, ["env", "json", "corsHeaders", "requestLogCtx", "verifyJwtAndGetContext", "logError", "hasAnyRole"]);

  async function adminAuth() {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return null;
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) return null;
    return auth;
  }

  async function anyAuth() {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    return auth;
  }

  /* Channels */
  if (url.pathname === "/enterprise/notifications/channels" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.name || !body?.channelType) return json({ error: "name and channelType required" }, { status: 400 });
    const ch = await createChannel(env, {
      projectId: auth.projectId, name: body.name, channelType: body.channelType,
      config: body.config, rateLimitPerMinute: body.rateLimitPerMinute,
    });
    return json(ch, { status: 201 });
  }

  if (url.pathname === "/enterprise/notifications/channels" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const channels = await listChannels(env, { projectId: auth.projectId });
    return json({ channels, count: channels.length });
  }

  const chMatch = url.pathname.match(/^\/enterprise\/notifications\/channels\/([^/]+)$/);
  if (chMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ch = await getChannel(env, { projectId: auth.projectId, channelId: decodeURIComponent(chMatch[1]) });
    if (!ch) return json({ error: "not_found" }, { status: 404 });
    return json(ch);
  }

  if (chMatch && request.method === "DELETE") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const deleted = await deleteChannel(env, { projectId: auth.projectId, channelId: decodeURIComponent(chMatch[1]) });
    return json({ deleted });
  }

  /* Rules */
  if (url.pathname === "/enterprise/notifications/rules" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.channelId || !body?.name || !body?.triggerEvent) return json({ error: "channelId, name, triggerEvent required" }, { status: 400 });
    const rule = await createRule(env, {
      projectId: auth.projectId, channelId: body.channelId, name: body.name,
      triggerEvent: body.triggerEvent, conditions: body.conditions,
      template: body.template, priority: body.priority,
    });
    return json(rule, { status: 201 });
  }

  if (url.pathname === "/enterprise/notifications/rules" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const rules = await listRules(env, { projectId: auth.projectId, channelId: params.channelId });
    return json({ rules, count: rules.length });
  }

  const ruleMatch = url.pathname.match(/^\/enterprise\/notifications\/rules\/([^/]+)$/);
  if (ruleMatch && request.method === "DELETE") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const deleted = await deleteRule(env, { projectId: auth.projectId, ruleId: decodeURIComponent(ruleMatch[1]) });
    return json({ deleted });
  }

  /* Send */
  if (url.pathname === "/enterprise/notifications/send" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.channelId || !body?.userId || !body?.title || !body?.body) {
      return json({ error: "channelId, userId, title, body required" }, { status: 400 });
    }
    const n = await sendNotification(env, {
      projectId: auth.projectId, channelId: body.channelId, ruleId: body.ruleId,
      userId: body.userId, title: body.title, body: body.body, data: body.data,
    });
    return json(n, { status: 201 });
  }

  if (url.pathname === "/enterprise/notifications/bulk" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.channelId || !body?.userIds || !body?.title || !body?.body) {
      return json({ error: "channelId, userIds, title, body required" }, { status: 400 });
    }
    const result = await sendBulkNotifications(env, {
      projectId: auth.projectId, channelId: body.channelId, ruleId: body.ruleId,
      userIds: body.userIds, title: body.title, body: body.body, data: body.data,
    });
    return json(result, { status: 201 });
  }

  if (url.pathname === "/enterprise/notifications/broadcast" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.channelId || !body?.title || !body?.body) {
      return json({ error: "channelId, title, body required" }, { status: 400 });
    }
    const result = await broadcastNotification(env, {
      projectId: auth.projectId, channelId: body.channelId, ruleId: body.ruleId,
      title: body.title, body: body.body, data: body.data, targetSegment: body.targetSegment,
    });
    return json(result, { status: 201 });
  }

  /* User */
  if (url.pathname === "/enterprise/notifications/user" && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const targetUserId = params.userId || auth.userId;
    const notifications = await getUserNotifications(env, {
      projectId: auth.projectId, userId: targetUserId,
      unreadOnly: params.unread === "true", limit: params.limit ? parseInt(params.limit) : 20,
    });
    return json({ notifications, count: notifications.length });
  }

  const readMatch = url.pathname.match(/^\/enterprise\/notifications\/([^/]+)\/read$/);
  if (readMatch && request.method === "POST") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ok = await markAsRead(env, { projectId: auth.projectId, notificationId: decodeURIComponent(readMatch[1]) });
    return json({ ok });
  }

  if (url.pathname === "/enterprise/notifications/read-all" && request.method === "POST") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const count = await markAllAsRead(env, { projectId: auth.projectId, userId: auth.userId });
    return json({ count });
  }

  if (url.pathname === "/enterprise/notifications/unread" && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const count = await getUnreadCount(env, { projectId: auth.projectId, userId: auth.userId });
    return json({ count });
  }

  if (url.pathname === "/enterprise/notifications/stats" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const stats = await getNotificationStats(env, { projectId: auth.projectId });
    return json(stats);
  }

  return null;
}
