import { json } from "../lib/http-json.js";
import { verifyJwtOrNull } from "../lib/route-jwt-auth.js";
import { validateLimit } from "../lib/validation.js";
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
  // Audit CRITICAL #4: these /rooms/{id}/objects routes previously ran with NO
  // authentication and trusted h.projectId/h.userId (undefined), and the by-id
  // handlers fetched objects with no room/project scoping (cross-tenant IDOR).
  // We now require a verified JWT, enforce room membership via canAccessRoom,
  // bind tenant/user from the token, and confirm by-id objects belong to the
  // room+project in the path.
  if (!/^\/rooms\/[^/]+\/objects(\/|$)/.test(path)) return null;

  const auth = await verifyJwtOrNull(request, h.verifyJwtAndGetContext, h.env);
  if (!auth) return json({ error: "unauthorized" }, h, 401);
  const roomId = path.split("/")[2];
  const allowed = await h.canAccessRoom(h.env, auth, roomId);
  if (!allowed) return json({ error: "forbidden" }, h, 403);
  const projectId = auth.projectId;

  // Resolve and authorize a by-id object against the path room + token tenant.
  const loadOwnedObject = async (id) => {
    const obj = await getObject(h.env, id);
    if (!obj || obj.roomId !== roomId || obj.projectId !== projectId) return null;
    return obj;
  };

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/objects$/)) {
    const body = await request.json();
    const result = await createObject(h.env, {
      projectId,
      roomId,
      objectType: body.objectType,
      objectId: body.objectId,
      state: body.state,
      payload: body.payload,
      createdBy: auth.userId,
    });
    return json(result, h, 201);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/objects$/)) {
    const type = url.searchParams.get("type") || undefined;
    const state = url.searchParams.get("state") || undefined;
    const limitResult = validateLimit(url.searchParams.get("limit"), { defaultValue: 50, max: 100 });
    if (limitResult.error) return json({ error: "bad_request", message: limitResult.error }, h, 400);
    const objects = await getObjectsByRoom(h.env, { roomId, projectId, objectType: type, state, limit: limitResult.value });
    return json({ objects }, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/objects\/stats$/)) {
    const stats = await getObjectStats(h.env, { roomId, projectId });
    return json({ stats }, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/objects\/subscriptions$/)) {
    const subscriptions = await getSubscriptions(h.env, { roomId, projectId });
    return json({ subscriptions }, h);
  }

  if (request.method === "POST" && path.match(/^\/rooms\/[^/]+\/objects\/subscribe$/)) {
    const body = await request.json();
    const result = await subscribeToObjectEvents(h.env, {
      projectId,
      roomId,
      userId: auth.userId,
      objectType: body.objectType,
      eventTypes: body.eventTypes,
    });
    return json(result, h, 201);
  }

  if (request.method === "DELETE" && path.match(/^\/rooms\/[^/]+\/objects\/subscriptions\/[^/]+$/)) {
    const id = path.split("/").pop();
    const result = await unsubscribeFromObjectEvents(h.env, { id, roomId, projectId });
    return json(result, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/objects\/[^/]+\/events$/)) {
    const objectId = path.split("/")[4];
    const obj = await loadOwnedObject(objectId);
    if (!obj) return json({ error: "not_found" }, h, 404);
    const limitResult = validateLimit(url.searchParams.get("limit"), { defaultValue: 50, max: 100 });
    if (limitResult.error) return json({ error: "bad_request", message: limitResult.error }, h, 400);
    const events = await getEvents(h.env, { roomId, objectId, limit: limitResult.value });
    return json({ events }, h);
  }

  if (request.method === "GET" && path.match(/^\/rooms\/[^/]+\/objects\/[^/]+$/)) {
    const id = path.split("/")[4];
    const obj = await loadOwnedObject(id);
    if (!obj) return json({ error: "not_found" }, h, 404);
    return json({ object: obj }, h);
  }

  if (request.method === "PATCH" && path.match(/^\/rooms\/[^/]+\/objects\/[^/]+$/)) {
    const id = path.split("/")[4];
    const obj = await loadOwnedObject(id);
    if (!obj) return json({ error: "not_found" }, h, 404);
    const body = await request.json();
    const result = await updateObject(h.env, { id, state: body.state, payload: body.payload, actorUserId: auth.userId });
    if (result.error === "not_found") return json(result, h, 404);
    return json(result, h);
  }

  if (request.method === "DELETE" && path.match(/^\/rooms\/[^/]+\/objects\/[^/]+$/)) {
    const id = path.split("/")[4];
    const obj = await loadOwnedObject(id);
    if (!obj) return json({ error: "not_found" }, h, 404);
    const result = await deleteObject(h.env, { id, actorUserId: auth.userId });
    if (result.error === "not_found") return json(result, h, 404);
    return json(result, h);
  }

  return null;
}
