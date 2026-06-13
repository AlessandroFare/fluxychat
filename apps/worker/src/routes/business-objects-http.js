import { json } from "../lib/http-json.js";
import {
  createObject,
  updateObject,
  getObject,
  getObjectsByRoom,
  deleteObject,
  getEvents,
  subscribeToObjectEvents,
  getSubscriptions,
  unsubscribeFromObjectEvents,
  getObjectStats,
} from "../lib/business-objects.js";

export async function dispatchBusinessObjectRoutes(request, url, h) {
  const path = url.pathname;

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/objects$/)) {
    const roomId = path.split("/")[2];
    const body = await request.json();
    const result = await createObject(h.env, {
      projectId: h.projectId,
      roomId,
      objectType: body.objectType,
      objectId: body.objectId,
      state: body.state,
      payload: body.payload,
      createdBy: h.userId,
    });
    return json(result, h, 201);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/objects$/)) {
    const roomId = path.split("/")[2];
    const type = url.searchParams.get("type") || undefined;
    const state = url.searchParams.get("state") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const objects = await getObjectsByRoom(h.env, { roomId, objectType: type, state, limit });
    return json({ objects }, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/objects\/[^/]+$/)) {
    const parts = path.split("/");
    const id = parts[4];
    const obj = await getObject(h.env, id);
    if (!obj) return json({ error: "not_found" }, h, 404);
    return json({ object: obj }, h);
  }

  if (request.method === "PATCH" && path.match(/^\/rooms\/[^/]+\/objects\/[^/]+$/)) {
    const parts = path.split("/");
    const id = parts[4];
    const body = await request.json();
    const result = await updateObject(h.env, { id, state: body.state, payload: body.payload, actorUserId: h.userId });
    if (result.error === "not_found") return json(result, h, 404);
    return json(result, h);
  }

  if (request.method === "DELETE" && path.match(/^\/rooms\/[^/]+\/objects\/[^/]+$/)) {
    const parts = path.split("/");
    const id = parts[4];
    const result = await deleteObject(h.env, { id, actorUserId: h.userId });
    if (result.error === "not_found") return json(result, h, 404);
    return json(result, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/objects\/[^/]+\/events$/)) {
    const parts = path.split("/");
    const roomId = parts[2];
    const objectId = parts[4];
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const events = await getEvents(h.env, { roomId, objectId, limit });
    return json({ events }, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/objects\/stats$/)) {
    const roomId = path.split("/")[2];
    const stats = await getObjectStats(h.env, { roomId });
    return json({ stats }, h);
  }

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/objects\/subscribe$/)) {
    const roomId = path.split("/")[2];
    const body = await request.json();
    const result = await subscribeToObjectEvents(h.env, {
      projectId: h.projectId,
      roomId,
      userId: h.userId,
      objectType: body.objectType,
      eventTypes: body.eventTypes,
    });
    return json(result, h, 201);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/objects\/subscriptions$/)) {
    const roomId = path.split("/")[2];
    const subscriptions = await getSubscriptions(h.env, { roomId });
    return json({ subscriptions }, h);
  }

  if (request.method === "DELETE" && path.match(/^\/rooms\/[^/]+\/objects\/subscriptions\/[^/]+$/)) {
    const id = path.split("/").pop();
    const result = await unsubscribeFromObjectEvents(h.env, { id });
    return json(result, h);
  }

  return null;
}
