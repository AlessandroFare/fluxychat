import { hashApiKey } from "./api-key-hash.js";
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

  const keyHash = await hashApiKey(headerKey, env);
  // Audit S-11: try the new HMAC column first, then fall back to legacy SHA-256.
  const row = await env.DB.prepare(
    "SELECT project_id FROM api_keys WHERE (key_hmac = ? OR key_hash = ?) AND revoked_at IS NULL ORDER BY (key_hmac = ?) DESC LIMIT 1"
  )
    .bind(keyHash, keyHash, keyHash)
    .first<{ project_id?: string }>();
  if (row?.project_id) return row.project_id;

  logInfo("auth.api_key_not_found_hash", { keyHashPrefix: keyHash.slice(0, 8) });
  if (isHostedMultiTenantMode(env)) return null;
  if (legacyDefaultProjectAllowed(env)) {
    return env.DEFAULT_PROJECT_ID || "default";
  }
  return null;
}
