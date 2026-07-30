import { pickRouteDeps } from "./route-http-deps.js";
import { labelContent } from "../lib/moderation-labels.js";

export async function dispatchModerationLabelsRoutes(request, url, h) {
  if (url.pathname !== "/moderation/labels" || request.method !== "POST") return null;

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

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const body = await request.json().catch(() => null);
  if (!body?.content || typeof body.content !== "string") {
    return json({ error: "content_required" }, { status: 400, headers: corsHeaders });
  }

  const result = await labelContent(env, {
    content: body.content,
    projectId: auth.projectId,
    roomId: body.roomId,
    userId: body.userId || auth.userId,
    useAi: body.useAi === true,
  });

  return json(result, { headers: corsHeaders });
}
