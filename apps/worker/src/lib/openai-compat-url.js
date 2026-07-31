/** Strip trailing slashes without regex (avoids ReDoS on hostile URLs). */
export function trimTrailingSlashes(url) {
  let out = String(url || "").trim();
  while (out.endsWith("/")) out = out.slice(0, -1);
  return out;
}

/**
 * Build an OpenAI-compatible chat/completions URL from a base URL.
 * Accepts bases with or without a trailing `/v1` (e.g. OpenCode Zen).
 *
 * @param {string|null|undefined} baseUrl
 * @param {string|null|undefined} [overrideUrl]
 * @returns {string}
 */
export function buildOpenAiChatCompletionsUrl(baseUrl, overrideUrl) {
  const override = String(overrideUrl || "").trim();
  if (override) return override;

  const normalized = trimTrailingSlashes(baseUrl);
  if (!normalized) return "";

  const openAiCompatBase = normalized.endsWith("/v1")
    ? normalized
    : `${normalized}/v1`;
  return `${openAiCompatBase}/chat/completions`;
}
