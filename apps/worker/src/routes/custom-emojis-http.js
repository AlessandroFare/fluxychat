import { pickRouteDeps } from "./route-http-deps.js";
import {
  createCustomEmoji,
  deleteCustomEmoji,
  listCustomEmojis,
} from "../lib/custom-emoji.js";

/**
 * Custom emoji registry.
 * GET    /custom-emojis
 * POST   /custom-emojis            (admin)
 * DELETE /custom-emojis/:id        (admin)
 */
export async function dispatchCustomEmojisRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    hasAnyRole,
    logError,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "logError",
  ]);

  const listMatch = url.pathname === "/custom-emojis";
  const itemMatch = url.pathname.match(/^\/custom-emojis\/([^/]+)$/);
  if (!listMatch && !itemMatch) return null;

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    if (listMatch && request.method === "GET") {
      const { emojis } = await listCustomEmojis(env, { projectId: auth.projectId });
      return json({ emojis, count: emojis.length }, { headers: corsHeaders });
    }

    const isAdmin = hasAnyRole(auth.roles || [], ["owner", "admin"]);

    if (listMatch && request.method === "POST") {
      if (!isAdmin) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      const body = await request.json().catch(() => null);
      const result = await createCustomEmoji(env, {
        projectId: auth.projectId,
        name: body?.name,
        imageUrl: body?.imageUrl ?? body?.image_url,
        createdBy: auth.userId,
      });
      if (!result.ok) {
        return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
      }
      return json(result, { status: 201, headers: corsHeaders });
    }

    if (itemMatch && request.method === "DELETE") {
      if (!isAdmin) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      const result = await deleteCustomEmoji(env, {
        projectId: auth.projectId,
        id: decodeURIComponent(itemMatch[1]),
      });
      if (!result.ok) {
        return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("custom_emojis.route_error", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
