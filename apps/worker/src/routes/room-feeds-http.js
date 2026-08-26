/**
 * Room feeds — Liveblocks Feeds analogue.
 * GET/POST /rooms/:roomId/feeds
 * GET/POST /rooms/:roomId/feeds/:feedId/messages
 *
 * POST accepts member JWT or project API key (n8n / LangChain / agents).
 */
import { pickRouteDeps } from "./route-http-deps.js";
import { resolveProjectId } from "../lib/resolve-project-id.js";
import {
  createFeedMessage,
  createRoomFeed,
  listFeedMessages,
  listRoomFeeds,
} from "../lib/room-feeds.js";

async function resolveFeedAuth(request, roomId, deps) {
  const { env, verifyJwtAndGetContext, logError, requestLogCtx, canAccessRoom } = deps;
  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (auth) {
    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) return { error: "forbidden", status: 403 };
    return { projectId: auth.projectId, userId: auth.userId };
  }

  const projectId = await resolveProjectId(request, env);
  if (!projectId) return { error: "unauthorized", status: 401 };
  const room = await env.DB.prepare(
    "SELECT id FROM rooms WHERE id = ? AND project_id = ? LIMIT 1",
  )
    .bind(roomId, projectId)
    .first();
  if (!room?.id) return { error: "forbidden", status: 403 };
  return { projectId, userId: "workflow" };
}

export async function dispatchRoomFeedsRoutes(request, url, h) {
  const messagesMatch = url.pathname.match(/^\/rooms\/([^/]+)\/feeds\/([^/]+)\/messages$/);
  const listMatch = url.pathname.match(/^\/rooms\/([^/]+)\/feeds$/);
  if (!messagesMatch && !listMatch) return null;

  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    canAccessRoom,
    isValidId,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "canAccessRoom",
    "isValidId",
  ]);

  const roomId = decodeURIComponent((messagesMatch || listMatch)[1]);
  if (!isValidId(roomId)) {
    return json({ error: "invalid_room" }, { status: 400, headers: corsHeaders });
  }

  const ctx = await resolveFeedAuth(request, roomId, {
    env,
    verifyJwtAndGetContext,
    logError,
    requestLogCtx,
    canAccessRoom,
  });
  if (ctx.error) {
    const status = ctx.status ?? 401;
    if (status === 401) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    return json({ error: ctx.error }, { status, headers: corsHeaders });
  }

  if (listMatch && request.method === "GET") {
    const feeds = await listRoomFeeds(env, { projectId: ctx.projectId, roomId });
    return json({ feeds }, { status: 200, headers: corsHeaders });
  }

  if (listMatch && request.method === "POST") {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const result = await createRoomFeed(env, {
      projectId: ctx.projectId,
      roomId,
      userId: ctx.userId,
      name: body.name,
      kind: body.kind,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: 400, headers: corsHeaders });
    }
    return json({ feed: result.feed }, { status: 201, headers: corsHeaders });
  }

  if (messagesMatch && request.method === "GET") {
    const result = await listFeedMessages(env, {
      projectId: ctx.projectId,
      roomId,
      feedId: decodeURIComponent(messagesMatch[2]),
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: 404, headers: corsHeaders });
    }
    return json({ messages: result.messages }, { status: 200, headers: corsHeaders });
  }

  if (messagesMatch && request.method === "POST") {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const result = await createFeedMessage(env, {
      projectId: ctx.projectId,
      roomId,
      feedId: decodeURIComponent(messagesMatch[2]),
      userId: ctx.userId,
      body: body.body ?? body.content,
      metadata: body.metadata,
    });
    if (!result.ok) {
      const status = result.error === "feed_not_found" ? 404 : 400;
      return json({ error: result.error }, { status, headers: corsHeaders });
    }
    return json({ message: result.message }, { status: 201, headers: corsHeaders });
  }

  return json({ error: "method_not_allowed" }, { status: 405, headers: corsHeaders });
}
