import { json } from "../lib/http-json.js";
import { pickRouteDeps } from "./route-http-deps.js";
import { parsePresenceUpdateBody } from "../lib/http-body.js";
import {
  updatePresence,
  getPresenceByRoom,
  getPresenceByUser,
  getPresenceSnapshot,
  getCursorsByRoom,
  getFocusByRoom,
  clearPresence,
  getPresenceStats,
} from "../lib/presence-extensions.js";

export async function dispatchPresenceRoutes(request, url, h) {
  const path = url.pathname;
  const isPresencePath =
    path === "/presence/user" ||
    /^\/rooms\/[^/]+\/presence(\/(snapshot|cursors|focus|stats))?$/.test(path);
  if (!isPresencePath) return null;

  const {
    env,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
  } = pickRouteDeps(h, [
    "env",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const ctx = { ...h, corsHeaders, projectId: auth.projectId, userId: auth.userId };

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/presence$/)) {
    const roomId = path.split("/")[2];
    const raw = await request.json().catch(() => null);
    const parsed = parsePresenceUpdateBody(raw);
    if (!parsed.ok) return json({ error: parsed.error }, ctx, 400);
    const result = await updatePresence(env, {
      projectId: auth.projectId,
      roomId,
      userId: auth.userId,
      type: parsed.type,
      payload: parsed.payload,
    });
    if (result.error) return json(result, ctx, 400);
    return json(result, ctx);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/presence$/)) {
    const roomId = path.split("/")[2];
    const type = url.searchParams.get("type") || undefined;
    const presence = await getPresenceByRoom(env, { roomId, type });
    return json({ presence }, ctx);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/presence\/snapshot$/)) {
    const roomId = path.split("/")[2];
    const snapshot = await getPresenceSnapshot(env, { roomId });
    return json({ snapshot }, ctx);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/presence\/cursors$/)) {
    const roomId = path.split("/")[2];
    const cursors = await getCursorsByRoom(env, { roomId });
    return json({ cursors }, ctx);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/presence\/focus$/)) {
    const roomId = path.split("/")[2];
    const focus = await getFocusByRoom(env, { roomId });
    return json({ focus }, ctx);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/presence\/stats$/)) {
    const roomId = path.split("/")[2];
    const stats = await getPresenceStats(env, { roomId });
    return json({ stats }, ctx);
  }

  if (request.method === "GET" && path === "/presence/user") {
    const presence = await getPresenceByUser(env, {
      userId: auth.userId,
      projectId: auth.projectId,
    });
    return json({ presence }, ctx);
  }

  if (request.method === "DELETE" && path.match(/^\/rooms\/[^/]+\/presence$/)) {
    const roomId = path.split("/")[2];
    const type = url.searchParams.get("type") || undefined;
    const result = await clearPresence(env, { roomId, userId: auth.userId, type });
    return json(result, ctx);
  }

  return null;
}
