import { hashApiKey, legacyHashApiKey } from "./api-key-hash.js";
import { isHostedMultiTenantMode } from "./hosted-saas-policy.js";
import { logInfo } from "./worker-log.js";

interface WorkerEnv {
  DB: {
    prepare: (query: string) => {
      bind: (...args: unknown[]) => { first: <T>() => Promise<T | null> };
    };
  };
  DEFAULT_PROJECT_ID?: string;
  HOSTED_MULTI_TENANT?: string;
  // Audit S-14: must be explicitly enabled to fall back to DEFAULT_PROJECT_ID
  // when an API key is missing or invalid in self-hosted mode.
  ALLOW_LEGACY_DEFAULT_PROJECT?: string;
}

function legacyDefaultProjectAllowed(env: WorkerEnv): boolean {
  return String(env.ALLOW_LEGACY_DEFAULT_PROJECT || "").trim() === "true";
}

/**
 * Resolve project id from API key header/query. Hosted multi-tenant mode
 * never falls back. Self-host may fall back to DEFAULT_PROJECT_ID ONLY when
 * ALLOW_LEGACY_DEFAULT_PROJECT=true is set (audit S-14).
 */
export async function resolveProjectId(
  request: Request,
  env: WorkerEnv,
): Promise<string | null> {
  const url = new URL(request.url);
  const headerKey =
    request.headers.get("X-Fluxy-Api-Key") || url.searchParams.get("apiKey");

  if (!headerKey) {
    if (isHostedMultiTenantMode(env)) return null;
    if (legacyDefaultProjectAllowed(env)) {
      return env.DEFAULT_PROJECT_ID || "default";
    }
    return null;
  }

  const hmacHash = await hashApiKey(headerKey, env);
  const legacyHash = await legacyHashApiKey(headerKey);
  // Audit S-11: prefer key_hmac (HMAC), then key_hash with HMAC or legacy SHA-256.
  const row = await env.DB.prepare(
    `SELECT project_id FROM api_keys
     WHERE revoked_at IS NULL
       AND (key_hmac = ? OR key_hash = ? OR key_hash = ?)
     ORDER BY
       CASE
         WHEN key_hmac = ? THEN 0
         WHEN key_hash = ? THEN 1
         ELSE 2
       END
     LIMIT 1`,
  )
    .bind(hmacHash, hmacHash, legacyHash, hmacHash, hmacHash)
    .first<{ project_id?: string }>();
  if (row?.project_id) return row.project_id;

  logInfo("auth.api_key_not_found_hash", { keyHashPrefix: hmacHash.slice(0, 8) });
  if (isHostedMultiTenantMode(env)) return null;
  if (legacyDefaultProjectAllowed(env)) {
    return env.DEFAULT_PROJECT_ID || "default";
  }
  return null;
}
