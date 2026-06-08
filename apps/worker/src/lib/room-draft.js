import { MAX_MESSAGE_LENGTH } from "./message-validation.js";

const DRAFT_PREF_KEY = "messageDraft";

/**
 * @param {unknown} content
 * @returns {{ valid: true, content: string } | { valid: false, error: string }}
 */
export function validateDraftContent(content) {
  if (typeof content !== "string") {
    return { valid: false, error: "content must be a string" };
  }
  if (content.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `draft exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
    };
  }
  return { valid: true, content };
}

/**
 * @param {Record<string, unknown>} preferences
 * @returns {{ content: string, replyToId: number | null, updatedAt: string } | null}
 */
export function readMessageDraftFromPreferences(preferences) {
  const raw = preferences?.[DRAFT_PREF_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const content = typeof raw.content === "string" ? raw.content : "";
  if (!content.trim()) return null;
  const replyToId =
    raw.replyToId == null || raw.replyToId === ""
      ? null
      : Number(raw.replyToId);
  const updatedAt =
    typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString();
  return {
    content,
    replyToId: Number.isFinite(replyToId) ? replyToId : null,
    updatedAt,
  };
}

/**
 * @param {Record<string, unknown>} preferences
 * @param {{ content: string, replyToId?: number | null }} draft
 * @returns {Record<string, unknown>}
 */
export function writeMessageDraftToPreferences(preferences, draft) {
  const next = { ...preferences };
  const trimmed = draft.content.trim();
  if (!trimmed) {
    delete next[DRAFT_PREF_KEY];
    return next;
  }
  next[DRAFT_PREF_KEY] = {
    content: draft.content,
    replyToId: draft.replyToId ?? null,
    updatedAt: new Date().toISOString(),
  };
  return next;
}

export { DRAFT_PREF_KEY };
