/**
 * Secret keys (`fc_`) mint member JWTs. Publishable keys (`pk_`) are safe in a
 * SPA: guest-session and anonymous tokens only.
 */

export function isPublishableApiKey(key) {
  return typeof key === "string" && key.startsWith("pk_");
}

export function isSecretApiKey(key) {
  return typeof key === "string" && key.startsWith("fc_");
}

/**
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
export function assertSecretApiKey(key) {
  if (isPublishableApiKey(key)) {
    return {
      ok: false,
      status: 403,
      error: "publishable_key_not_allowed",
    };
  }
  return { ok: true };
}
