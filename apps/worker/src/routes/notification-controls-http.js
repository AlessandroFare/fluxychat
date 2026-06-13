import { pickRouteDeps } from "./route-http-deps.js";
import {
  listPreferences,
  upsertPreference,
  deletePreference,
  createSnoozeRule,
  listSnoozeRules,
  deleteSnoozeRule,
  isNotificationSnoozed,
  cleanExpiredSnoozeRules,
  priorityWeight,
  shouldBypassQuietHours,
} from "../lib/notification-controls.js";

export async function dispatchNotificationControlsRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
  } = pickRouteDeps(h, [
    "env", "json", "corsHeaders", "requestLogCtx", "verifyJwtAndGetContext", "logError",
  ]);

  const prefsMatch = url.pathname === "/notification/preferences";
  const prefTopicMatch = url.pathname.match(/^\/notification\/preferences\/([^/]+)$/);
  const snoozeMatch = url.pathname === "/notification/snooze";
  const snoozeIdMatch = url.pathname.match(/^\/notification\/snooze\/([^/]+)$/);
  const checkSnoozeMatch = url.pathname === "/notification/snooze/check";
  const cleanSnoozeMatch = url.pathname === "/admin/notification/snooze/clean";
  const priorityMatch = url.pathname === "/notification/priority";

  if (!prefsMatch && !prefTopicMatch && !snoozeMatch && !snoozeIdMatch && !checkSnoozeMatch && !cleanSnoozeMatch && !priorityMatch) {
    return null;
  }

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    /* ── GET /notification/preferences ── */
    if (prefsMatch && request.method === "GET") {
      const prefs = await listPreferences(env.DB, { projectId: auth.projectId, userId: auth.userId });
      return json({ preferences: prefs, count: prefs.length }, { headers: corsHeaders });
    }

    /* ── POST /notification/preferences ── */
    if (prefsMatch && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const result = await upsertPreference(env.DB, {
        projectId: auth.projectId, userId: auth.userId,
        topic: body?.topic, roomId: body?.roomId,
        pushEnabled: body?.pushEnabled, inAppEnabled: body?.inAppEnabled,
        emailEnabled: body?.emailEnabled, digestFrequency: body?.digestFrequency,
        priorityLevel: body?.priorityLevel,
      });
      if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
      return json(result, { status: 201, headers: corsHeaders });
    }

    /* ── DELETE /notification/preferences/:topic ── */
    if (prefTopicMatch && request.method === "DELETE") {
      const topic = prefTopicMatch[1];
      const roomId = url.searchParams.get("roomId");
      const result = await deletePreference(env.DB, { projectId: auth.projectId, userId: auth.userId, topic, roomId });
      return json(result, { headers: corsHeaders });
    }

    /* ── GET /notification/snooze ── */
    if (snoozeMatch && request.method === "GET") {
      const rules = await listSnoozeRules(env.DB, { projectId: auth.projectId, userId: auth.userId });
      return json({ rules, count: rules.length }, { headers: corsHeaders });
    }

    /* ── POST /notification/snooze ── */
    if (snoozeMatch && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const result = await createSnoozeRule(env.DB, {
        projectId: auth.projectId, userId: auth.userId,
        roomId: body?.roomId, threadId: body?.threadId,
        customerId: body?.customerId, snoozeUntil: body?.snoozeUntil,
        reason: body?.reason,
      });
      if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
      return json(result, { status: 201, headers: corsHeaders });
    }

    /* ── DELETE /notification/snooze/:id ── */
    if (snoozeIdMatch && request.method === "DELETE") {
      const result = await deleteSnoozeRule(env.DB, { projectId: auth.projectId, userId: auth.userId, ruleId: snoozeIdMatch[1] });
      return json(result, { headers: corsHeaders });
    }

    /* ── POST /notification/snooze/check ── */
    if (checkSnoozeMatch && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const snoozed = await isNotificationSnoozed(env.DB, {
        projectId: auth.projectId, userId: auth.userId,
        roomId: body?.roomId, threadId: body?.threadId, customerId: body?.customerId,
      });
      return json({ snoozed }, { headers: corsHeaders });
    }

    /* ── POST /admin/notification/snooze/clean ── */
    if (cleanSnoozeMatch && request.method === "POST") {
      const roles = auth.roles || [];
      if (!roles.includes("owner") && !roles.includes("admin")) {
        return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      }
      const result = await cleanExpiredSnoozeRules(env.DB, { projectId: auth.projectId });
      return json(result, { headers: corsHeaders });
    }

    /* ── GET /notification/priority ── */
    if (priorityMatch && request.method === "GET") {
      return json({
        priorities: ["low", "normal", "high", "urgent"],
        weights: { low: 1, normal: 2, high: 3, urgent: 4 },
      }, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("notification_controls.route_error", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
