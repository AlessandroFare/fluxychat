import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessRoom } from "../lib/room-access.js";
import { getRoomAudienceScore } from "../lib/audience-score.js";
import {
  getRoomSessionProfile,
  putRoomSessionProfile,
} from "../lib/room-session-profile.js";

export async function dispatchRoomIntelligenceRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
  ]);

  const scoreMatch = url.pathname.match(/^\/rooms\/([^/]+)\/audience-score$/);
  if (scoreMatch && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const roomId = decodeURIComponent(scoreMatch[1]);
    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    const windowMinutes = Number(url.searchParams.get("windowMinutes") || 15);
    const score = await getRoomAudienceScore(env, {
      projectId: auth.projectId,
      roomId,
      windowMinutes,
    });
    return json(score, { headers: corsHeaders });
  }

  const profileMatch = url.pathname.match(/^\/rooms\/([^/]+)\/session-profile$/);
  if (profileMatch && (request.method === "GET" || request.method === "PUT")) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const roomId = decodeURIComponent(profileMatch[1]);
    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    if (request.method === "GET") {
      const row = await getRoomSessionProfile(env, {
        projectId: auth.projectId,
        roomId,
      });
      return json(row, { headers: corsHeaders });
    }

    const body = await request.json().catch(() => ({}));
    const result = await putRoomSessionProfile(env, {
      projectId: auth.projectId,
      roomId,
      profile: body?.profile ?? body,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: 400, headers: corsHeaders });
    }
    return json(result, { headers: corsHeaders });
  }

  return null;
}
