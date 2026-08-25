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
import { parseCreateRoomBody } from "../lib/http-body.js";
import {
  generateRoomContentKeyMaterial,
  encryptRoomContentKeyForStorage,
  decryptRoomContentKeyFromStorage,
} from "../lib/room-e2e.js";
import {
  addRoomMlsDevice,
  getRoomMlsGroup,
  removeRoomMlsDevice,
  rotateRoomMlsEpoch,
  upsertRoomMlsGroup,
} from "../lib/room-mls.js";
import {
  fetchAggregatedRoomLive,
  normalizeShardCount,
  forEachRoomShard,
  getRoomShardCount,
} from "../lib/room-shard.js";
import { dispatchRoomInfoRoutes } from "./room-info-http.js";

export async function dispatchRoomsMutationsRoutes(request, url, h) {
  const roomInfoRes = await dispatchRoomInfoRoutes(request, url, h);
  if (roomInfoRes) return roomInfoRes;
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
    const rawBody = await request.json().catch(() => null);
    const parsedRoom = parseCreateRoomBody(rawBody);
    if (!parsedRoom.ok) {
      return json({ error: parsedRoom.error }, { status: 400 });
    }
    const body = parsedRoom;
    const nameValidation = validateRoomName(body.name);
    if (!nameValidation.valid) {
      return json({ error: nameValidation.error }, { status: 400 });
    }
    const validRoomTypes = ["dm", "group", "public", "announcement"];
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
        const existing = await env.DB.prepare(
          "SELECT id, project_id, type, name, created_at FROM rooms WHERE id = ? LIMIT 1",
        )
          .bind(newRoomId)
          .first();
        if (existing?.id && String(existing.project_id) === String(auth.projectId)) {
          const members = Array.isArray(body.members) ? body.members.slice() : [];
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
                "INSERT OR IGNORE INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
              ).bind(newRoomId, m.userId, m.role, now),
            );
            await env.DB.batch(stmts);
          }
          return json({
            room: {
              id: existing.id,
              type: existing.type,
              name: existing.name,
              created_at: existing.created_at,
            },
          });
        }
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
    const { findOrCreateDmRoom } = await import("../lib/dm-rooms.js");
    const result = await findOrCreateDmRoom(env, {
      projectId: auth.projectId,
      userA: a,
      userB: b,
    });
    if (!result.ok) {
      const status = result.error === "user_blocked" ? 403 : 400;
      return json({ error: result.error }, { status });
    }
    if (!result.created) return json({ room: result.room });

    const newRoomId = result.room.id;
    const now = result.room.createdAt;

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
      room: { id: newRoomId, type: "dm", name: result.room.name, created_at: now },
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
    const { getRoomCatchUpForUser } = await import("../lib/room-catch-up.js");
    const catchUp = await getRoomCatchUpForUser(env.DB, {
      projectId: auth.projectId,
      roomId: unreadRoomId,
      userId: auth.userId,
    });
    return json(catchUp);
  }

  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/catch-up/digest") &&
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
    const digestRoomId = parts[2];
    const canAccess = await canAccessRoom(env, auth, digestRoomId);
    if (!canAccess) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const { getSmartCatchUpDigest } = await import("../lib/smart-catch-up-digest.js");
    const digest = await getSmartCatchUpDigest(env, {
      projectId: auth.projectId,
      roomId: digestRoomId,
      userId: auth.userId,
      logContext: requestLogCtx,
    });
    return json(digest);
  }

  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/sentiment") &&
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
    const sentimentRoomId = parts[2];
    const canAccess = await canAccessRoom(env, auth, sentimentRoomId);
    if (!canAccess) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const days = Number(url.searchParams.get("days") || 7);
    try {
      const { getRoomSentimentTimeline } = await import("../lib/room-sentiment.js");
      const data = await getRoomSentimentTimeline(env, {
        projectId: auth.projectId,
        roomId: sentimentRoomId,
        days,
      });
      return json(data);
    } catch (err) {
      logError("room.sentiment_failed", err, requestLogCtx);
      return json({
        ok: true,
        roomId: sentimentRoomId,
        days,
        aggregate: { mood: "neutral", score: 0, positive: 0, negative: 0, neutral: 0, total: 0 },
        timeline: [],
      });
    }
  }

  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/draft") &&
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
    const draftRoomId = parts[2];
    const canAccess = await canAccessRoom(env, auth, draftRoomId);
    if (!canAccess) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const row = await env.DB.prepare(
      `SELECT preferences_json FROM room_members WHERE room_id = ? AND user_id = ?`,
    )
      .bind(draftRoomId, auth.userId)
      .first();
    if (!row) {
      return json({ error: "not_a_member" }, { status: 404 });
    }
    const { parseMemberPreferencesJson } = await import("../lib/member-preferences.js");
    const { readMessageDraftFromPreferences } = await import("../lib/room-draft.js");
    const preferences = parseMemberPreferencesJson(row.preferences_json) ?? {};
    const draft = readMessageDraftFromPreferences(preferences);
    return json({ draft });
  }

  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/draft") &&
    request.method === "PUT"
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
    const draftRoomId = parts[2];
    const canAccess = await canAccessRoom(env, auth, draftRoomId);
    if (!canAccess) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body.content !== "string") {
      return json({ error: "content required" }, { status: 400 });
    }
    const { validateDraftContent, writeMessageDraftToPreferences } = await import(
      "../lib/room-draft.js"
    );
    const validation = validateDraftContent(body.content);
    if (!validation.valid) {
      return json({ error: validation.error }, { status: 400 });
    }
    let replyToId = null;
    if (body.replyToId != null && body.replyToId !== "") {
      replyToId = Number(body.replyToId);
      if (!Number.isFinite(replyToId) || replyToId < 1) {
        return json({ error: "invalid replyToId" }, { status: 400 });
      }
    }
    const existing = await env.DB.prepare(
      `SELECT preferences_json, notify_enabled FROM room_members WHERE room_id = ? AND user_id = ?`,
    )
      .bind(draftRoomId, auth.userId)
      .first();
    if (!existing) {
      return json({ error: "not_a_member" }, { status: 404 });
    }
    const { parseMemberPreferencesJson } = await import("../lib/member-preferences.js");
    let preferences = parseMemberPreferencesJson(existing.preferences_json) ?? {};
    preferences = writeMessageDraftToPreferences(preferences, {
      content: validation.content,
      replyToId,
    });
    await env.DB.prepare(
      `UPDATE room_members SET preferences_json = ? WHERE room_id = ? AND user_id = ?`,
    )
      .bind(JSON.stringify(preferences), draftRoomId, auth.userId)
      .run();
    const { readMessageDraftFromPreferences } = await import("../lib/room-draft.js");
    return json({ draft: readMessageDraftFromPreferences(preferences) });
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

    const { notifyInboxUpdated } = await import("../lib/user-inbox-push.js");
    void notifyInboxUpdated(env, {
      projectId: authProjectId,
      userId,
      roomId,
      kind: "unread",
      messageId: body.messageId,
      unreadCount: 0,
    }).catch(() => {});

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

    let e2eRewrapped = false;
    if (body.rewrapE2eKey === true || body.rewrapE2eKey === 1 || body.rewrapE2eKey === "true") {
      const roomRow = await env.DB.prepare(
        "SELECT e2e_enabled FROM rooms WHERE id = ? AND project_id = ?",
      )
        .bind(roomId, auth.projectId)
        .first();
      if (roomRow?.e2e_enabled) {
        const keyMaterial = generateRoomContentKeyMaterial();
        const enc = await encryptRoomContentKeyForStorage(env, keyMaterial);
        if (enc) {
          await env.DB.prepare(
            "UPDATE rooms SET e2e_key_ciphertext = ?, e2e_key_iv = ?, updated_at = ? WHERE id = ? AND project_id = ?",
          )
            .bind(enc.ciphertext, enc.iv, now, roomId, auth.projectId)
            .run();
          e2eRewrapped = true;
          ctx.waitUntil(
            writeAuditEvent(env, {
              projectId: auth.projectId,
              action: "room.e2e_key_rotated",
              actorUserId: auth.userId,
              targetType: "room",
              targetId: roomId,
              traceId,
              metadata: { roomId, reason: "member_join_rewrap", newMemberId: body.userId },
            }).catch(() => {}),
          );
        }
      }
    }

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
    return json({ ok: true, roomId, userId: body.userId, role, e2eRewrapped });
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
    url.pathname.match(/^\/rooms\/[^/]+\/e2e-key$/) &&
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
    const roomId = url.pathname.split("/")[2];
    const canAccess = await canAccessRoom(env, auth, roomId);
    if (!canAccess) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const row = await env.DB.prepare(
      `SELECT e2e_enabled, e2e_key_ciphertext, e2e_key_iv
       FROM rooms WHERE id = ? AND project_id = ? LIMIT 1`,
    )
      .bind(roomId, auth.projectId)
      .first();
    if (!row) return json({ error: "room not found" }, { status: 404 });
    if (!row.e2e_enabled) {
      return json({ e2eEnabled: false, roomId });
    }
    const e2eKey = await decryptRoomContentKeyFromStorage(
      env,
      row.e2e_key_ciphertext,
      row.e2e_key_iv,
    );
    if (!e2eKey) {
      return json({ error: "e2e_key_unavailable" }, { status: 503 });
    }
    return json({ e2eEnabled: true, roomId, e2eKey });
  }

  const mlsGroupMatch = url.pathname.match(/^\/rooms\/([^/]+)\/mls-group$/);
  if (mlsGroupMatch && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const roomId = decodeURIComponent(mlsGroupMatch[1]);
    const canAccess = await canAccessRoom(env, auth, roomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });
    const result = await getRoomMlsGroup(env, auth, roomId);
    return json(result);
  }

  if (mlsGroupMatch && request.method === "PUT") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const roomId = decodeURIComponent(mlsGroupMatch[1]);
    const body = await request.json().catch(() => ({}));
    const result = await upsertRoomMlsGroup(env, auth, roomId, body);
    return json(result);
  }

  const mlsDeviceMatch = url.pathname.match(/^\/rooms\/([^/]+)\/mls-group\/devices$/);
  if (mlsDeviceMatch && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const roomId = decodeURIComponent(mlsDeviceMatch[1]);
    const canAccess = await canAccessRoom(env, auth, roomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });
    const body = await request.json().catch(() => null);
    const result = await addRoomMlsDevice(env, auth, roomId, body ?? {});
    if (!result.ok) {
      const status = result.error === "max_devices_exceeded" ? 409 : 400;
      return json(result, { status });
    }
    return json(result);
  }

  const mlsDeviceRemoveMatch = url.pathname.match(/^\/rooms\/([^/]+)\/mls-group\/devices\/([^/]+)$/);
  if (mlsDeviceRemoveMatch && request.method === "DELETE") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const roomId = decodeURIComponent(mlsDeviceRemoveMatch[1]);
    const deviceId = decodeURIComponent(mlsDeviceRemoveMatch[2]);
    const result = await removeRoomMlsDevice(env, auth, roomId, deviceId);
    if (!result.ok) return json(result, { status: 404 });
    return json(result);
  }

  const mlsRotateMatch = url.pathname.match(/^\/rooms\/([^/]+)\/mls-group\/rotate$/);
  if (mlsRotateMatch && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const roomId = decodeURIComponent(mlsRotateMatch[1]);
    const result = await rotateRoomMlsEpoch(env, auth, roomId);
    if (!result.ok) return json(result, { status: 404 });
    ctx.waitUntil(
      writeAuditEvent(env, {
        projectId: auth.projectId,
        action: "room.mls_epoch_rotated",
        actorUserId: auth.userId,
        targetType: "room",
        targetId: roomId,
        traceId,
        metadata: { epoch: result.group?.epoch },
      }).catch(() => {}),
    );
    return json(result);
  }

  if (
    url.pathname.match(/^\/rooms\/[^/]+$/) &&
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
    const roomId = decodeURIComponent(url.pathname.split("/")[2] || "");
    const canAccess = await canAccessRoom(env, auth, roomId);
    if (!canAccess) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    let room;
    try {
      room = await env.DB.prepare(
        `SELECT id, type, name, created_at, pinned_message_id, pinned_at, pinned_by_user_id,
                project_goal, project_budget, project_timeline_start, project_timeline_end, project_status
         FROM rooms WHERE id = ? AND project_id = ? LIMIT 1`,
      )
        .bind(roomId, auth.projectId)
        .first();
    } catch {
      room = await env.DB.prepare(
        `SELECT id, type, name, created_at FROM rooms WHERE id = ? AND project_id = ? LIMIT 1`,
      )
        .bind(roomId, auth.projectId)
        .first();
    }
    if (!room) return json({ error: "room not found" }, { status: 404 });
    return json({ room });
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
      "SELECT id, e2e_enabled, e2e_key_ciphertext, e2e_key_iv FROM rooms WHERE id = ? AND project_id = ?"
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
    if (body.shardCount !== undefined) {
      updates.push("shard_count = ?");
      values.push(normalizeShardCount(body.shardCount));
    }
    if (body.rotateE2eKey === true || body.rotateE2eKey === 1 || body.rotateE2eKey === "true") {
      if (!roomExists.e2e_enabled) {
        return json({ error: "e2e_not_enabled" }, { status: 400 });
      }
      const keyMaterial = generateRoomContentKeyMaterial();
      const enc = await encryptRoomContentKeyForStorage(env, keyMaterial);
      if (!enc) {
        return json({ error: "e2e_encryption_key_not_configured" }, { status: 503 });
      }
      updates.push("e2e_key_ciphertext = ?", "e2e_key_iv = ?");
      values.push(enc.ciphertext, enc.iv);
    }
    if (body.e2eEnabled !== undefined) {
      const enable = body.e2eEnabled === true || body.e2eEnabled === 1 || body.e2eEnabled === "true";
      if (enable) {
        let keyMaterial = null;
        if (roomExists.e2e_key_ciphertext && roomExists.e2e_key_iv) {
          keyMaterial = await decryptRoomContentKeyFromStorage(
            env,
            roomExists.e2e_key_ciphertext,
            roomExists.e2e_key_iv,
          );
        }
        if (!keyMaterial) {
          keyMaterial = generateRoomContentKeyMaterial();
          const enc = await encryptRoomContentKeyForStorage(env, keyMaterial);
          if (!enc) {
            return json({ error: "e2e_encryption_key_not_configured" }, { status: 503 });
          }
          updates.push("e2e_key_ciphertext = ?", "e2e_key_iv = ?");
          values.push(enc.ciphertext, enc.iv);
        }
        updates.push("e2e_enabled = ?");
        values.push(1);
      } else {
        updates.push("e2e_enabled = ?", "e2e_key_ciphertext = ?", "e2e_key_iv = ?");
        values.push(0, null, null);
      }
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
    if (body.rotateE2eKey === true || body.rotateE2eKey === 1 || body.rotateE2eKey === "true") {
      ctx.waitUntil(
        writeAuditEvent(env, {
          projectId: auth.projectId,
          action: "room.e2e_key_rotated",
          actorUserId: auth.userId,
          targetType: "room",
          targetId: roomId,
          traceId,
          metadata: { roomId },
        }).catch(() => {}),
      );
    }
    if (body.e2eEnabled !== undefined) {
      ctx.waitUntil(
        writeAuditEvent(env, {
          projectId: auth.projectId,
          action: body.e2eEnabled ? "room.e2e_enabled" : "room.e2e_disabled",
          actorUserId: auth.userId,
          targetType: "room",
          targetId: roomId,
          traceId,
          metadata: { roomId },
        }).catch(() => {}),
      );
    }
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

  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/health") &&
    request.method === "GET"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const healthRoomId = url.pathname.split("/")[2];
    const canAccess = await canAccessRoom(env, auth, healthRoomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });

    const { computeRoomHealthScore } = await import("../lib/room-health.js");
    const health = await computeRoomHealthScore(env.DB, {
      projectId: auth.projectId,
      roomId: healthRoomId,
    });

    let live = { online: null, users: [] };
    try {
      const stub = env.ROOM.get(env.ROOM.idFromName(healthRoomId));
      const liveRes = await stub.fetch("https://internal/live-stats");
      if (liveRes.ok) live = await liveRes.json();
    } catch {
      /* DO may be cold */
    }

    return json({ health: { ...health, live } });
  }

  // F1: live marginal cost for a room. Reads the DO's own metered counters
  // (WS frames, handler duration, alarms) priced against Cloudflare list
  // rates. Any room member can read it — cost transparency is the product.
  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/cost") &&
    request.method === "GET"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const costRoomId = url.pathname.split("/")[2];
    const canAccess = await canAccessRoom(env, auth, costRoomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });

    let live = null;
    try {
      const stub = env.ROOM.get(env.ROOM.idFromName(costRoomId));
      const costRes = await stub.fetch("https://internal/cost");
      if (costRes.ok) live = await costRes.json();
    } catch {
      /* DO may be cold: no ledger yet */
    }

    return json({
      ok: true,
      roomId: costRoomId,
      projectId: auth.projectId,
      // Cold room => honest zero rather than an invented estimate.
      cost:
        live ?? {
          usage: {
            wsFramesIn: 0,
            wsFramesOut: 0,
            doRequests: 0,
            alarms: 0,
            billableRequests: 0,
            handlerDurationMs: 0,
            gbSeconds: 0,
          },
          estimatedUsd: {
            requests: 0,
            duration: 0,
            total: 0,
            withinIncludedAllowance: true,
          },
          pricingVersion: "cf-2026-08",
        },
    });
  }

  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/agent-runs") &&
    request.method === "GET"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const runsRoomId = url.pathname.split("/")[2];
    const canAccess = await canAccessRoom(env, auth, runsRoomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 20), 1), 100);
    const rows = await env.DB.prepare(
      `SELECT id, agent_id, status, latency_ms, input_tokens, output_tokens, estimated_cost, error, iterations, tool_calls_json, created_at
       FROM agent_runs
       WHERE project_id = ? AND room_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    )
      .bind(auth.projectId, runsRoomId, limit)
      .all();
    const runs = (rows.results || []).map((row) => {
      let toolCalls = [];
      if (row.tool_calls_json) {
        try {
          toolCalls = JSON.parse(row.tool_calls_json);
        } catch {
          toolCalls = [];
        }
      }
      return {
        id: row.id,
        agentId: row.agent_id,
        status: row.status,
        latencyMs: row.latency_ms,
        inputTokens: row.input_tokens || 0,
        outputTokens: row.output_tokens || 0,
        estimatedCost: row.estimated_cost || 0,
        error: row.error,
        iterations: row.iterations,
        toolCalls,
        createdAt: row.created_at,
      };
    });
    return json({ ok: true, roomId: runsRoomId, runs });
  }

  // F2: per-room agent token budget — read current config + live usage.
  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/agent-budget") &&
    request.method === "GET"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const budgetRoomId = url.pathname.split("/")[2];
    const canAccess = await canAccessRoom(env, auth, budgetRoomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });

    const { getRoomAgentBudget, getRoomMonthlyTokenUsage } = await import(
      "../lib/agent-budget.js"
    );
    const config = await getRoomAgentBudget(env, auth.projectId, budgetRoomId);
    const monthKey = new Date().toISOString().slice(0, 7);
    const usedTokens = await getRoomMonthlyTokenUsage(
      env,
      auth.projectId,
      budgetRoomId,
      monthKey,
    );

    return json({
      ok: true,
      roomId: budgetRoomId,
      monthKey,
      monthlyTokenBudget: config?.monthly_token_budget ?? null,
      enabled: Boolean(config?.enabled),
      usedTokens,
      // Remaining is null when no cap is configured (uncapped).
      remainingTokens:
        config?.monthly_token_budget != null
          ? Math.max(0, Number(config.monthly_token_budget) - usedTokens)
          : null,
    });
  }

  // F2: set/update the room's agent budget (admin only).
  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/agent-budget") &&
    request.method === "PUT"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const roles = auth.roles ?? [];
    if (!roles.includes("admin") && !roles.includes("owner")) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const budgetRoomId = url.pathname.split("/")[2];
    const canAccess = await canAccessRoom(env, auth, budgetRoomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    if (
      body.monthlyTokenBudget != null &&
      !Number.isFinite(Number(body.monthlyTokenBudget))
    ) {
      return json({ error: "monthlyTokenBudget must be a number" }, { status: 400 });
    }

    const { setRoomAgentBudget } = await import("../lib/agent-budget.js");
    const saved = await setRoomAgentBudget(env, auth.projectId, budgetRoomId, {
      monthlyTokenBudget: body.monthlyTokenBudget ?? null,
      enabled: body.enabled !== false,
    });
    return json({ ok: true, ...saved });
  }

  // F4: signed conversation attestation — export chain range + signature that
  // any third party can verify offline with the SDK verifier.
  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/attestation") &&
    request.method === "GET"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const attRoomId = url.pathname.split("/")[2];
    const canAccess = await canAccessRoom(env, auth, attRoomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });

    const limitRaw = Number(url.searchParams.get("limit") || "500");
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 500, 1), 5000);

    const { exportRoomAuditChain } = await import("../lib/audit-chain.js");
    const exported = await exportRoomAuditChain(env, {
      projectId: auth.projectId,
      limit,
    });

    const entries = (exported.entries || []).filter(
      // Chain rows are per project; roomId lives inside event payloads.
      () => true,
    );

    const { createConversationAttestation } = await import(
      "../lib/conversation-attestation.js"
    );
    const signed = await createConversationAttestation(env, {
      projectId: auth.projectId,
      roomId: attRoomId,
      entries,
    });

    if (!signed.ok) {
      return json({ error: signed.reason }, { status: 503 });
    }

    return json({
      ok: true,
      roomId: attRoomId,
      attestation: signed.attestation,
      // Raw entries are what the third party feeds to verifyAttestation().
      entries: entries.map((e) => ({
        id: e.id,
        prevHash: e.prevHash,
        eventHash: e.eventHash,
        createdAt: e.createdAt,
      })),
    });
  }

  // F5: room-as-database — read-only SQL over this room's SQLite. Any member
  // may query; the DO-side validator is the security boundary (SELECT-only,
  // single statement, keyword denylist, hard row cap).
  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/query") &&
    request.method === "POST"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const queryRoomId = url.pathname.split("/")[2];
    const canAccess = await canAccessRoom(env, auth, queryRoomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    if (typeof body.sql !== "string") {
      return json({ error: "sql_required" }, { status: 400 });
    }

    try {
      const stub = env.ROOM.get(env.ROOM.idFromName(queryRoomId));
      const sqlRes = await stub.fetch("https://internal/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: body.sql, maxRows: body.maxRows }),
      });
      const payload = await sqlRes.json().catch(() => ({ ok: false, reason: "bad_do_response" }));
      return json(payload, { status: sqlRes.status });
    } catch {
      return json({ ok: false, reason: "room_unavailable" }, { status: 503 });
    }
  }

  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/pitr") &&
    (request.method === "GET" || request.method === "POST")
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const pitrRoomId = url.pathname.split("/")[2];
    const canAccess = await canAccessRoom(env, auth, pitrRoomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });
    if (request.method === "POST" && !hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    try {
      const stub = env.ROOM.get(env.ROOM.idFromName(pitrRoomId));
      const pitrRes = await stub.fetch("https://internal/pitr", {
        method: request.method,
        headers: { "Content-Type": "application/json" },
        body: request.method === "POST"
          ? JSON.stringify({ ...body, actorUserId: auth.userId })
          : undefined,
      });
      const payload = await pitrRes.json().catch(() => ({ ok: false, reason: "bad_do_response" }));
      return json(payload, { status: pitrRes.status });
    } catch {
      return json({ ok: false, reason: "room_unavailable" }, { status: 503 });
    }
  }

  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/live") &&
    request.method === "GET"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const liveRoomId = url.pathname.split("/")[2];
    const canAccess = await canAccessRoom(env, auth, liveRoomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });
    const live = await fetchAggregatedRoomLive(env, auth.projectId, liveRoomId);
    return json(live);
  }

  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/pin") &&
    request.method === "PATCH"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const pinRoomId = url.pathname.split("/")[2];
    const canAccess = await canAccessRoom(env, auth, pinRoomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: "body required" }, { status: 400 });

    const now = new Date().toISOString();
    let pinnedMessageId = null;
    if (body.messageId !== null && body.messageId !== undefined && body.messageId !== "") {
      pinnedMessageId = Number(body.messageId);
      if (!Number.isFinite(pinnedMessageId) || pinnedMessageId <= 0) {
        return json({ error: "invalid messageId" }, { status: 400 });
      }
      const msg = await env.DB.prepare(
        "SELECT id FROM messages WHERE id = ? AND project_id = ? AND room_id = ? AND deleted_at IS NULL LIMIT 1",
      )
        .bind(pinnedMessageId, auth.projectId, pinRoomId)
        .first();
      if (!msg) return json({ error: "message not found" }, { status: 404 });
    }

    await env.DB.prepare(
      `UPDATE rooms SET pinned_message_id = ?, pinned_at = ?, pinned_by_user_id = ?
       WHERE id = ? AND project_id = ?`,
    )
      .bind(
        pinnedMessageId,
        pinnedMessageId ? now : null,
        pinnedMessageId ? auth.userId : null,
        pinRoomId,
        auth.projectId,
      )
      .run();

    const announce = {
      type: "message_pinned",
      roomId: pinRoomId,
      messageId: pinnedMessageId,
      pinnedBy: auth.userId,
      pinnedAt: pinnedMessageId ? now : null,
    };
    try {
      const stub = env.ROOM.get(env.ROOM.idFromName(pinRoomId));
      await stub.fetch("https://internal/announce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(announce),
      });
    } catch {
      /* best effort */
    }

    return json({ ok: true, roomId: pinRoomId, pinnedMessageId });
  }

  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/terminate-connection") &&
    request.method === "POST"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const termRoomId = url.pathname.split("/")[2];
    const canAccess = await canAccessRoom(env, auth, termRoomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });

    const body = await request.json().catch(() => null);
    const socketId =
      typeof body?.socketId === "string"
        ? body.socketId
        : typeof body?.socket_id === "string"
          ? body.socket_id
          : "";
    if (!socketId) return json({ error: "socketId required" }, { status: 400 });

    const shardCount = await getRoomShardCount(env, auth.projectId, termRoomId);
    const shardResults = await forEachRoomShard(env, termRoomId, shardCount, async (stub) => {
      const res = await stub.fetch("https://internal/terminate-socket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socketId,
          reason: body.reason || "terminated_by_moderator",
        }),
      });
      return res.json().catch(() => ({}));
    });
    const closed = shardResults.some((r) => r && typeof r === "object" && r.closed);
    return json({ ok: true, closed, socketId });
  }

  if (
    url.pathname.startsWith("/rooms/") &&
    url.pathname.endsWith("/compliance-export") &&
    request.method === "GET"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    const exportRoomId = url.pathname.split("/")[2];
    const canAccess = await canAccessRoom(env, auth, exportRoomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });

    const { messageVisibilitySql } = await import("../lib/message-visibility.js");
    const vis = messageVisibilitySql(auth.userId);
    const [messages, receipts, moderation, audit] = await Promise.all([
      env.DB.prepare(
        `SELECT id, user_id, content, created_at, parent_id, deleted_at, expires_at, visibility
         FROM messages WHERE project_id = ? AND room_id = ?${vis.sql}
         ORDER BY created_at ASC LIMIT 5000`,
      )
        .bind(auth.projectId, exportRoomId, ...vis.binds)
        .all(),
      env.DB.prepare(
        `SELECT user_id, message_id, created_at FROM read_receipts
         WHERE project_id = ? AND room_id = ? ORDER BY created_at ASC LIMIT 5000`,
      )
        .bind(auth.projectId, exportRoomId)
        .all(),
      env.DB.prepare(
        `SELECT user_id, action, reason, created_at FROM moderation_events
         WHERE project_id = ? AND room_id = ? ORDER BY created_at ASC LIMIT 2000`,
      )
        .bind(auth.projectId, exportRoomId)
        .all(),
      env.DB.prepare(
        `SELECT action, actor_user_id, target_type, target_id, created_at
         FROM operational_audit_events
         WHERE project_id = ? AND (target_id = ? OR metadata LIKE ?)
         ORDER BY created_at DESC LIMIT 500`,
      )
        .bind(auth.projectId, exportRoomId, `%${exportRoomId}%`)
        .all(),
    ]);

    return json({
      exportedAt: new Date().toISOString(),
      roomId: exportRoomId,
      projectId: auth.projectId,
      pack: {
        messages: messages.results || [],
        readReceipts: receipts.results || [],
        moderationEvents: moderation.results || [],
        auditEvents: audit.results || [],
      },
    });
  }

  if (
    url.pathname.match(/^\/rooms\/[^/]+\/scheduled-messages$/) &&
    request.method === "GET"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const schedRoomId = url.pathname.split("/")[2];
    const canAccess = await canAccessRoom(env, auth, schedRoomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });
    const rows = await env.DB.prepare(
      `SELECT id, user_id, content, send_at, status, parent_id, created_at, sent_message_id
       FROM scheduled_messages
       WHERE project_id = ? AND room_id = ? AND status = 'pending'
       ORDER BY send_at ASC LIMIT 100`,
    )
      .bind(auth.projectId, schedRoomId)
      .all();
    return json({ scheduled: rows.results || [] });
  }

  if (
    url.pathname.match(/^\/rooms\/[^/]+\/scheduled-messages$/) &&
    request.method === "POST"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const schedRoomId = url.pathname.split("/")[2];
    const canAccess = await canAccessRoom(env, auth, schedRoomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });
    const body = await request.json().catch(() => null);
    const { validateMessageContent } = await import("../lib/message-validation.js");
    const contentValidation = validateMessageContent(body?.content ?? "");
    if (!contentValidation.valid) {
      return json({ error: contentValidation.error }, { status: 400 });
    }
    const sendAt = body?.sendAt ? String(body.sendAt) : "";
    if (!sendAt || Number.isNaN(Date.parse(sendAt))) {
      return json({ error: "sendAt ISO timestamp required" }, { status: 400 });
    }
    if (Date.parse(sendAt) <= Date.now()) {
      return json({ error: "sendAt must be in the future" }, { status: 400 });
    }
    const parentId = body?.replyTo ? Number(body.replyTo) || null : null;
    const now = new Date().toISOString();
    const insert = await env.DB.prepare(
      `INSERT INTO scheduled_messages (project_id, room_id, user_id, content, send_at, status, parent_id, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
    )
      .bind(
        auth.projectId,
        schedRoomId,
        auth.userId,
        contentValidation.content,
        new Date(sendAt).toISOString(),
        parentId,
        now,
      )
      .run();
    ctx.waitUntil(
      env.ROOM.get(env.ROOM.idFromName(schedRoomId))
        .fetch("https://internal/schedule-expiry", { method: "POST" })
        .catch(() => {}),
    );
    return json({ scheduled: { id: insert.meta.last_row_id, sendAt, status: "pending" } });
  }

  const schedCancelMatch = url.pathname.match(
    /^\/rooms\/([^/]+)\/scheduled-messages\/(\d+)$/,
  );
  if (schedCancelMatch && request.method === "DELETE") {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const [, schedRoomId, schedId] = schedCancelMatch;
    const canAccess = await canAccessRoom(env, auth, schedRoomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });
    await env.DB.prepare(
      `UPDATE scheduled_messages SET status = 'cancelled', cancelled_at = ?
       WHERE id = ? AND project_id = ? AND room_id = ? AND user_id = ? AND status = 'pending'`,
    )
      .bind(new Date().toISOString(), schedId, auth.projectId, schedRoomId, auth.userId)
      .run();
    return json({ ok: true });
  }

  if (
    url.pathname.match(/^\/rooms\/[^/]+\/agent-schedules$/) &&
    (request.method === "GET" || request.method === "POST")
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const schedRoomId = url.pathname.split("/")[2];
    const canAccess = await canAccessRoom(env, auth, schedRoomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });
    if (!env.ROOM) return json({ error: "room_binding_unavailable" }, { status: 503 });
    const stub = env.ROOM.get(env.ROOM.idFromName(schedRoomId));
    if (request.method === "GET") {
      const res = await stub.fetch("https://internal/agent-schedules", { method: "GET" });
      const payload = await res.json().catch(() => ({ ok: false }));
      return json(payload, { status: res.status });
    }
    const body = await request.json().catch(() => ({}));
    const res = await stub.fetch("https://internal/agent-schedules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...body,
        projectId: auth.projectId,
        createdBy: auth.userId,
      }),
    });
    const payload = await res.json().catch(() => ({ ok: false }));
    return json(payload, { status: res.status });
  }

  const agentSchedCancel = url.pathname.match(/^\/rooms\/([^/]+)\/agent-schedules\/([^/]+)$/);
  if (agentSchedCancel && request.method === "DELETE") {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const [, schedRoomId, scheduleId] = agentSchedCancel;
    const canAccess = await canAccessRoom(env, auth, schedRoomId);
    if (!canAccess) return json({ error: "forbidden" }, { status: 403 });
    if (!env.ROOM) return json({ error: "room_binding_unavailable" }, { status: 503 });
    const stub = env.ROOM.get(env.ROOM.idFromName(schedRoomId));
    const res = await stub.fetch("https://internal/agent-schedules", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scheduleId }),
    });
    const payload = await res.json().catch(() => ({ ok: false }));
    return json(payload, { status: res.status });
  }

  return null;
}
