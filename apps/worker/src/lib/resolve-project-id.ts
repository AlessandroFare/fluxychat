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
}

/**
 * Resolve project id from API key header/query. Self-host may fall back to DEFAULT_PROJECT_ID.
 * Hosted multi-tenant mode never falls back — returns null when the key is missing/invalid.
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
    return env.DEFAULT_PROJECT_ID || "default";
  }

  const keyHash = await hashApiKey(headerKey);
  const row = await env.DB.prepare(
    "SELECT project_id FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL LIMIT 1",
  )
    .bind(keyHash)
    .first<{ project_id?: string }>();
  if (row?.project_id) return row.project_id;

  logInfo("auth.api_key_not_found_hash", { keyHashPrefix: keyHash.slice(0, 8) });
  if (isHostedMultiTenantMode(env)) return null;
  return env.DEFAULT_PROJECT_ID || "default";
}
