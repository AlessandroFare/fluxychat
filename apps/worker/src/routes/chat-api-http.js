/**
 * CP-063: Unified Chat API HTTP routes.
 */
import { pickRouteDeps } from "./route-http-deps.js";
import { createChatApi } from "../lib/chat-api.js";

export async function dispatchChatApiRoutes(request, url, h) {
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

  if (url.pathname === "/chat/open-dm" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const body = await request.json().catch(() => null);
    const targetUserId = String(body?.userId || "").trim();
    if (!targetUserId) {
      return json({ error: "userId required" }, { status: 400 });
    }

    const api = createChatApi({
      env,
      db: env.DB,
      projectId: auth.projectId,
      userId: auth.userId,
    });

    try {
      const thread = await api.openDM(targetUserId, { userId: auth.userId });
      return json({
        ok: true,
        thread: {
          id: thread.id,
          adapterSlug: thread.adapterSlug,
          channelId: thread.channelId,
          roomId: thread.roomId,
          created: thread.created ?? false,
        },
        room: thread.roomId
          ? { id: thread.roomId, type: "dm" }
          : null,
      });
    } catch (err) {
      const code = err?.code || "open_dm_failed";
      const status = code === "user_blocked" || code === "DM_CREATE_FAILED" ? 403 : 400;
      return json({ error: code, message: String(err?.message || err) }, { status });
    }
  }

  return null;
}
