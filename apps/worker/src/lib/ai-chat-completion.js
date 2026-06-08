import { logError } from "./worker-log.js";
import {
  buildAiAuthHeaders,
  isAiConfigured,
  resolveAiTransport,
} from "./ai-gateway.js";

export { isAiConfigured };

/**
 * OpenAI-compatible chat completion helper (P12-B/D/F/I shared path).
 *
 * @param {*} env
 * @param {{
 *   messages: Array<{ role: string, content: string }>,
 *   model?: string,
 *   maxTokens?: number,
 *   temperature?: number,
 *   logContext?: Record<string, unknown>,
 *   metadata?: Record<string, unknown>,
 * }} input
 * @returns {Promise<{ ok: true, content: string } | { ok: false, status?: number, error: string }>}
 */
export async function chatCompletion(env, input) {
  const transport = resolveAiTransport(env);
  if (!transport.configured || !transport.chatCompletionsUrl) {
    return { ok: false, error: "ai_not_configured" };
  }

  const model =
    input.model ||
    env.AI_DIGEST_MODEL ||
    env.AI_SUGGEST_MODEL ||
    env.AI_MODEL ||
    "openai/gpt-4o-mini";

  const res = await fetch(transport.chatCompletionsUrl, {
    method: "POST",
    headers: buildAiAuthHeaders(env, {
      contentType: "application/json",
      metadata: {
        ...(input.metadata || {}),
        ...(input.logContext?.projectId ? { projectId: input.logContext.projectId } : {}),
        feature: input.logContext?.feature || input.metadata?.feature || "chat_completion",
      },
    }),
    body: JSON.stringify({
      model,
      messages: input.messages,
      max_tokens: input.maxTokens ?? 256,
      temperature: input.temperature ?? 0.4,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logError("ai.chat_completion_failed", new Error(`AI status ${res.status}`), {
      ...(input.logContext || {}),
      aiStatus: res.status,
      aiBody: text.slice(0, 200),
      aiMode: transport.mode,
    });
    return { ok: false, status: res.status, error: "ai_provider_failed" };
  }

  const json = await res.json();
  const content = String(json.choices?.[0]?.message?.content ?? "").trim();
  return { ok: true, content };
}
