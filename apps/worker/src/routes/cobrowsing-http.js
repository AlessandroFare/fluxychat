import { resolveMemberContext } from "../lib/admin-route-context.js";
import { rolesInclude } from "../lib/route-jwt-auth.js";
import { pickRouteDeps } from "./route-http-deps.js";
import {
  createSession, endSession, pauseSession, resumeSession, getSession, listActiveSessions,
  joinSession, leaveSession, updateCursor, addAnnotation, listAnnotations,
  grantRemoteControl, revokeRemoteControl, listViewers, getCobrowsingStats,
} from "../lib/cobrowsing.js";

export async function dispatchCobrowsingRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/cobrowsing")) return null;

  const { hasAnyRole } = pickRouteDeps(h, ["hasAnyRole"]);
  const ctx = await resolveMemberContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId, userId } = ctx;

  const isAdmin = rolesInclude(ctx.auth, hasAnyRole, ["owner", "admin", "moderator"]);

  if (request.method === "POST" && path === "/admin/cobrowsing/sessions") {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const body = await request.json();
    const result = await createSession(env, {
      projectId,
      roomId: body.roomId,
      createdBy: userId,
      url: body.url,
      maxViewers: body.maxViewers,
      annotationsEnabled: body.annotationsEnabled,
      remoteControlEnabled: body.remoteControlEnabled,
    });
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path === "/admin/cobrowsing/sessions/active") {
    const sessions = await listActiveSessions(env, { projectId });
    return respond({ sessions }, h);
  }

  if (request.method === "GET" && path.match(/^\/admin\/cobrowsing\/sessions\/[^/]+$/)) {
    const sessionId = path.split("/").pop();
    const session = await getSession(env, { sessionId });
    if (!session || session.project_id !== projectId) {
      return respond({ error: "not_found" }, h, 404);
    }
    const viewers = await listViewers(env, { sessionId });
    return respond({ session, viewers }, h);
  }

  if (request.method === "POST" && path.match(/^\/admin\/cobrowsing\/sessions\/[^/]+\/end$/)) {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const sessionId = path.split("/")[4];
    const result = await endSession(env, { sessionId });
    return respond(result, h);
  }

  if (request.method === "POST" && path.match(/^\/admin\/cobrowsing\/sessions\/[^/]+\/pause$/)) {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const sessionId = path.split("/")[4];
    const result = await pauseSession(env, { sessionId });
    return respond(result, h);
  }

  if (request.method === "POST" && path.match(/^\/admin\/cobrowsing\/sessions\/[^/]+\/resume$/)) {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const sessionId = path.split("/")[4];
    const result = await resumeSession(env, { sessionId });
    return respond(result, h);
  }

  if (request.method === "POST" && path === "/admin/cobrowsing/join") {
    const body = await request.json();
    const result = await joinSession(env, {
      sessionId: body.sessionId,
      userId,
      displayName: body.displayName,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "POST" && path === "/admin/cobrowsing/leave") {
    const body = await request.json();
    const result = await leaveSession(env, { sessionId: body.sessionId, userId });
    if (result.error) return respond(result, h, 400);
    return respond(result, h);
  }

  if (request.method === "POST" && path === "/admin/cobrowsing/cursor") {
    const body = await request.json();
    const result = await updateCursor(env, {
      sessionId: body.sessionId,
      userId,
      x: body.x,
      y: body.y,
      pageUrl: body.pageUrl,
    });
    return respond(result, h);
  }

  if (request.method === "POST" && path === "/admin/cobrowsing/annotations") {
    const body = await request.json();
    const result = await addAnnotation(env, {
      sessionId: body.sessionId,
      projectId,
      userId,
      type: body.type,
      payload: body.payload,
      pageUrl: body.pageUrl,
    });
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path === "/admin/cobrowsing/annotations") {
    const sessionId = url.searchParams.get("sessionId");
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const annotations = await listAnnotations(env, { sessionId, limit });
    return respond({ annotations }, h);
  }

  if (request.method === "POST" && path === "/admin/cobrowsing/remote-control/grant") {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const body = await request.json();
    const result = await grantRemoteControl(env, { sessionId: body.sessionId, userId: body.userId });
    return respond(result, h);
  }

  if (request.method === "POST" && path === "/admin/cobrowsing/remote-control/revoke") {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const body = await request.json();
    const result = await revokeRemoteControl(env, { sessionId: body.sessionId, userId: body.userId });
    return respond(result, h);
  }

  if (request.method === "GET" && path === "/admin/cobrowsing/stats") {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const stats = await getCobrowsingStats(env, { projectId });
    return respond({ stats }, h);
  }

  return null;
}
