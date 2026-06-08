import { validateMessageContent } from "./message-validation.js";

/**
 * Inbound message pipeline (validate → filter → enrich) before persist/broadcast.
 * Env:
 * - MESSAGE_MIDDLEWARE_BLOCK_ON_MATCH — when true, block send if BUILTIN_MODERATION substring hits
 * - BUILTIN_MODERATION_BLOCKED_SUBSTRINGS — comma-separated (shared with post-message scan)
 * - MESSAGE_MIDDLEWARE_ENRICH_TAG — optional prefix tag in content metadata (stored in broadcast only via meta)
 */

function blockedSubstrings(env) {
  const raw = env.BUILTIN_MODERATION_BLOCKED_SUBSTRINGS || "";
  return raw
    .split(",")
    .map((t) => String(t).trim().toLowerCase())
    .filter(Boolean);
}

function findBlockedToken(content, tokens) {
  if (!tokens.length) return null;
  const hay = String(content).toLowerCase();
  return tokens.find((tok) => hay.includes(tok)) || null;
}

/**
 * @returns {Promise<{ ok: true, content: string, meta?: Record<string, unknown> } | { ok: false, code: string, error: string }>}
 */
export async function runInboundMessageMiddleware(env, ctx) {
  const validation = validateMessageContent(ctx.content);
  if (!validation.valid) {
    return { ok: false, code: "invalid_content", error: validation.error };
  }

  let content = validation.content;
  const meta = {};

  const blockOnMatch =
    env.MESSAGE_MIDDLEWARE_BLOCK_ON_MATCH === "true" ||
    env.MESSAGE_MIDDLEWARE_BLOCK_ON_MATCH === "1";
  const tokens = blockedSubstrings(env);
  const hit = findBlockedToken(content, tokens);
  if (hit && blockOnMatch) {
    return {
      ok: false,
      code: "content_blocked",
      error: "Message blocked by content policy.",
    };
  }
  if (hit) {
    meta.moderationHint = `matched:${hit.slice(0, 80)}`;
  }

  const tag = String(env.MESSAGE_MIDDLEWARE_ENRICH_TAG || "").trim();
  if (tag) {
    meta.enrichTag = tag;
  }

  return { ok: true, content, meta: Object.keys(meta).length ? meta : undefined };
}
