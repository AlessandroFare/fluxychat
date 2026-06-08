import { workerSharedLlmAllowed } from "./hosted-saas-policy.js";
import { buildAiAuthHeaders, isAiConfigured, resolveAiTransport } from "./ai-gateway.js";

const LANG_RE = /^[a-z]{2}(-[A-Za-z]{2})?$/;

/**
 * @param {string} lang
 */
export function normalizeTargetLang(lang) {
  if (!lang || typeof lang !== "string") return null;
  const trimmed = lang.trim().toLowerCase();
  if (!LANG_RE.test(trimmed)) return null;
  return trimmed.split("-")[0];
}

/**
 * @param {*} env
 * @param {number} messageId
 * @param {string} targetLang
 */
export async function getCachedTranslation(env, messageId, targetLang) {
  const row = await env.DB.prepare(
    `SELECT translated_text, source_lang, created_at
     FROM message_translations WHERE message_id = ? AND target_lang = ? LIMIT 1`,
  )
    .bind(messageId, targetLang)
    .first();
  if (!row) return null;
  return {
    targetLang,
    translatedText: row.translated_text,
    sourceLang: row.source_lang,
    createdAt: row.created_at,
  };
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   messageId: number,
 *   content: string,
 *   targetLang: string,
 *   sourceLang?: string,
 * }} input
 */
export async function translateMessageContent(env, input) {
  if (!workerSharedLlmAllowed(env, input.projectId)) {
    return { ok: false, error: "translation_not_available", status: 503 };
  }
  if (!isAiConfigured(env)) {
    return { ok: false, error: "ai_not_configured", status: 503 };
  }
  const transport = resolveAiTransport(env);

  const targetLang = normalizeTargetLang(input.targetLang);
  if (!targetLang) {
    return { ok: false, error: "invalid_target_lang", status: 400 };
  }

  const cached = await getCachedTranslation(env, input.messageId, targetLang);
  if (cached) {
    return { ok: true, cached: true, translation: cached };
  }

  const sourceLang = input.sourceLang
    ? normalizeTargetLang(input.sourceLang)
    : null;
  const model = env.AI_TRANSLATE_MODEL || env.AI_MODEL || "openai/gpt-4o-mini";

  const systemPrompt = `You translate chat messages. Output ONLY the translated text in ${targetLang}, no quotes or explanation. Preserve mentions (@user) and URLs.`;

  const res = await fetch(transport.chatCompletionsUrl, {
    method: "POST",
    headers: buildAiAuthHeaders(env, {
      contentType: "application/json",
      metadata: { projectId: input.projectId, feature: "translation" },
    }),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: sourceLang
            ? `Translate from ${sourceLang} to ${targetLang}:\n\n${input.content}`
            : `Translate to ${targetLang}:\n\n${input.content}`,
        },
      ],
      max_tokens: Math.min(2000, Number(env.AI_TRANSLATE_MAX_TOKENS || 512)),
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: "translation_provider_failed",
      status: 502,
      detail: text.slice(0, 200),
    };
  }

  const json = await res.json();
  const translatedText = String(
    json.choices?.[0]?.message?.content ?? "",
  ).trim();
  if (!translatedText) {
    return { ok: false, error: "empty_translation", status: 502 };
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR REPLACE INTO message_translations
     (message_id, target_lang, translated_text, source_lang, provider, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      input.messageId,
      targetLang,
      translatedText,
      sourceLang,
      "llm",
      now,
    )
    .run();

  return {
    ok: true,
    cached: false,
    translation: {
      targetLang,
      translatedText,
      sourceLang,
      createdAt: now,
    },
  };
}
