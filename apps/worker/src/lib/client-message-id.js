const CLIENT_MESSAGE_ID_MAX = 128;
const CLIENT_MESSAGE_ID_RE = /^[a-zA-Z0-9_-]{8,128}$/;

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeClientMessageId(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > CLIENT_MESSAGE_ID_MAX) return null;
  if (!CLIENT_MESSAGE_ID_RE.test(trimmed)) return null;
  return trimmed;
}
