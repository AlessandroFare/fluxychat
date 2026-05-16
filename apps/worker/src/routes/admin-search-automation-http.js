/**
 * Split from worker fetch handler (original lines 2347-2973).
 * @returns {Promise<Response|null>}
 */
import { pickRouteDeps } from "./route-http-deps.js";

export async function dispatchAdminSearchAutomationRoutes(request, url, h) {
  const {
    env,
    ctx,
    traceId,
    corsHeaders,
    json,
    requestLogCtx,
    verifyJwtAndGetContext,
    hasAnyRole,
    logError,
    requireAdminAuth,
    projectId,
    canAccessRoom,
    processPendingWebhookDeliveries,
    escapeLike,
    canBypassRoomMembership,
    generateRoomSummaryAndAnnounce,
    canCreateTenantProjects,
    tenantScopeForbidden,
    writeAuditEvent,
  } = pickRouteDeps(h, [
    "env",
    "ctx",
    "traceId",
    "corsHeaders",
    "json",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "logError",
    "requireAdminAuth",
    "projectId",
    "canAccessRoom",
    "processPendingWebhookDeliveries",
    "escapeLike",
    "canBypassRoomMembership",
    "generateRoomSummaryAndAnnounce",
    "canCreateTenantProjects",
    "tenantScopeForbidden",
    "writeAuditEvent",
  ]);


  // Admin: list recent reports
  if (url.pathname === "/admin/reports" && request.method === "GET") {
    if (requireAdminAuth) {
      const adminAuth = await verifyJwtAndGetContext(request, env).catch((err) => {
        if (err instanceof Response) throw err;
        console.error("JWT verify error", err);
        return null;
      });
      if (!adminAuth) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      if (!hasAnyRole(adminAuth.roles, ["owner", "admin", "moderator"])) {
        return json({ error: "forbidden" }, { status: 403 });
      }
    }
    const limit = Number(url.searchParams.get("limit") || "50");
    const rows = await env.DB.prepare(
      "SELECT id, project_id, room_id, user_id, action, reason, target_message_id, created_at FROM moderation_events WHERE project_id = ? AND action IN ('report', 'auto_flag') ORDER BY created_at DESC LIMIT ?"
    )
      .bind((await verifyJwtAndGetContext(request, env)).projectId, limit)
      .all();
    return json({ reports: rows.results || [] });
  }

  if (url.pathname === "/admin/audit/events" && request.method === "GET") {
    if (requireAdminAuth) {
      const adminAuth = await verifyJwtAndGetContext(request, env).catch((err) => {
        if (err instanceof Response) throw err;
        logError("auth.jwt_verify_failed", err, requestLogCtx);
        return null;
      });
      if (!adminAuth) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      if (!hasAnyRole(adminAuth.roles, ["owner", "admin"])) {
        return json({ error: "forbidden" }, { status: 403 });
      }
      const limit = Math.min(200, Number(url.searchParams.get("limit") || "100"));
      const action = url.searchParams.get("action");
      let sql =
        "SELECT id, project_id, actor_user_id, actor_roles, action, target_type, target_id, trace_id, metadata_json, created_at FROM operational_audit_events WHERE project_id = ?";
      const params = [adminAuth.projectId];
      if (action) {
        sql += " AND action = ?";
        params.push(action);
      }
      sql += " ORDER BY created_at DESC LIMIT ?";
      params.push(limit);
      const rows = await env.DB.prepare(sql).bind(...params).all();
      return json({ events: rows.results || [] });
    }
  }

  // Admin: list webhooks
  if (url.pathname === "/admin/webhooks" && request.method === "GET") {
    if (requireAdminAuth) {
      const adminAuth = await verifyJwtAndGetContext(request, env).catch((err) => {
        if (err instanceof Response) throw err;
        console.error("JWT verify error", err);
        return null;
      });
      if (!adminAuth) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      if (!hasAnyRole(adminAuth.roles, ["owner", "admin", "moderator"])) {
        return json({ error: "forbidden" }, { status: 403 });
      }
    }
    const adminAuth = await verifyJwtAndGetContext(request, env);
    const rows = await env.DB.prepare(
      "SELECT id, project_id, url, event_types, created_at FROM webhooks WHERE project_id = ? ORDER BY created_at DESC"
    )
      .bind(adminAuth.projectId)
      .all();
    return json({ webhooks: rows.results || [] });
  }

  if (url.pathname === "/admin/alerts/rules" && request.method === "GET") {
    if (requireAdminAuth) {
      const adminAuth = await verifyJwtAndGetContext(request, env).catch((err) => {
        if (err instanceof Response) throw err;
        logError("auth.jwt_verify_failed", err, requestLogCtx);
        return null;
      });
      if (!adminAuth) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      if (!hasAnyRole(adminAuth.roles, ["owner", "admin"])) {
        return json({ error: "forbidden" }, { status: 403 });
      }
      const rows = await env.DB.prepare(
        "SELECT id, project_id, metric_name, window_minutes, threshold_value, comparator, severity, cooldown_minutes, enabled, created_at, updated_at FROM operational_alert_rules WHERE project_id = ? ORDER BY created_at DESC LIMIT 1000" // perf: unbounded
      )
        .bind(adminAuth.projectId)
        .all();
      return json({ rules: rows.results || [] });
    }
  }

  if (url.pathname === "/admin/alerts/rules" && request.method === "POST") {
    if (requireAdminAuth) {
      const adminAuth = await verifyJwtAndGetContext(request, env).catch((err) => {
        if (err instanceof Response) throw err;
        logError("auth.jwt_verify_failed", err, requestLogCtx);
        return null;
      });
      if (!adminAuth) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      if (!hasAnyRole(adminAuth.roles, ["owner", "admin"])) {
        return json({ error: "forbidden" }, { status: 403 });
      }
      const body = await request.json().catch(() => null);
      if (!body?.metricName || !body?.thresholdValue) {
        return json({ error: "metricName and thresholdValue required" }, { status: 400 });
      }
      const now = new Date().toISOString();
      const ruleId = body.id || crypto.randomUUID();
      await env.DB.prepare(
        "INSERT OR REPLACE INTO operational_alert_rules (id, project_id, metric_name, window_minutes, threshold_value, comparator, severity, cooldown_minutes, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM operational_alert_rules WHERE id = ?), ?), ?)"
      )
        .bind(
          ruleId,
          adminAuth.projectId,
          body.metricName,
          Number(body.windowMinutes || 5),
          Number(body.thresholdValue),
          body.comparator || "gte",
          body.severity || "warning",
          Number(body.cooldownMinutes || 15),
          body.enabled === false ? 0 : 1,
          ruleId,
          now,
          now
        )
        .run();
      ctx.waitUntil(
        writeAuditEvent(env, {
          projectId: adminAuth.projectId,
          actorUserId: adminAuth.userId,
          actorRoles: adminAuth.roles,
          action: "admin.alert_rule.upsert",
          targetType: "alert_rule",
          targetId: ruleId,
          traceId,
          metadata: {
            metricName: body.metricName,
            windowMinutes: Number(body.windowMinutes || 5),
            thresholdValue: Number(body.thresholdValue),
            comparator: body.comparator || "gte",
            severity: body.severity || "warning",
            cooldownMinutes: Number(body.cooldownMinutes || 15),
            enabled: body.enabled === false ? false : true,
          },
        }).catch(() => {})
      );
      return json({
        rule: {
          id: ruleId,
          projectId: adminAuth.projectId,
          metricName: body.metricName,
          windowMinutes: Number(body.windowMinutes || 5),
          thresholdValue: Number(body.thresholdValue),
          comparator: body.comparator || "gte",
          severity: body.severity || "warning",
          cooldownMinutes: Number(body.cooldownMinutes || 15),
          enabled: body.enabled === false ? 0 : 1,
          updatedAt: now,
        },
      });
    }
  }

  if (url.pathname === "/admin/webhooks/deliveries" && request.method === "GET") {
    if (requireAdminAuth) {
      const adminAuth = await verifyJwtAndGetContext(request, env).catch((err) => {
        if (err instanceof Response) throw err;
        console.error("JWT verify error", err);
        return null;
      });
      if (!adminAuth) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      if (!hasAnyRole(adminAuth.roles, ["owner", "admin", "moderator"])) {
        return json({ error: "forbidden" }, { status: 403 });
      }
    }
    const adminAuth = await verifyJwtAndGetContext(request, env);
    const limit = Number(url.searchParams.get("limit") || "100");
    const rows = await env.DB.prepare(
      "SELECT id, project_id, webhook_id, event_type, status, attempt_count, next_attempt_at, last_http_status, last_error, delivered_at, created_at, updated_at FROM webhook_deliveries WHERE project_id = ? ORDER BY created_at DESC LIMIT ?"
    )
      .bind(adminAuth.projectId, limit)
      .all();
    return json({ deliveries: rows.results || [] });
  }

  if (
    url.pathname.startsWith("/admin/webhooks/deliveries/") &&
    url.pathname.endsWith("/replay") &&
    request.method === "POST"
  ) {
    if (requireAdminAuth) {
      const adminAuth = await verifyJwtAndGetContext(request, env).catch((err) => {
        if (err instanceof Response) throw err;
        console.error("JWT verify error", err);
        return null;
      });
      if (!adminAuth) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      if (!hasAnyRole(adminAuth.roles, ["owner", "admin", "moderator"])) {
        return json({ error: "forbidden" }, { status: 403 });
      }

      ctx.waitUntil(
        writeAuditEvent(env, {
          projectId: adminAuth.projectId,
          actorUserId: adminAuth.userId,
          actorRoles: adminAuth.roles,
          action: "admin.webhook_delivery.replay",
          targetType: "webhook_delivery",
          targetId: url.pathname.split("/")[4] || null,
          traceId,
          metadata: {},
        }).catch(() => {})
      );
    }
    const parts = url.pathname.split("/");
    const deliveryId = parts[4];
    if (!deliveryId) {
      return json({ error: "delivery id required" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const adminAuth = await verifyJwtAndGetContext(request, env);
    const res = await env.DB.prepare(
      "UPDATE webhook_deliveries SET status = 'pending', attempt_count = 0, next_attempt_at = ?, last_http_status = NULL, last_error = NULL, delivered_at = NULL, updated_at = ? WHERE id = ? AND project_id = ?"
    )
      .bind(now, now, deliveryId, adminAuth.projectId)
      .run();
    if (!res.meta?.changes) {
      return json({ error: "delivery not found" }, { status: 404 });
    }
    ctx.waitUntil(
      processPendingWebhookDeliveries(env).catch((err) =>
        console.error("webhook replay processing error", err)
      )
    );
    return json({ ok: true, deliveryId, replayScheduledAt: now });
  }

  // Message search
  if (url.pathname === "/search/messages" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) return null;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    const roomId = url.searchParams.get("roomId");
    const query = url.searchParams.get("q");
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || "50"), 1), 200);

    if (!query) return json({ error: "q required" }, { status: 400 });

    if (roomId) {
      const canAccess = await canAccessRoom(env, auth, roomId);
      if (!canAccess) {
        return json({ error: "forbidden" }, { status: 403 });
      }
    }

    let sql;
    const params = [`%${escapeLike(query)}%`];
    if (roomId) {
      sql =
        "SELECT id, room_id, user_id, content, created_at FROM messages WHERE deleted_at IS NULL AND content LIKE ? ESCAPE '\\' AND room_id = ? AND project_id = ? ORDER BY created_at DESC LIMIT ?";
      params.push(roomId, auth.projectId, limit);
    } else if (canBypassRoomMembership(auth.roles)) {
      sql =
        "SELECT id, room_id, user_id, content, created_at FROM messages WHERE deleted_at IS NULL AND content LIKE ? ESCAPE '\\' AND project_id = ? ORDER BY created_at DESC LIMIT ?";
      params.push(auth.projectId, limit);
    } else {
      sql =
        "SELECT id, room_id, user_id, content, created_at FROM messages WHERE deleted_at IS NULL AND content LIKE ? ESCAPE '\\' AND project_id = ? AND room_id IN (SELECT room_id FROM room_members WHERE user_id = ?) ORDER BY created_at DESC LIMIT ?";
      params.push(auth.projectId, auth.userId, limit);
    }

    try {
      const result = await env.DB.prepare(sql).bind(...params).all();
      return json({ messages: result.results || [] });
    } catch (err) {
      logError("search.messages_failed", err, requestLogCtx);
      return json({ error: "Search query failed" }, { status: 500 });
    }
  }

  // Conversation search by keyword
  if (
    url.pathname === "/search/conversations" &&
    request.method === "GET"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const query = url.searchParams.get("q");
    const limit = Number(url.searchParams.get("limit") || "20");
    if (!query) return json({ error: "q required" }, { status: 400 });

    const sql = canBypassRoomMembership(auth.roles)
      ? `
      SELECT room_id, COUNT(*) as matches, MAX(created_at) as lastMessage
      FROM messages
      WHERE project_id = ? AND content LIKE ? ESCAPE '\\'
        AND deleted_at IS NULL
      GROUP BY room_id
      ORDER BY lastMessage DESC
      LIMIT ?
    `
      : `
      SELECT room_id, COUNT(*) as matches, MAX(created_at) as lastMessage
      FROM messages
      WHERE project_id = ? AND content LIKE ? ESCAPE '\\'
        AND deleted_at IS NULL
        AND room_id IN (SELECT room_id FROM room_members WHERE user_id = ?)
      GROUP BY room_id
      ORDER BY lastMessage DESC
      LIMIT ?
    `;

    const result = canBypassRoomMembership(auth.roles)
      ? await env.DB.prepare(sql)
          .bind(auth.projectId, `%${escapeLike(query)}%`, limit)
          .all()
      : await env.DB.prepare(sql)
          .bind(auth.projectId, `%${escapeLike(query)}%`, auth.userId, limit)
          .all();

    return json({ rooms: result.results || [] });
  }

  // Admin mute/ban endpoints
  if (url.pathname === "/admin/mute" && request.method === "POST") {
    if (requireAdminAuth) {
      const adminAuth = await verifyJwtAndGetContext(request, env).catch((err) => {
        if (err instanceof Response) throw err;
        console.error("JWT verify error", err);
        return null;
      });
      if (!adminAuth) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      if (!hasAnyRole(adminAuth.roles, ["owner", "admin", "moderator"])) {
        return json({ error: "forbidden" }, { status: 403 });
      }
      const body = await request.json().catch(() => null);
      if (!body || !body.roomId || !body.userId) {
        return json({ error: "roomId and userId required" }, { status: 400 });
      }
      const expiresAt = body.durationSeconds
        ? new Date(Date.now() + body.durationSeconds * 1000).toISOString()
        : null;
      await env.DB.prepare(
        "INSERT INTO moderation_events (project_id, room_id, user_id, action, reason, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          projectId,
          body.roomId,
          body.userId,
          "mute",
          body.reason || "manual_mute",
          expiresAt,
          new Date().toISOString()
        )
        .run();
      ctx.waitUntil(
        writeAuditEvent(env, {
          projectId: adminAuth.projectId,
          actorUserId: adminAuth.userId,
          actorRoles: adminAuth.roles,
          action: "admin.mute",
          targetType: "user",
          targetId: body.userId,
          traceId,
          metadata: { roomId: body.roomId, expiresAt, reason: body.reason || null },
        }).catch(() => {})
      );
      return json({ ok: true, expiresAt });
    }
  }

  if (url.pathname === "/admin/ban" && request.method === "POST") {
    if (requireAdminAuth) {
      const adminAuth = await verifyJwtAndGetContext(request, env).catch((err) => {
        if (err instanceof Response) throw err;
        console.error("JWT verify error", err);
        return null;
      });
      if (!adminAuth) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      if (!hasAnyRole(adminAuth.roles, ["owner", "admin", "moderator"])) {
        return json({ error: "forbidden" }, { status: 403 });
      }
      const body = await request.json().catch(() => null);
      if (!body || !body.roomId || !body.userId) {
        return json({ error: "roomId and userId required" }, { status: 400 });
      }
      await env.DB.prepare(
        "INSERT INTO moderation_events (project_id, room_id, user_id, action, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
        .bind(
          projectId,
          body.roomId,
          body.userId,
          "ban",
          body.reason || "manual_ban",
          new Date().toISOString()
        )
        .run();
      ctx.waitUntil(
        writeAuditEvent(env, {
          projectId: adminAuth.projectId,
          actorUserId: adminAuth.userId,
          actorRoles: adminAuth.roles,
          action: "admin.ban",
          targetType: "user",
          targetId: body.userId,
          traceId,
          metadata: { roomId: body.roomId, reason: body.reason || null },
        }).catch(() => {})
      );
      return json({ ok: true });
    }
  }

  if (url.pathname === "/admin/unmute" && request.method === "POST") {
    if (requireAdminAuth) {
      const adminAuth = await verifyJwtAndGetContext(request, env).catch((err) => {
        if (err instanceof Response) throw err;
        console.error("JWT verify error", err);
        return null;
      });
      if (!adminAuth) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      if (!hasAnyRole(adminAuth.roles, ["owner", "admin", "moderator"])) {
        return json({ error: "forbidden" }, { status: 403 });
      }
      const body = await request.json().catch(() => null);
      if (!body || !body.roomId || !body.userId) {
        return json({ error: "roomId and userId required" }, { status: 400 });
      }
      await env.DB.prepare(
        "INSERT INTO moderation_events (project_id, room_id, user_id, action, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
        .bind(
          projectId,
          body.roomId,
          body.userId,
          "unmute",
          body.reason || "manual_unmute",
          new Date().toISOString()
        )
        .run();
      ctx.waitUntil(
        writeAuditEvent(env, {
          projectId: adminAuth.projectId,
          actorUserId: adminAuth.userId,
          actorRoles: adminAuth.roles,
          action: "admin.unmute",
          targetType: "user",
          targetId: body.userId,
          traceId,
          metadata: { roomId: body.roomId, reason: body.reason || null },
        }).catch(() => {})
      );
      return json({ ok: true });
    }
  }

  if (url.pathname === "/admin/unban" && request.method === "POST") {
    if (requireAdminAuth) {
      const adminAuth = await verifyJwtAndGetContext(request, env).catch((err) => {
        if (err instanceof Response) throw err;
        console.error("JWT verify error", err);
        return null;
      });
      if (!adminAuth) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      if (!hasAnyRole(adminAuth.roles, ["owner", "admin", "moderator"])) {
        return json({ error: "forbidden" }, { status: 403 });
      }
      const body = await request.json().catch(() => null);
      if (!body || !body.roomId || !body.userId) {
        return json({ error: "roomId and userId required" }, { status: 400 });
      }
      await env.DB.prepare(
        "INSERT INTO moderation_events (project_id, room_id, user_id, action, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
        .bind(
          projectId,
          body.roomId,
          body.userId,
          "unban",
          body.reason || "manual_unban",
          new Date().toISOString()
        )
        .run();
      ctx.waitUntil(
        writeAuditEvent(env, {
          projectId: adminAuth.projectId,
          actorUserId: adminAuth.userId,
          actorRoles: adminAuth.roles,
          action: "admin.unban",
          targetType: "user",
          targetId: body.userId,
          traceId,
          metadata: { roomId: body.roomId, reason: body.reason || null },
        }).catch(() => {})
      );
      return json({ ok: true });
    }
  }

  if (url.pathname === "/admin/announcement" && request.method === "POST") {
    if (requireAdminAuth) {
      const adminAuth = await verifyJwtAndGetContext(request, env).catch((err) => {
        if (err instanceof Response) throw err;
        console.error("JWT verify error", err);
        return null;
      });
      if (!adminAuth) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      if (!hasAnyRole(adminAuth.roles, ["owner", "admin", "moderator"])) {
        return json({ error: "forbidden" }, { status: 403 });
      }
      const body = await request.json().catch(() => null);
      if (!body || !body.roomId || !body.content) {
        return json({ error: "roomId and content required" }, { status: 400 });
      }
      const id = env.ROOM.idFromName(body.roomId);
      const stub = env.ROOM.get(id);
      await stub.fetch("https://internal/announce", {
        method: "POST",
        body: JSON.stringify({
          content: body.content,
          userId: body.userId || "system",
        }),
      });
      ctx.waitUntil(
        writeAuditEvent(env, {
          projectId: adminAuth.projectId,
          actorUserId: adminAuth.userId,
          actorRoles: adminAuth.roles,
          action: "admin.announcement",
          targetType: "room",
          targetId: body.roomId,
          traceId,
          metadata: { contentLength: String(body.content).length },
        }).catch(() => {})
      );
      return json({ ok: true });
    }
  }

  if (url.pathname === "/automation/trigger" && request.method === "POST") {
    // Require authentication — this endpoint writes to the DB and can trigger AI summaries.
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const body = await request.json().catch(() => null);
    if (!body || !body.eventType) {
      return json({ error: "eventType required" }, { status: 400 });
    }
    const createdAt = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO automation_events (project_id, event_type, room_id, payload, created_at) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(
        auth.projectId,
        body.eventType,
        body.roomId || null,
        JSON.stringify(body.payload || {}),
        createdAt
      )
      .run();

    if (env.AUTOMATION_WEBHOOK_URL) {
      ctx.waitUntil(
        fetch(env.AUTOMATION_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType: body.eventType,
            roomId: body.roomId,
            payload: body.payload || {},
            createdAt,
          }),
        }).catch(() => {})
      );
    }

    if (body.eventType === "room_summary" && body.roomId && env.AI_BASE_URL) {
      ctx.waitUntil(
        generateRoomSummaryAndAnnounce(env, auth.projectId, body.roomId).catch(
          (err) => console.error("AI summary error", err)
        )
      );
    }

    return json({ ok: true });
  }

  return null;
}
