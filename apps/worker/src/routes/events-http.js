import { verifyJwtAndGetContext } from "../lib/jwt-request.js";
import { isRoomMember } from "../lib/room-access.js";
import { logError } from "../lib/worker-log.js";
import { fanoutRoomInternal } from "../lib/room-shard.js";
import { pickRouteDeps } from "./route-http-deps.js";

const MAX_ROOMS_PER_TRIGGER = 50;
const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * Pusher-style HTTP trigger: publish an event to one or more rooms.
 * POST /events — JWT required; caller must be a member of each room (or project admin).
 *
 * @returns {Promise<Response|null>}
 */
export async function dispatchEventsRoutes(request, url, h) {
  if (url.pathname !== "/events" || request.method !== "POST") return null;

  const { env, json } = pickRouteDeps(h, ["env", "json"]);

  const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
  if (!auth) {
    return json({ error: "unauthorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const roomIdsRaw = body.roomIds ?? body.rooms ?? body.channels;
  if (!Array.isArray(roomIdsRaw) || roomIdsRaw.length === 0) {
    return json({ error: "roomIds_required" }, 400);
  }
  if (roomIdsRaw.length > MAX_ROOMS_PER_TRIGGER) {
    return json(
      { error: "too_many_rooms", max: MAX_ROOMS_PER_TRIGGER },
      400,
    );
  }

  const roomIds = [];
  for (const id of roomIdsRaw) {
    if (typeof id !== "string" || !VALID_ID_REGEX.test(id)) {
      return json({ error: "invalid_room_id", roomId: id }, 400);
    }
    roomIds.push(id);
  }

  const excludeSocketId =
    typeof body.excludeSocketId === "string" && body.excludeSocketId.trim()
      ? body.excludeSocketId.trim()
      : typeof body.socket_id === "string" && body.socket_id.trim()
        ? body.socket_id.trim()
        : null;

  const isAdmin =
    Array.isArray(auth.roles) &&
    (auth.roles.includes("admin") || auth.roles.includes("owner"));

  const membershipChecks = await Promise.all(
    roomIds.map(async (roomId) => {
      if (isAdmin) return { roomId, ok: true };
      const member = await isRoomMember(env, auth.projectId, roomId, auth.userId);
      return { roomId, ok: member };
    }),
  );

  const denied = membershipChecks.filter((c) => !c.ok).map((c) => c.roomId);
  if (denied.length > 0) {
    return json({ error: "forbidden", roomIds: denied }, 403);
  }

  let announceBody;
  if (body.event && typeof body.event === "object") {
    announceBody = { ...body.event, excludeSocketId };
  } else if (typeof body.name === "string" && body.name.trim()) {
    announceBody = {
      type: "server_event",
      name: body.name.trim(),
      data: body.data ?? {},
      userId: auth.userId,
      excludeSocketId,
    };
  } else if (typeof body.type === "string") {
    announceBody = { ...body, excludeSocketId };
    delete announceBody.roomIds;
    delete announceBody.rooms;
    delete announceBody.channels;
  } else {
    return json({ error: "event_or_name_required" }, 400);
  }

  const results = await Promise.all(
    roomIds.map(async (roomId) => {
      try {
        await fanoutRoomInternal(env, auth.projectId, roomId, "/announce", {
          method: "POST",
          body: JSON.stringify({ ...announceBody, roomId }),
        });
        return { roomId, ok: true };
      } catch (err) {
        logError("events.trigger_failed", err, { roomId });
        return { roomId, ok: false };
      }
    }),
  );

  const failed = results.filter((r) => !r.ok).map((r) => r.roomId);
  if (failed.length === results.length) {
    return json({ error: "trigger_failed", roomIds: failed }, 502);
  }

  return json({
    ok: true,
    triggered: results.filter((r) => r.ok).map((r) => r.roomId),
    ...(failed.length ? { failed } : {}),
  });
}
