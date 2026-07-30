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

/**
 * Stable id for external channel messages (Matrix, Slack, SMS, …).
 * Sanitizes when possible; otherwise FNV-1a hash under `{scope}_`.
 * @param {string} scope
 * @param {string} externalId
 * @returns {string | null}
 */
export function deriveScopedClientMessageId(scope, externalId) {
  if (!scope || externalId == null || externalId === "") return null;
  const safeScope = String(scope).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32);
  const sanitized = `${safeScope}_${String(externalId).replace(/[^a-zA-Z0-9_-]/g, "_")}`.slice(0, CLIENT_MESSAGE_ID_MAX);
  const normalized = normalizeClientMessageId(sanitized);
  if (normalized) return normalized;

  let hash = 2166136261;
  const input = `${safeScope}:${externalId}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hashed = `${safeScope}_${(hash >>> 0).toString(16).padStart(8, "0")}`;
  return normalizeClientMessageId(hashed) ?? hashed.slice(0, CLIENT_MESSAGE_ID_MAX);
}
