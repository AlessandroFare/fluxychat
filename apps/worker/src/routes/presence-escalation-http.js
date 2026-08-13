import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessRoom } from "../lib/room-access.js";
import {
  getActivePresenceEscalation,
  startPresenceEscalation,
  resolvePresenceEscalation,
  tickPresenceEscalations,
} from "../lib/presence-escalation.js";
import { canManageEscalationRules } from "../lib/escalation-rules.js";

export async function dispatchPresenceEscalationRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
  ]);

  if (url.pathname === "/presence-escalation/tick" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!canManageEscalationRules(auth.roles)) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const result = await tickPresenceEscalations(env, { projectId: auth.projectId });
    return json(result, { headers: corsHeaders });
  }

  const resolveMatch = url.pathname.match(/^\/rooms\/([^/]+)\/presence-escalation\/resolve$/);
  if (resolveMatch && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const roomId = decodeURIComponent(resolveMatch[1]);
    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const body = await request.json().catch(() => ({}));
    const result = await resolvePresenceEscalation(env, {
      projectId: auth.projectId,
      roomId,
      reason: body?.reason,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: 404, headers: corsHeaders });
    }
    return json(result, { headers: corsHeaders });
  }

  const roomMatch = url.pathname.match(/^\/rooms\/([^/]+)\/presence-escalation$/);
  if (!roomMatch) return null;

  const roomId = decodeURIComponent(roomMatch[1]);

  if (request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const watch = await getActivePresenceEscalation(env, {
      projectId: auth.projectId,
      roomId,
    });
    return json({ watch }, { headers: corsHeaders });
  }

  if (request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const body = await request.json().catch(() => ({}));
    const result = await startPresenceEscalation(env, {
      projectId: auth.projectId,
      roomId,
      escalationChain: body?.escalationChain ?? body?.chain,
      awaitingUserId: body?.awaitingUserId,
      nudgeIntervalSeconds: body?.nudgeIntervalSeconds,
    });
    if (!result.ok) {
      const status = result.error === "escalation_already_active" ? 409 : 400;
      return json(
        { error: result.error, watch: result.watch ?? undefined },
        { status, headers: corsHeaders },
      );
    }
    return json({ watch: result.watch }, { status: 201, headers: corsHeaders });
  }

  return null;
}
