/** Default max TTL: 7 days. Override with MESSAGE_TTL_MAX_SECONDS. */
export const DEFAULT_MESSAGE_TTL_MAX_SECONDS = 7 * 24 * 60 * 60;

const MIN_TTL_SECONDS = 60;

/**
 * @param {unknown} env
 * @returns {number}
 */
export function getMessageTtlMaxSeconds(env) {
  const raw = Number(env?.MESSAGE_TTL_MAX_SECONDS);
  if (Number.isFinite(raw) && raw >= MIN_TTL_SECONDS) return Math.floor(raw);
  return DEFAULT_MESSAGE_TTL_MAX_SECONDS;
}

/**
 * @param {unknown} body
 * @param {unknown} env
 * @returns {{ ok: true, expiresAt: string | null } | { ok: false, error: string }}
 */
export function resolveMessageExpiry(body, env) {
  if (!body || typeof body !== "object") {
    return { ok: true, expiresAt: null };
  }
  const maxSeconds = getMessageTtlMaxSeconds(env);
  let expiresAt = null;

  if (body.expiresAt != null && body.expiresAt !== "") {
    const parsed = Date.parse(String(body.expiresAt));
    if (!Number.isFinite(parsed)) {
      return { ok: false, error: "invalid expiresAt" };
    }
    const deltaMs = parsed - Date.now();
    if (deltaMs < MIN_TTL_SECONDS * 1000) {
      return { ok: false, error: "expiresAt must be in the future" };
    }
    if (deltaMs > maxSeconds * 1000) {
      return { ok: false, error: `expiresAt exceeds max TTL (${maxSeconds}s)` };
    }
    expiresAt = new Date(parsed).toISOString();
  } else if (body.expiresInSeconds != null && body.expiresInSeconds !== "") {
    const seconds = Number(body.expiresInSeconds);
    if (!Number.isFinite(seconds) || seconds < MIN_TTL_SECONDS) {
      return { ok: false, error: `expiresInSeconds must be >= ${MIN_TTL_SECONDS}` };
    }
    if (seconds > maxSeconds) {
      return { ok: false, error: `expiresInSeconds exceeds max (${maxSeconds}s)` };
    }
    expiresAt = new Date(Date.now() + seconds * 1000).toISOString();
  }

  return { ok: true, expiresAt };
}
