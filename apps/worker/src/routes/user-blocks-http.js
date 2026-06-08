/**
 * User block list HTTP (P10-SB5).
 * @returns {Promise<Response|null>}
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  blockUser,
  unblockUser,
  listBlockedUsers,
} from "../lib/user-blocks.js";

export async function dispatchUserBlocksRoutes(request, url, h) {
  const {
    env,
    corsHeaders,
    json,
    verifyJwtAndGetContext,
    logError,
    requestLogCtx,
  } = pickRouteDeps(h, [
    "env",
    "corsHeaders",
    "json",
    "verifyJwtAndGetContext",
    "logError",
    "requestLogCtx",
  ]);

  if (url.pathname === "/blocks" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const blocks = await listBlockedUsers(env, auth.projectId, auth.userId);
    return json({ blocks });
  }

  if (url.pathname === "/blocks" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const body = await request.json().catch(() => null);
    const targetUserId =
      typeof body?.userId === "string"
        ? body.userId.trim()
        : typeof body?.targetUserId === "string"
          ? body.targetUserId.trim()
          : "";
    if (!targetUserId) {
      return json({ error: "userId required" }, { status: 400 });
    }
    const result = await blockUser(env, auth.projectId, auth.userId, targetUserId);
    if (!result.ok) {
      return json({ error: result.error }, { status: 400 });
    }
    return json(result);
  }

  const unblockMatch = url.pathname.match(/^\/blocks\/([^/]+)$/);
  if (unblockMatch && request.method === "DELETE") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const targetUserId = decodeURIComponent(unblockMatch[1]);
    await unblockUser(env, auth.projectId, auth.userId, targetUserId);
    return json({ ok: true });
  }

  return null;
}
