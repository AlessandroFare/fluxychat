/** Backwards-compat SHA-256 hex digest. Used only for migrating legacy keys. */
async function legacyHashApiKey(apiKey) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(apiKey),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * HMAC-SHA-256 of the API key with a server-side salt (env `API_KEY_HASH_SALT`).
 *
 * Audit S-11: the previous SHA-256 hash was unsalted and GPU-crackable if the
 * D1 database were ever dumped. HMAC with a server-side salt makes precomputed
 * dictionary attacks infeasible (the salt never leaves the Worker).
 *
 * If `API_KEY_HASH_SALT` is not configured we still produce a per-installation
 * fallback that combines a Worker-shared value with the key  that is NOT a
 * strong guarantee and logs a warning at first use. Production deployments
 * MUST set `API_KEY_HASH_SALT` (recommended 32+ random bytes, base64-encoded).
 */
export async function hashApiKey(apiKey, env) {
  const salt = readSalt(env);
  const data = new TextEncoder().encode(`fc-apikey:${salt}:${apiKey}`);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(salt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

let warnedMissingSalt = false;
function readSalt(env) {
  const explicit = env?.API_KEY_HASH_SALT?.trim();
  if (explicit && explicit.length > 0) return explicit;
  // Fail closed in production: a missing salt makes stored key hashes
  // predictable if D1 is ever dumped. Only the local/dev fallback below is
  // permitted, and only when NODE_ENV !== "production".
  if (env?.NODE_ENV === "production") {
    throw new Error(
      "API_KEY_HASH_SALT is required in production. Set it to 32+ random bytes (base64).",
    );
  }
  if (!warnedMissingSalt) {
    warnedMissingSalt = true;
    try {
      // eslint-disable-next-line no-console
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "api_key.missing_salt_fallback",
          ts: new Date().toISOString(),
          message:
            "API_KEY_HASH_SALT is not configured; using a weak fallback. Set API_KEY_HASH_SALT in production.",
        }),
      );
    } catch {
      /* ignore */
    }
  }
  return "fluxy-default-salt-rotate-in-prod";
}

export { legacyHashApiKey };
