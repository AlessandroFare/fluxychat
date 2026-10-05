import { pickRouteDeps } from "./route-http-deps.js";
import { getRoomConfig, patchRoomConfig } from "../lib/room-config.js";
import { listRoomTimelineEvents } from "../lib/room-timeline-events.js";
import { fanoutRoomInternal } from "../lib/room-shard.js";

export async function dispatchRoomConfigRoutes(request, url, h) {
  const configMatch = url.pathname.match(/^\/rooms\/([^/]+)\/config$/);
  const timelineMatch = url.pathname.match(/^\/rooms\/([^/]+)\/timeline-events$/);
  const decisionsMatch = url.pathname.match(/^\/rooms\/([^/]+)\/system-one-decisions$/);
  const ticketsMatch = url.pathname.match(/^\/rooms\/([^/]+)\/tickets$/);
  const browserHandoffMatch = url.pathname.match(/^\/rooms\/([^/]+)\/browser-handoff$/);
  const a2uiMatch = url.pathname.match(/^\/rooms\/([^/]+)\/a2ui$/);
  if (!configMatch && !timelineMatch && !decisionsMatch && !ticketsMatch && !browserHandoffMatch && !a2uiMatch) return null;

  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    hasAnyRole,
    canAccessRoom,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "hasAnyRole",
    "canAccessRoom",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const roomId = decodeURIComponent((configMatch || timelineMatch || decisionsMatch || ticketsMatch || browserHandoffMatch || a2uiMatch)[1]);
  const allowed = await canAccessRoom(env, auth, roomId);
  if (!allowed) {
    return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  if (ticketsMatch && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const { createExternalTicket } = await import("../lib/room-tickets.js");
    const { resolveProjectWriteCredentials } = await import("../lib/integration-kit.js");
    const credentials = await resolveProjectWriteCredentials(env, {
      projectId: auth.projectId,
      provider: body?.provider,
    });
    const result = await createExternalTicket(env, {
      projectId: auth.projectId,
      roomId,
      userId: auth.userId,
      runId: body?.runId,
      provider: body?.provider,
      title: body?.title,
      body: body?.body,
      repo: body?.repo,
      teamId: body?.teamId,
      projectKey: body?.projectKey,
      credentials: credentials || undefined,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
    }
    return json({ ticket: result.ticket }, { headers: corsHeaders });
  }

  if (browserHandoffMatch && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const { mapBrowserHandoffRequest, canTakeBrowserHandoff, browserHandoffRoomEvent } = await import(
      "../lib/browser-handoff.js"
    );
    const mapped = mapBrowserHandoffRequest({ ...body, invokerUserId: body.invokerUserId || auth.userId });
    if (!mapped.ok) return json({ error: mapped.error }, { status: 400, headers: corsHeaders });
    if (!canTakeBrowserHandoff(mapped.handoff, auth.userId) && !hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
    const event = browserHandoffRoomEvent(mapped.handoff);
    await fanoutRoomInternal(env, auth.projectId, roomId, "/announce", {
      method: "POST",
      body: JSON.stringify({ ...event, roomId, userId: auth.userId }),
    });
    return json({ ok: true, event }, { headers: corsHeaders });
  }

  if (a2uiMatch && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const { validateA2uiSurface } = await import("../lib/a2ui-catalog.js");
    const surface = validateA2uiSurface(body);
    if (!surface.ok) return json({ error: surface.error, type: surface.type }, { status: 400, headers: corsHeaders });
    await fanoutRoomInternal(env, auth.projectId, roomId, "/announce", {
      method: "POST",
      body: JSON.stringify({
        type: "a2ui_surface",
        roomId,
        userId: auth.userId,
        catalogVersion: surface.catalogVersion,
        components: surface.components,
        actions: surface.actions,
      }),
    });
    return json({ ok: true, surface }, { headers: corsHeaders });
  }

  if (decisionsMatch && request.method === "GET") {
    try {
      const { listRoomDecisions } = await import("../lib/room-decisions.js");
      const rows = await listRoomDecisions(env, {
        projectId: auth.projectId,
        roomId,
        limit: url.searchParams.get("limit"),
      });
      return json({ decisions: rows }, { headers: corsHeaders });
    } catch {
      return json({ decisions: [] }, { headers: corsHeaders });
    }
  }

  if (timelineMatch && request.method === "GET") {
    const eventType = url.searchParams.get("eventType") || undefined;
    const limit = url.searchParams.get("limit");
    const events = await listRoomTimelineEvents(env, {
      projectId: auth.projectId,
      roomId,
      eventType,
      limit: limit ? Number(limit) : undefined,
    });
    return json({ events }, { headers: corsHeaders });
  }

  if (configMatch && request.method === "GET") {
    const result = await getRoomConfig(env, { projectId: auth.projectId, roomId });
    return json({ roomId, ...result }, { headers: corsHeaders });
  }

  if (configMatch && request.method === "PATCH") {
    if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
    const body = await request.json().catch(() => ({}));
    const result = await patchRoomConfig(env, {
      projectId: auth.projectId,
      roomId,
      patch: body?.config ?? body,
      changedBy: auth.userId,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: 400, headers: corsHeaders });
    }

    if (body?.config?.approvalChain !== undefined || body?.approvalChain !== undefined) {
      try {
        await fanoutRoomInternal(env, auth.projectId, roomId, "/announce", {
          type: "server_event",
          event: {
            type: "approval_chain_updated",
            roomId,
            changedBy: auth.userId,
            newChain: result.config.approvalChain,
            timestamp: result.updatedAt,
          },
        });
      } catch {
        /* non-fatal */
      }
    }

    return json({ roomId, config: result.config, updatedAt: result.updatedAt, updatedBy: result.updatedBy }, {
      headers: corsHeaders,
    });
  }

  return json({ error: "method_not_allowed" }, { status: 405, headers: corsHeaders });
}
