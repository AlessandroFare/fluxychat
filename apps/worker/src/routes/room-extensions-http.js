/**
 * GET /rooms/:roomId/extensions
 * GET/PUT /rooms/:roomId/extensions/:extId
 *
 * Snapshots live on shard 0. Hosted overlay `rooms.*.extensions` is the allow-list.
 */
import { pickRouteDeps } from "./route-http-deps.js";
import { getRoomShardCount, getRoomStub, fanoutRoomInternal } from "../lib/room-shard.js";
import { hostedRoomsAsConfig, loadProjectPublishConfig } from "../lib/fluxy-config-runtime.js";
import { resolveRoomConfig } from "@fluxy-chat/config";

export async function dispatchRoomExtensionsRoutes(request, url, h) {
  const listMatch = url.pathname.match(/^\/rooms\/([^/]+)\/extensions$/);
  const itemMatch = url.pathname.match(/^\/rooms\/([^/]+)\/extensions\/([^/]+)$/);
  if (!listMatch && !itemMatch) return null;

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

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const roomId = decodeURIComponent((listMatch || itemMatch)[1]);
  if (!isValidId(roomId)) {
    return json({ error: "invalid_room" }, { status: 400, headers: corsHeaders });
  }
  const allowed = await canAccessRoom(env, auth, roomId);
  if (!allowed) {
    return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  const shardCount = await getRoomShardCount(env, auth.projectId, roomId);
  const stub = getRoomStub(env, roomId, shardCount);
  const row = await loadProjectPublishConfig(env, auth.projectId);
  const overlay = hostedRoomsAsConfig(row);
  const declared = overlay ? resolveRoomConfig(overlay, roomId).extensions : undefined;

  if (listMatch && request.method === "GET") {
    const res = await stub.fetch("https://internal/extensions");
    const body = await res.json().catch(() => ({}));
    return json({ roomId, ext: body.ext ?? {}, declared: declared ?? [] }, { headers: corsHeaders });
  }

  if (itemMatch && (request.method === "GET" || request.method === "PUT" || request.method === "POST")) {
    const extId = decodeURIComponent(itemMatch[2]);
    const init =
      request.method === "GET"
        ? { method: "GET" }
        : {
            method: request.method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...((await request.json().catch(() => ({}))) || {}),
              declared,
            }),
          };
    const res = await stub.fetch(`https://internal/extensions/${encodeURIComponent(extId)}`, init);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json({ error: body.error || "extension_failed", roomId }, { status: res.status, headers: corsHeaders });
    }
    if (request.method !== "GET" && body.ext) {
      await fanoutRoomInternal(env, auth.projectId, roomId, "/announce", {
        method: "POST",
        body: JSON.stringify({ type: "extension_snapshot", roomId, ext: body.ext, id: extId }),
      }).catch((err) => logError("extension.fanout_failed", err, requestLogCtx));
    }
    return json({ roomId, ...body }, { headers: corsHeaders });
  }

  return json({ error: "method_not_allowed" }, { status: 405, headers: corsHeaders });
}
