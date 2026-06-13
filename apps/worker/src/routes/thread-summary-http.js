/**
 * Thread TL;DR (P12-M) — POST /messages/:id/summary
 */
import { pickRouteDeps } from "./route-http-deps.js";
import { isAiConfigured } from "../lib/ai-chat-completion.js";
import { workerSharedLlmAllowed } from "../lib/hosted-saas-policy.js";
import { summarizeThread } from "../lib/thread-summary.js";

export async function dispatchThreadSummaryRoutes(request, url, h) {
  const match = url.pathname.match(/^\/messages\/(\d+)\/summary$/);
  if (!match || request.method !== "POST") {
    return null;
  }

  const messageId = Number(match[1]);
  if (!Number.isFinite(messageId) || messageId <= 0) {
    return null;
  }

  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    checkAndConsumeProjectQuota,
    quotaResetInfo,
    checkAndConsumeRateLimit,
    isValidId,
    canAccessRoom,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "checkAndConsumeProjectQuota",
    "quotaResetInfo",
    "checkAndConsumeRateLimit",
    "isValidId",
    "canAccessRoom",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  if (!workerSharedLlmAllowed(env, auth.projectId)) {
    return json({ error: "ai_not_available" }, { status: 503, headers: corsHeaders });
  }
  if (!isAiConfigured(env)) {
    return json({ error: "ai_not_configured" }, { status: 503, headers: corsHeaders });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
  if (!isValidId(roomId)) {
    return json({ error: "roomId required" }, { status: 400, headers: corsHeaders });
  }

  const allowed = await canAccessRoom(env, auth, roomId);
  if (!allowed) {
    return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  const quotaResult = await checkAndConsumeProjectQuota(env, {
    projectId: auth.projectId,
    metricName: "agent_invokes",
  });
  if (!quotaResult.allowed) {
    const reset = quotaResetInfo();
    return json(
      {
        error: "quota_exceeded",
        used: quotaResult.used,
        month: quotaResult.monthKey,
        resetsAt: reset.resetsAt,
        retryAfterSeconds: reset.retryAfterSeconds,
      },
      {
        status: 402,
        headers: { "Retry-After": String(reset.retryAfterSeconds), ...corsHeaders },
      },
    );
  }

  const rate = await checkAndConsumeRateLimit(env, {
    key: `thread-summary:${auth.projectId}:${auth.userId}:${roomId}`,
    limit: Number(env.RATE_LIMIT_THREAD_SUMMARY_PER_MINUTE || 10),
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return json(
      { error: "rate_limit_exceeded", retryAfterSeconds: rate.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds), ...corsHeaders } },
    );
  }

  const result = await summarizeThread(env, {
    projectId: auth.projectId,
    roomId,
    messageId,
    logContext: requestLogCtx,
  });

  if (!result.ok) {
    if (result.error === "message_not_found") {
      return json({ error: result.error }, { status: 404, headers: corsHeaders });
    }
    if (result.error === "thread_too_short") {
      return json(
        {
          error: result.error,
          messageCount: result.messageCount,
          minRequired: result.minRequired,
        },
        { status: 400, headers: corsHeaders },
      );
    }
    if (result.error === "ai_provider_failed") {
      return json({ error: result.error }, { status: 502, headers: corsHeaders });
    }
    return json({ error: result.error || "summary_failed" }, { status: 400, headers: corsHeaders });
  }

  return json(
    {
      summary: result.summary,
      rootMessageId: result.rootMessageId,
      messageCount: result.messageCount,
      truncated: result.truncated,
    },
    { status: 200, headers: corsHeaders },
  );
}
