import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessRoom } from "../lib/room-access.js";
import { handleTelephonyAgentHandoff } from "../lib/telephony-handoff.js";

/** NW-130 POST /integrations/telephony/handoff */
export async function dispatchTelephonyHandoffRoutes(request, url, h) {
  if (url.pathname !== "/integrations/telephony/handoff") return null;
  if (request.method !== "POST") return null;

  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    logError,
    requestLogCtx,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "logError",
    "requestLogCtx",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    const body = await request.json().catch(() => ({}));
    const roomId = String(body.roomId || "").trim();
    if (!roomId) return json({ error: "roomId required" }, { status: 400, headers: corsHeaders });

    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const result = await handleTelephonyAgentHandoff(env, {
      projectId: auth.projectId,
      roomId,
      userId: auth.userId,
      fromE164: body.fromE164,
      channel: body.channel,
      providerId: body.providerId,
      reason: body.reason,
      requestVoiceSession: body.requestVoiceSession !== false,
    });
    return json(result, { status: result.ok ? 200 : 400, headers: corsHeaders });
  } catch (err) {
    logError("telephony.handoff_route_failed", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
