import { pickRouteDeps } from "./route-http-deps.js";
import { suggestMessageRouting } from "../lib/support-routing.js";

export async function dispatchSupportRoutingRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    logError,
    requestLogCtx,
    canAccessRoom,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "logError",
    "requestLogCtx",
    "canAccessRoom",
  ]);

  const match = url.pathname.match(/^\/rooms\/([^/]+)\/routing\/suggest$/);
  if (!match || request.method !== "POST") return null;

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const roomId = decodeURIComponent(match[1]);
  const allowed = await canAccessRoom(env, auth, roomId);
  if (!allowed) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

  try {
    const body = await request.json().catch(() => ({}));
    const messageContent = typeof body.content === "string" ? body.content : "";
    const senderUserId = body.senderUserId || auth.userId;

    const suggestion = await suggestMessageRouting(env, {
      projectId: auth.projectId,
      roomId,
      messageContent,
      senderUserId,
    });

    return json(suggestion, { headers: corsHeaders });
  } catch (err) {
    logError("support_routing.unhandled", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
