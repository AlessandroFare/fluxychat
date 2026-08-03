import { pickRouteDeps } from "./route-http-deps.js";
import {
  createRehearsalRoom,
  deleteRehearsalRoom,
  getRehearsal,
  listRehearsals,
} from "../lib/rehearsal-rooms.js";

export async function dispatchRehearsalRoomsRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/rehearsals") && !path.includes("/rehearsal")) return null;

  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    hasAnyRole,
    logError,
    requestLogCtx,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "logError",
    "requestLogCtx",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    const roomCreateMatch = path.match(/^\/rooms\/([^/]+)\/rehearsal$/);
    if (roomCreateMatch && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const result = await createRehearsalRoom(env, auth, {
        sourceRoomId: decodeURIComponent(roomCreateMatch[1]),
        statedGoal: body.statedGoal,
        counterpartyRole: body.counterpartyRole,
        agentId: body.agentId,
        ttlSeconds: body.ttlSeconds,
        persistAfterSession: body.persistAfterSession === true,
      });
      if (!result.ok) {
        const status = result.error === "forbidden" ? 403 : 400;
        return json(result, { status, headers: corsHeaders });
      }
      return json(result, { status: 201, headers: corsHeaders });
    }

    if (request.method === "GET" && path === "/rehearsals") {
      const rehearsals = await listRehearsals(env, {
        projectId: auth.projectId,
        ownerUserId: auth.userId,
        sourceRoomId: url.searchParams.get("sourceRoomId") || undefined,
        limit: Number(url.searchParams.get("limit") || 20),
      });
      return json({ ok: true, rehearsals }, { headers: corsHeaders });
    }

    const getMatch = path.match(/^\/rehearsals\/([^/]+)$/);
    if (getMatch && request.method === "GET") {
      const rehearsal = await getRehearsal(env, auth.projectId, decodeURIComponent(getMatch[1]));
      if (!rehearsal) {
        return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
      }
      if (rehearsal.ownerUserId !== auth.userId && !hasAnyRole(auth.roles, ["owner", "admin"])) {
        return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      }
      return json({ ok: true, rehearsal }, { headers: corsHeaders });
    }

    if (getMatch && request.method === "DELETE") {
      const rehearsal = await getRehearsal(env, auth.projectId, decodeURIComponent(getMatch[1]));
      if (!rehearsal) {
        return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
      }
      if (rehearsal.ownerUserId !== auth.userId && !hasAnyRole(auth.roles, ["owner", "admin"])) {
        return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      }
      const result = await deleteRehearsalRoom(env, auth.projectId, rehearsal.rehearsalId);
      return json(result, { headers: corsHeaders });
    }
  } catch (err) {
    logError("rehearsal.route_failed", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }

  return null;
}
