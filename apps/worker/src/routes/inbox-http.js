import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessRoom } from "../lib/room-access.js";
import {
  getInboxSummary,
  upsertRoomSnooze,
  clearRoomSnooze,
  createFollowUp,
  updateFollowUpStatus,
  deleteFollowUp,
  resolveSnoozeUntil,
} from "../lib/inbox.js";
import { applyInboxQuery, parseInboxQueryParams } from "../lib/inbox-where.js";

export async function dispatchInboxRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    isValidId,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "isValidId",
  ]);

  if (url.pathname === "/inbox" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const parsed = parseInboxQueryParams(
      url.searchParams.get("roomId"),
      url.searchParams.get("where"),
    );
    if (!parsed.ok) {
      return json({ error: parsed.error }, { status: 400, headers: corsHeaders });
    }
    const summary = await getInboxSummary(env, {
      projectId: auth.projectId,
      userId: auth.userId,
      roles: auth.roles,
    });
    return json(applyInboxQuery(summary, parsed.query), { headers: corsHeaders });
  }

  const snoozeMatch = url.pathname.match(/^\/inbox\/rooms\/([^/]+)\/snooze$/);
  if (snoozeMatch && request.method === "PUT") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const roomId = decodeURIComponent(snoozeMatch[1]);
    if (!isValidId(roomId)) {
      return json({ error: "invalid_room_id" }, { status: 400, headers: corsHeaders });
    }
    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
    const body = await request.json().catch(() => null);
    const snoozeUntil = resolveSnoozeUntil(body || {});
    if (!snoozeUntil) {
      return json({ error: "invalid_snooze" }, { status: 400, headers: corsHeaders });
    }
    const result = await upsertRoomSnooze(env, {
      projectId: auth.projectId,
      userId: auth.userId,
      roomId,
      snoozeUntil,
    });
    return json(result, { headers: corsHeaders });
  }

  if (snoozeMatch && request.method === "DELETE") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const roomId = decodeURIComponent(snoozeMatch[1]);
    if (!isValidId(roomId)) {
      return json({ error: "invalid_room_id" }, { status: 400, headers: corsHeaders });
    }
    await clearRoomSnooze(env, {
      projectId: auth.projectId,
      userId: auth.userId,
      roomId,
    });
    return json({ ok: true }, { headers: corsHeaders });
  }

  if (url.pathname === "/inbox/follow-ups" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const body = await request.json().catch(() => null);
    const roomId = typeof body?.roomId === "string" ? body.roomId.trim() : "";
    if (!isValidId(roomId)) {
      return json({ error: "roomId required" }, { status: 400, headers: corsHeaders });
    }
    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
    const messageId =
      body?.messageId != null && Number.isFinite(Number(body.messageId))
        ? Number(body.messageId)
        : null;
    const result = await createFollowUp(env, {
      projectId: auth.projectId,
      userId: auth.userId,
      roomId,
      messageId,
      note: typeof body?.note === "string" ? body.note.slice(0, 500) : null,
      dueAt: typeof body?.dueAt === "string" ? body.dueAt : null,
    });
    return json(result, { status: 201, headers: corsHeaders });
  }

  const followUpMatch = url.pathname.match(/^\/inbox\/follow-ups\/([^/]+)$/);
  if (followUpMatch && request.method === "PATCH") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const id = decodeURIComponent(followUpMatch[1]);
    const body = await request.json().catch(() => null);
    const status = body?.status === "done" ? "done" : body?.status === "open" ? "open" : null;
    if (!status) {
      return json({ error: "invalid_status" }, { status: 400, headers: corsHeaders });
    }
    const result = await updateFollowUpStatus(env, {
      projectId: auth.projectId,
      userId: auth.userId,
      id,
      status,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: 404, headers: corsHeaders });
    }
    return json({ ok: true }, { headers: corsHeaders });
  }

  if (followUpMatch && request.method === "DELETE") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const id = decodeURIComponent(followUpMatch[1]);
    const result = await deleteFollowUp(env, {
      projectId: auth.projectId,
      userId: auth.userId,
      id,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: 404, headers: corsHeaders });
    }
    return json({ ok: true }, { headers: corsHeaders });
  }

  return null;
}
