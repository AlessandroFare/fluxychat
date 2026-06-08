import { pickRouteDeps } from "./route-http-deps.js";
import {
  countPendingBatch,
  flushUserNotificationBatch,
} from "../lib/notification-batch.js";
import {
  getQuietHoursPreferences,
  isInQuietHours,
  upsertQuietHoursPreferences,
} from "../lib/quiet-hours.js";

export async function dispatchNotificationsRoutes(request, url, h) {
  const {
    env,
    corsHeaders,
    json,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
  } = pickRouteDeps(h, [
    "env",
    "corsHeaders",
    "json",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
  ]);

  if (url.pathname === "/notifications" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const prefs = await getQuietHoursPreferences(env, auth.projectId, auth.userId);
    const pending = await countPendingBatch(env, auth.projectId, auth.userId);
    if (pending > 0 && (!prefs.enabled || !isInQuietHours(prefs))) {
      await flushUserNotificationBatch(env, auth.projectId, auth.userId);
    }

    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") || 50), 1),
      100,
    );
    const unreadOnly =
      url.searchParams.get("unreadOnly") === "1" ||
      url.searchParams.get("unreadOnly") === "true";

    let sql = `SELECT id, kind, title, body, room_id, message_id, read_at, created_at
      FROM in_app_notifications
      WHERE project_id = ? AND user_id = ?`;
    const params = [auth.projectId, auth.userId];
    if (unreadOnly) {
      sql += " AND read_at IS NULL";
    }
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const rows = await env.DB.prepare(sql).bind(...params).all();
    return json({ notifications: rows.results || [] });
  }

  if (url.pathname === "/notifications/read-all" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const now = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE in_app_notifications SET read_at = ? WHERE project_id = ? AND user_id = ? AND read_at IS NULL",
    )
      .bind(now, auth.projectId, auth.userId)
      .run();
    return json({ ok: true });
  }

  const readMatch = url.pathname.match(/^\/notifications\/(\d+)\/read$/);
  if (readMatch && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const id = Number(readMatch[1]);
    const now = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE in_app_notifications SET read_at = ? WHERE id = ? AND project_id = ? AND user_id = ?",
    )
      .bind(now, id, auth.projectId, auth.userId)
      .run();
    return json({ ok: true });
  }

  if (url.pathname === "/notifications/quiet-hours" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const preferences = await getQuietHoursPreferences(env, auth.projectId, auth.userId);
    const pendingBatch = await countPendingBatch(env, auth.projectId, auth.userId);
    return json(
      {
        preferences,
        pendingBatch,
        inQuietHours: preferences.enabled && isInQuietHours(preferences),
      },
      { headers: corsHeaders },
    );
  }

  if (url.pathname === "/notifications/quiet-hours" && request.method === "PATCH") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const body = await request.json().catch(() => null);
    const result = await upsertQuietHoursPreferences(
      env,
      auth.projectId,
      auth.userId,
      {
        enabled: typeof body?.enabled === "boolean" ? body.enabled : undefined,
        timezone: typeof body?.timezone === "string" ? body.timezone : undefined,
        quietStart: typeof body?.quietStart === "string" ? body.quietStart : undefined,
        quietEnd: typeof body?.quietEnd === "string" ? body.quietEnd : undefined,
        batchPush: typeof body?.batchPush === "boolean" ? body.batchPush : undefined,
        batchInApp:
          typeof body?.batchInApp === "boolean" ? body.batchInApp : undefined,
      },
    );
    if (!result.ok) {
      return json({ error: result.error }, { status: 400, headers: corsHeaders });
    }
    if (result.preferences.enabled && !isInQuietHours(result.preferences)) {
      await flushUserNotificationBatch(env, auth.projectId, auth.userId);
    }
    return json(
      {
        preferences: result.preferences,
        pendingBatch: await countPendingBatch(env, auth.projectId, auth.userId),
        inQuietHours: result.preferences.enabled && isInQuietHours(result.preferences),
      },
      { headers: corsHeaders },
    );
  }

  if (url.pathname === "/notifications/flush-batch" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const prefs = await getQuietHoursPreferences(env, auth.projectId, auth.userId);
    if (prefs.enabled && isInQuietHours(prefs)) {
      return json(
        { error: "still_in_quiet_hours", pendingBatch: await countPendingBatch(env, auth.projectId, auth.userId) },
        { status: 409, headers: corsHeaders },
      );
    }
    const flushed = await flushUserNotificationBatch(env, auth.projectId, auth.userId);
    return json({ ok: true, ...flushed }, { headers: corsHeaders });
  }

  return null;
}
