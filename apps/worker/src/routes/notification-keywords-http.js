import { pickRouteDeps } from "./route-http-deps.js";
import {
  addNotificationKeyword,
  listNotificationKeywords,
  removeNotificationKeyword,
} from "../lib/notification-keywords.js";

/**
 * Personal keyword alerts.
 * GET    /notification-keywords
 * POST   /notification-keywords       { word }
 * DELETE /notification-keywords/:word
 */
export async function dispatchNotificationKeywordsRoutes(request, url, h) {
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

  const listMatch = url.pathname === "/notification-keywords";
  const wordMatch = url.pathname.match(/^\/notification-keywords\/([^/]+)$/);
  if (!listMatch && !wordMatch) return null;

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    if (listMatch && request.method === "GET") {
      const { keywords } = await listNotificationKeywords(env, {
        projectId: auth.projectId,
        userId: auth.userId,
      });
      return json({ keywords, count: keywords.length }, { headers: corsHeaders });
    }

    if (listMatch && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const result = await addNotificationKeyword(env, {
        projectId: auth.projectId,
        userId: auth.userId,
        word: body?.word,
      });
      if (!result.ok) {
        return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
      }
      return json(result, { status: 201, headers: corsHeaders });
    }

    if (wordMatch && request.method === "DELETE") {
      const result = await removeNotificationKeyword(env, {
        projectId: auth.projectId,
        userId: auth.userId,
        word: decodeURIComponent(wordMatch[1]),
      });
      if (!result.ok) {
        return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("notification_keywords.route_error", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
