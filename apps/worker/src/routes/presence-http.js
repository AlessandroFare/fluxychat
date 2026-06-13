import { json } from "../lib/http-json.js";
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

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/presence$/)) {
    const roomId = path.split("/")[2];
    const body = await request.json();
    const result = await updatePresence(h.env, {
      projectId: h.projectId,
      roomId,
      userId: h.userId,
      type: body.type,
      payload: body.payload || {},
    });
    if (result.error) return json(result, h, 400);
    return json(result, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/presence$/)) {
    const roomId = path.split("/")[2];
    const type = url.searchParams.get("type") || undefined;
    const presence = await getPresenceByRoom(h.env, { roomId, type });
    return json({ presence }, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/presence\/snapshot$/)) {
    const roomId = path.split("/")[2];
    const snapshot = await getPresenceSnapshot(h.env, { roomId });
    return json({ snapshot }, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/presence\/cursors$/)) {
    const roomId = path.split("/")[2];
    const cursors = await getCursorsByRoom(h.env, { roomId });
    return json({ cursors }, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/presence\/focus$/)) {
    const roomId = path.split("/")[2];
    const focus = await getFocusByRoom(h.env, { roomId });
    return json({ focus }, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/presence\/stats$/)) {
    const roomId = path.split("/")[2];
    const stats = await getPresenceStats(h.env, { roomId });
    return json({ stats }, h);
  }

  if (request.method === "GET" && path === "/presence/user") {
    const presence = await getPresenceByUser(h.env, { userId: h.userId, projectId: h.projectId });
    return json({ presence }, h);
  }

  if (request.method === "DELETE" && path.match(/^\/rooms\/[^/]+\/presence$/)) {
    const roomId = path.split("/")[2];
    const type = url.searchParams.get("type") || undefined;
    const result = await clearPresence(h.env, { roomId, userId: h.userId, type });
    return json(result, h);
  }

  return null;
}
