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
    hasAnyRole,
    checkAndConsumeRateLimit,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "hasAnyRole",
    "checkAndConsumeRateLimit",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }
  // Audit F-90: labelling is a moderation tool (and can call the moderation
  // LLM) — gate it like the other moderation routes.
  if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
    return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  // Audit F-61/F-90: bounded body + per-user rate limit.
  const rate = await checkAndConsumeRateLimit(env, {
    key: `mod-labels:${auth.projectId}:${auth.userId}`,
    limit: Number(env.RATE_LIMIT_MODERATION_LABELS_PER_MINUTE || 60),
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return json(
      { error: "rate_limit_exceeded", retryAfterSeconds: rate.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body?.content || typeof body.content !== "string") {
    return json({ error: "content_required" }, { status: 400, headers: corsHeaders });
  }
  if (body.content.length > 20_000) {
    return json({ error: "content_too_long" }, { status: 400, headers: corsHeaders });
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
