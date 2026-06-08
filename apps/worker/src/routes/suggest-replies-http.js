/**
 * Suggest replies (P12-D) — AI-powered inline reply suggestions.
 *
 * @returns {Promise<Response|null>}
 *
 *   POST /messages/suggest-replies
 *   body (JSON):
 *     - roomId       (string, required)  target room id
 *     - parentId     (number, optional)  reply target message id
 *   auth: Bearer JWT
 *
 *   200 → { suggestions: string[] }
 *   400 → missing/invalid input
 *   401 → no/invalid JWT
 *   402 → quota exceeded
 *   429 → rate limit
 *   502 → AI provider failure
 *   503 → AI not configured / LLM not allowed for project
 */
import { pickRouteDeps } from "./route-http-deps.js";
import { chatCompletion, isAiConfigured } from "../lib/ai-chat-completion.js";
import { FEATURE_FLAG_KEYS, requireFeatureFlag } from "../lib/feature-flags.js";
import { workerSharedLlmAllowed } from "../lib/hosted-saas-policy.js";

const CONTEXT_LIMIT = 10;
const MAX_SUGGESTIONS = 3;

export async function dispatchSuggestRepliesRoutes(request, url, h) {
  if (url.pathname !== "/messages/suggest-replies" || request.method !== "POST") {
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

  // 1. Auth
  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const suggestionsFlag = await requireFeatureFlag(
    env,
    FEATURE_FLAG_KEYS.REPLY_SUGGESTIONS,
    { userId: auth.userId, projectId: auth.projectId },
  );
  if (!suggestionsFlag.ok) {
    return json(
      { error: suggestionsFlag.error, flag: suggestionsFlag.flag },
      { status: 503, headers: corsHeaders },
    );
  }

  // 2. AI availability
  if (!workerSharedLlmAllowed(env, auth.projectId)) {
    return json(
      { error: "ai_not_available" },
      { status: 503, headers: corsHeaders },
    );
  }
  if (!isAiConfigured(env)) {
    return json(
      { error: "ai_not_configured" },
      { status: 503, headers: corsHeaders },
    );
  }

  // 3. Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json body" }, { status: 400, headers: corsHeaders });
  }

  const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
  if (!isValidId(roomId)) {
    return json({ error: "roomId required" }, { status: 400, headers: corsHeaders });
  }

  const parentId =
    body.parentId != null ? Number(body.parentId) : null;
  if (body.parentId != null && (!Number.isFinite(parentId) || parentId <= 0)) {
    return json(
      { error: "parentId must be a positive integer" },
      { status: 400, headers: corsHeaders },
    );
  }

  const allowed = await canAccessRoom(env, auth, roomId);
  if (!allowed) {
    return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  // 4. Quota (reuse agent invocations metric — cheap AI call)
  const quotaResult = await checkAndConsumeProjectQuota(env, {
    projectId: auth.projectId,
    metric: "agent_invocations",
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

  // 5. Rate limit
  const rate = await checkAndConsumeRateLimit(env, {
    key: `suggest:${auth.projectId}:${auth.userId}:${roomId}`,
    limit: Number(env.RATE_LIMIT_SUGGEST_REPLIES_PER_MINUTE || 20),
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return json(
      { error: "rate_limit_exceeded", retryAfterSeconds: rate.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds), ...corsHeaders } },
    );
  }

  // 6. Fetch last N messages for context
  const rows = await env.DB.prepare(
    "SELECT user_id, content, created_at FROM messages WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ?",
  )
    .bind(auth.projectId, roomId, CONTEXT_LIMIT)
    .all();

  const messages = (rows.results || []).reverse();
  if (!messages.length) {
    return json({ suggestions: [] }, { status: 200, headers: corsHeaders });
  }

  // If parentId is specified, find that message for additional context
  let parentContent = "";
  if (parentId) {
    const parentRow = await env.DB.prepare(
      "SELECT user_id, content FROM messages WHERE project_id = ? AND room_id = ? AND id = ? AND deleted_at IS NULL LIMIT 1",
    )
      .bind(auth.projectId, roomId, parentId)
      .first();
    if (parentRow) {
      parentContent = `\nThe user is replying to ${parentRow.user_id}: "${String(parentRow.content || "").slice(0, 200)}"`;
    }
  }

  // 7. Build prompt
  const transcript = messages
    .map((m) => `${m.user_id}: ${String(m.content || "").replace(/\s+/g, " ").slice(0, 200)}`)
    .join("\n");

  const systemPrompt = [
    `You generate short reply suggestions for a chat app.`,
    `Return exactly ${MAX_SUGGESTIONS} concise reply options as a JSON array of strings.`,
    `Each suggestion must be under 80 characters, conversational, and contextually relevant.`,
    `Return ONLY the JSON array, no explanation or markdown fences.`,
    `If there is nothing meaningful to suggest, return an empty array: []`,
  ].join(" ");

  const userPrompt = [
    `Here are the last ${messages.length} messages in the conversation:`,
    "",
    transcript,
    parentContent,
    "",
    `Generate ${MAX_SUGGESTIONS} short reply suggestions for what a user might say next.`,
  ].join("\n");

  const ai = await chatCompletion(env, {
    model: env.AI_SUGGEST_MODEL || env.AI_MODEL || "openai/gpt-4o-mini",
    maxTokens: 128,
    temperature: 0.7,
    logContext: { ...requestLogCtx, projectId: auth.projectId, feature: "suggest_replies" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  if (!ai.ok) {
    return json(
      { error: "ai_provider_failed" },
      { status: 502, headers: corsHeaders },
    );
  }

  const suggestions = parseSuggestions(ai.content);

  return json(
    { suggestions },
    { status: 200, headers: corsHeaders },
  );
}

/**
 * Parse the AI response into a clean string array.
 * Handles JSON arrays, markdown-fenced JSON, and plain text fallback.
 */
function parseSuggestions(raw) {
  if (!raw) return [];
  // Strip markdown fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((s) => typeof s === "string" && s.trim())
        .map((s) => s.trim().slice(0, 120))
        .slice(0, MAX_SUGGESTIONS);
    }
  } catch {
    // fall through
  }
  return [];
}
