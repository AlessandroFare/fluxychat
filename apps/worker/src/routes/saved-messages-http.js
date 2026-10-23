import { pickRouteDeps } from "./route-http-deps.js";
import { listSavedMessages } from "../lib/saved-messages.js";

/**
 * Saved messages list (per-user). Save/unsave happen on the message routes.
 * GET /saved-messages?limit=
 */
export async function dispatchSavedMessagesRoutes(request, url, h) {
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

  if (url.pathname !== "/saved-messages") return null;

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    if (request.method === "GET") {
      const { items } = await listSavedMessages(env, {
        projectId: auth.projectId,
        userId: auth.userId,
        limit: url.searchParams.get("limit"),
      });
      return json({ items, count: items.length }, { headers: corsHeaders });
    }
    return null;
  } catch (err) {
    logError("saved_messages.route_error", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
