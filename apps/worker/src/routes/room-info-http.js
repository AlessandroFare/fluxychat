/**
 * NW-105 / NW-103 — room info panel + mention autocomplete.
 */
import { pickRouteDeps } from "./route-http-deps.js";
import { getRoomInfoPanel } from "../lib/room-info.js";
import { listMentionSuggestions } from "../lib/message-mentions.js";

export async function dispatchRoomInfoRoutes(request, url, h) {
  const infoMatch = url.pathname.match(/^\/rooms\/([^/]+)\/info$/);
  const mentionMatch = url.pathname.match(/^\/rooms\/([^/]+)\/mentions\/autocomplete$/);

  if (!infoMatch && !mentionMatch) return null;
  if (request.method !== "GET") return null;

  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    canAccessRoom,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
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

  const roomId = decodeURIComponent((infoMatch || mentionMatch)[1]);
  const allowed = await canAccessRoom(env, auth, roomId);
  if (!allowed) {
    return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  if (mentionMatch) {
    const suggestions = await listMentionSuggestions(env, {
      projectId: auth.projectId,
      roomId,
      query: url.searchParams.get("q") || "",
      limit: Number(url.searchParams.get("limit")) || 20,
    });
    return json({ suggestions }, { status: 200, headers: corsHeaders });
  }

  const result = await getRoomInfoPanel(env, {
    projectId: auth.projectId,
    roomId,
  });
  if (!result.ok) {
    return json({ error: result.error }, { status: 404, headers: corsHeaders });
  }
  return json(result, { status: 200, headers: corsHeaders });
}
