/**
 * Split from worker fetch handler (original lines 3197-3627).
 * @returns {Promise<Response|null>}
 */
import {
  mapMemberRow,
  normalizeMemberPreferencesPatch,
  parseMemberPreferencesJson,
} from "../lib/member-preferences.js";
import { pickRouteDeps } from "./route-http-deps.js";

export async function dispatchRoomsMutationsRoutes(request, url, h) {
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
    projectId,
    isValidId,
    validateRoles,
    validateRoomName,
    canAccessRoom,
    canBypassRoomMembership,
    invalidateCache,
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
    "projectId",
    "isValidId",
    "validateRoles",
    "validateRoomName",
    "canAccessRoom",
    "canBypassRoomMembership",
    "invalidateCache",
    "canCreateTenantProjects",
    "tenantScopeForbidden",
    "writeAuditEvent",
  ]);


  if (url.pathname === "/rooms" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const body = await request.json().catch(() => null);
    const nameValidation = validateRoomName(body?.name);
    if (!nameValidation.valid) {
      return json({ error: nameValidation.error }, { status: 400 });
    }
    const validRoomTypes = ["dm", "group", "public"];
    if (!validRoomTypes.includes(body?.type)) {
      return json(
        { error: `type must be one of: ${validRoomTypes.join(", ")}` },
        { status: 400 }
      );
    }
    const now = new Date().toISOString();
    const newRoomId = body.id && isValidId(body.id) ? body.id : crypto.randomUUID();
    try {
      await env.DB.prepare(
        "INSERT INTO rooms (id, project_id, type, name, created_at) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(newRoomId, auth.projectId, body.type, nameValidation.name, now)
        .run();
    } catch (dbErr) {
      const msg = String(dbErr?.message || dbErr || "");
      if (msg.includes("UNIQUE") || msg.toLowerCase().includes("primary key")) {
        return json({ error: "room_id_already_exists" }, { status: 409 });
      }
      logError("room.create_insert_failed", dbErr, requestLogCtx);
      return json({ error: "room_create_failed" }, { status: 500 });
    }

    ctx.waitUntil(invalidateCache(env, `rooms:${auth.projectId}`).catch(() => {}));

    const members = Array.isArray(body.members) ? body.members.slice() : [];
    // Validate member userIds
    const validMembers = members.filter((m) => m && isValidId(m.userId));
    if (!validMembers.some((m) => m.userId === auth.userId)) {
      validMembers.push({ userId: auth.userId, role: "owner" });
    }
    if (validMembers.length) {
      const rolesValidation = validMembers.map((m) => {
        const roleCheck = validateRoles([m.role]);
        return { ...m, role: roleCheck.roles[0] };
      });
      const stmts = rolesValidation.map((m) =>
        env.DB.prepare(
          "INSERT INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)"
        ).bind(newRoomId, m.userId, m.role, now)
      );
      await env.DB.batch(stmts);
    }

    ctx.waitUntil(
      writeAuditEvent(env, {
        projectId: auth.projectId,
        action: "room.create",
        actorUserId: auth.userId,
        targetType: "room",
        targetId: newRoomId,
        traceId,
        metadata: { name: nameValidation.name, type: body.type },
      }).catch(() => {})
    );

    return json({
      room: {
        id: newRoomId,
        type: body.type,
        name: nameValidation.name,
        created_at: now,
      },
    });
  }

  if (url.pathname === "/rooms/dm" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const body = await request.json().catch(() => null);
    const { a, b } = body || {};
    if (!a || !b) {
      return json({ error: "a and b user ids required" }, { status: 400 });
    }
    if (auth.userId !== a && auth.userId !== b && !canBypassRoomMembership(auth.roles)) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const pairKey = [a, b].sort().join(":");
    const existing = await env.DB.prepare(
      "SELECT id, type, name, created_at FROM rooms WHERE project_id = ? AND type = 'dm' AND name = ? LIMIT 1"
    )
      .bind(auth.projectId, pairKey)
      .first();
    if (existing) return json({ room: existing });

    const now = new Date().toISOString();
    const newRoomId = crypto.randomUUID();

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO rooms (id, project_id, type, name, created_at) VALUES (?, ?, 'dm', ?, ?)"
      ).bind(newRoomId, auth.projectId, pairKey, now),
      env.DB.prepare(
        "INSERT INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)"
      ).bind(newRoomId, a, now),
      env.DB.prepare(
        "INSERT INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)"
      ).bind(newRoomId, b, now),
    ]);

    ctx.waitUntil(
      Promise.all([
        invalidateCache(env, `rooms:${auth.projectId}`),
        writeAuditEvent(env, {
          projectId: auth.projectId,
          action: "room.create_dm",
          actorUserId: auth.userId,
          targetType: "room",
          targetId: newRoomId,
          traceId,
          metadata: { participants: [a, b] },
        }),
      ]).catch(() => {})
    );

    return json({
      room: { id: newRoomId, type: "dm", name: pairKey, created_at: now },
    });
  }

  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/unread") &&
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
    const parts = url.pathname.split("/");
    const unreadRoomId = parts[2];
    const canAccess = await canAccessRoom(env, auth, unreadRoomId);
    if (!canAccess) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const userIdForUnread = auth.userId;
    const lastRow = await env.DB.prepare(
      "SELECT MAX(message_id) as lastRead FROM read_receipts WHERE project_id = ? AND room_id = ? AND user_id = ?"
    )
      .bind(auth.projectId, unreadRoomId, userIdForUnread)
      .first();
    const lastRead = lastRow?.lastRead ?? 0;
    const cntRow = await env.DB.prepare(
      "SELECT COUNT(*) as c FROM messages WHERE project_id = ? AND room_id = ? AND id > ? AND deleted_at IS NULL"
    )
      .bind(auth.projectId, unreadRoomId, lastRead)
      .first();
    return json({ unreadCount: cntRow?.c ?? 0 });
  }

  // Read receipts: POST /rooms/:id/read (authenticated)
  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/read") &&
    request.method === "POST"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      console.error("JWT verify error", err);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders,
      });
    }

    const parts = url.pathname.split("/");
    const roomId = parts[2];
    const body = await request.json().catch(() => null);
    if (!body || !body.messageId) {
      return json({ error: "messageId required" }, { status: 400 });
    }

    const { userId, projectId: authProjectId } = auth;
    const now = new Date().toISOString();

    await env.DB.prepare(
      "INSERT OR IGNORE INTO read_receipts (project_id, room_id, user_id, message_id, created_at) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(authProjectId, roomId, userId, body.messageId, now)
      .run();

    return json({ ok: true });
  }

  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/members") &&
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
    const parts = url.pathname.split("/");
    const membersRoomId = parts[2];
    const canAccess = await canAccessRoom(env, auth, membersRoomId);
    if (!canAccess) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const rows = await env.DB.prepare(
      `SELECT user_id, role, joined_at, notify_enabled, preferences_json
       FROM room_members WHERE room_id = ? LIMIT 1000`
    )
      .bind(membersRoomId)
      .all();
    const members = (rows.results || [])
      .map(mapMemberRow)
      .filter(Boolean);
    return json({ members });
  }

  if (
    url.pathname.match(/^\/rooms\/[^/]+\/members\/me\/preferences$/) &&
    request.method === "PATCH"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const parts = url.pathname.split("/");
    const prefRoomId = parts[2];
    const canAccess = await canAccessRoom(env, auth, prefRoomId);
    if (!canAccess) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const patch = normalizeMemberPreferencesPatch(await request.json().catch(() => null));
    if (!patch) {
      return json({ error: "invalid_preferences" }, { status: 400 });
    }
    const existing = await env.DB.prepare(
      `SELECT preferences_json, notify_enabled FROM room_members WHERE room_id = ? AND user_id = ?`
    )
      .bind(prefRoomId, auth.userId)
      .first();
    if (!existing) {
      return json({ error: "not_a_member" }, { status: 404 });
    }
    const notifyEnabled =
      patch.notifyEnabled !== undefined
        ? patch.notifyEnabled
          ? 1
          : 0
        : existing.notify_enabled;
    let preferences = parseMemberPreferencesJson(existing.preferences_json) ?? {};
    if (patch.preferences) {
      preferences = { ...preferences, ...patch.preferences };
    }
    await env.DB.prepare(
      `UPDATE room_members SET notify_enabled = ?, preferences_json = ? WHERE room_id = ? AND user_id = ?`
    )
      .bind(notifyEnabled, JSON.stringify(preferences), prefRoomId, auth.userId)
      .run();
    return json({
      member: {
        userId: auth.userId,
        role: auth.roles?.[0] ?? "member",
        notifyEnabled: notifyEnabled === 1,
        preferences,
      },
    });
  }

  if (
    url.pathname.match(/^\/rooms\/[^/]+\/members$/) &&
    request.method === "POST"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const parts = url.pathname.split("/");
    const roomId = parts[2];
    const body = await request.json().catch(() => null);
    if (!body?.userId) {
      return json({ error: "userId required" }, { status: 400 });
    }
    const roomExists = await env.DB.prepare(
      "SELECT id FROM rooms WHERE id = ? AND project_id = ?"
    ).bind(roomId, auth.projectId).first();
    if (!roomExists) return json({ error: "room not found" }, { status: 404 });
    const role = body.role && ["owner", "admin", "moderator", "member"].includes(body.role) ? body.role : "member";
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)"
    ).bind(roomId, body.userId, role, now).run();
    ctx.waitUntil(
      writeAuditEvent(env, {
        projectId: auth.projectId,
        action: "room.member_add",
        actorUserId: auth.userId,
        targetType: "room_member",
        targetId: body.userId,
        traceId,
        metadata: { roomId, role },
      }).catch(() => {})
    );
    return json({ ok: true, roomId, userId: body.userId, role });
  }

  if (
    url.pathname.match(/^\/rooms\/[^/]+\/members\/[^/]+$/) &&
    request.method === "DELETE"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const parts = url.pathname.split("/");
    const roomId = parts[2];
    const targetUserId = parts[4];
    if (!targetUserId) return json({ error: "user id required" }, { status: 400 });
    const roomInProject = await env.DB.prepare(
      "SELECT id FROM rooms WHERE id = ? AND project_id = ? LIMIT 1",
    )
      .bind(roomId, auth.projectId)
      .first();
    if (!roomInProject) return json({ error: "room not found" }, { status: 404 });
    await env.DB.prepare("DELETE FROM room_members WHERE room_id = ? AND user_id = ?")
      .bind(roomId, targetUserId)
      .run();
    ctx.waitUntil(
      writeAuditEvent(env, {
        projectId: auth.projectId,
        action: "room.member_remove",
        actorUserId: auth.userId,
        targetType: "room_member",
        targetId: targetUserId,
        traceId,
        metadata: { roomId },
      }).catch(() => {})
    );
    return json({ ok: true });
  }

  if (
    url.pathname.match(/^\/rooms\/[^/]+$/) &&
    request.method === "PATCH"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const parts = url.pathname.split("/");
    const roomId = parts[2];
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: "body required" }, { status: 400 });
    const roomExists = await env.DB.prepare(
      "SELECT id FROM rooms WHERE id = ? AND project_id = ?"
    ).bind(roomId, auth.projectId).first();
    if (!roomExists) return json({ error: "room not found" }, { status: 404 });
    const updates = [];
    const values = [];
    if (body.name !== undefined) {
      const nameValidation = validateRoomName(body.name);
      if (!nameValidation.valid) return json({ error: nameValidation.error }, { status: 400 });
      updates.push("name = ?");
      values.push(nameValidation.name);
    }
    if (body.type !== undefined) {
      const validTypes = ["dm", "group", "public"];
      if (!validTypes.includes(body.type)) return json({ error: "invalid type" }, { status: 400 });
      updates.push("type = ?");
      values.push(body.type);
    }
    if (!updates.length) return json({ error: "no fields to update" }, { status: 400 });
    values.push(roomId);
    values.push(auth.projectId);
    const now = new Date().toISOString();
    const updatesWithTs = [...updates, "updated_at = ?"];
    const valuesWithTs = [...values.slice(0, -2), now, roomId, auth.projectId];
    try {
      await env.DB.prepare(
        `UPDATE rooms SET ${updatesWithTs.join(", ")} WHERE id = ? AND project_id = ?`,
      )
        .bind(...valuesWithTs)
        .run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("updated_at")) throw err;
      await env.DB.prepare(
        `UPDATE rooms SET ${updates.join(", ")} WHERE id = ? AND project_id = ?`,
      )
        .bind(...values)
        .run();
    }
    ctx.waitUntil(invalidateCache(env, `rooms:${auth.projectId}`).catch(() => {}));
    return json({ ok: true, roomId });
  }

  if (
    url.pathname.match(/^\/rooms\/[^/]+$/) &&
    request.method === "DELETE"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const parts = url.pathname.split("/");
    const roomId = parts[2];
    if (!roomId) return json({ error: "room id required" }, { status: 400 });
    const roomExists = await env.DB.prepare(
      "SELECT id FROM rooms WHERE id = ? AND project_id = ? LIMIT 1"
    ).bind(roomId, auth.projectId).first();
    if (!roomExists) return json({ error: "room not found" }, { status: 404 });

    const projectId = auth.projectId;
    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM message_reactions WHERE project_id = ? AND room_id = ?"
      ).bind(projectId, roomId),
      env.DB.prepare(
        "DELETE FROM read_receipts WHERE project_id = ? AND room_id = ?"
      ).bind(projectId, roomId),
      env.DB.prepare(
        "DELETE FROM message_mentions WHERE project_id = ? AND room_id = ?"
      ).bind(projectId, roomId),
      env.DB.prepare(
        "DELETE FROM attachments WHERE project_id = ? AND room_id = ?"
      ).bind(projectId, roomId),
      env.DB.prepare(
        "DELETE FROM messages WHERE project_id = ? AND room_id = ?"
      ).bind(projectId, roomId),
      env.DB.prepare(
        "DELETE FROM moderation_events WHERE project_id = ? AND room_id = ?"
      ).bind(projectId, roomId),
      env.DB.prepare(
        "DELETE FROM automation_events WHERE project_id = ? AND room_id = ?"
      ).bind(projectId, roomId),
      env.DB.prepare(
        "DELETE FROM agent_runs WHERE project_id = ? AND room_id = ?"
      ).bind(projectId, roomId),
      env.DB.prepare("DELETE FROM room_members WHERE room_id = ?").bind(roomId),
      env.DB.prepare(
        "DELETE FROM rooms WHERE id = ? AND project_id = ?"
      ).bind(roomId, projectId),
    ]);

    ctx.waitUntil(
      Promise.all([
        invalidateCache(env, `rooms:${auth.projectId}`).catch(() => {}),
        writeAuditEvent(env, {
          projectId: auth.projectId,
          action: "room.delete",
          actorUserId: auth.userId,
          actorRoles: auth.roles,
          targetType: "room",
          targetId: roomId,
          traceId,
          metadata: {},
        }).catch(() => {}),
      ])
    );
    return json({ ok: true, roomId });
  }

  return null;
}
