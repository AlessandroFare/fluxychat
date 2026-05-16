import { LLM_PROVIDER_REGISTRY } from "./llm-providers.js";
import {
  decryptSecret,
  encryptSecret,
  maskSecretPreview,
} from "./secrets-crypto.js";

/**
 * @param {import("@cloudflare/workers-types").D1Database} db
 * @param {string} projectId
 */
export async function listProjectLlmCredentials(env, projectId) {
  const rows = await env.DB.prepare(
    "SELECT provider_id, api_key_ciphertext, api_key_iv, base_url, updated_at FROM project_llm_credentials WHERE project_id = ? ORDER BY provider_id"
  )
    .bind(projectId)
    .all();

  return (rows.results || []).map((row) => ({
    providerId: row.provider_id,
    label: LLM_PROVIDER_REGISTRY[row.provider_id]?.label || row.provider_id,
    hasApiKey: !!(row.api_key_ciphertext && row.api_key_iv),
    apiKeyPreview: row.api_key_ciphertext ? "••••configured" : null,
    baseUrl: row.base_url || null,
    updatedAt: row.updated_at,
    source: "project",
  }));
}

/**
 * @param {import("@cloudflare/workers-types").D1Database} env
 * @param {string} projectId
 * @param {string} providerId
 */
export async function getProjectLlmCredential(env, projectId, providerId) {
  const row = await env.DB.prepare(
    "SELECT api_key_ciphertext, api_key_iv, base_url FROM project_llm_credentials WHERE project_id = ? AND provider_id = ?"
  )
    .bind(projectId, providerId)
    .first();

  if (!row) return null;

  let apiKey = null;
  if (row.api_key_ciphertext && row.api_key_iv) {
    apiKey = await decryptSecret(env, row.api_key_ciphertext, row.api_key_iv);
  }

  return {
    apiKey,
    baseUrl: row.base_url ? String(row.base_url).trim() : null,
  };
}

/**
 * @param {import("@cloudflare/workers-types").D1Database} env
 * @param {string} projectId
 * @param {string} providerId
 * @param {{ apiKey?: string|null, baseUrl?: string|null, clearApiKey?: boolean }} body
 */
export async function upsertProjectLlmCredential(env, projectId, providerId, body) {
  const id = providerId.trim().toLowerCase();
  if (!LLM_PROVIDER_REGISTRY[id] && id !== "custom") {
    throw new Error("unknown_provider");
  }

  const now = new Date().toISOString();
  const existing = await env.DB.prepare(
    "SELECT api_key_ciphertext, api_key_iv, base_url FROM project_llm_credentials WHERE project_id = ? AND provider_id = ?"
  )
    .bind(projectId, id)
    .first();

  let ciphertext = existing?.api_key_ciphertext ?? null;
  let iv = existing?.api_key_iv ?? null;

  if (body.clearApiKey) {
    ciphertext = null;
    iv = null;
  } else if (typeof body.apiKey === "string" && body.apiKey.trim()) {
    const enc = await encryptSecret(env, body.apiKey.trim());
    if (!enc) {
      throw new Error("encryption_not_configured");
    }
    ciphertext = enc.ciphertext;
    iv = enc.iv;
  }

  const baseUrl =
    body.baseUrl === null
      ? null
      : typeof body.baseUrl === "string"
        ? body.baseUrl.trim() || null
        : existing?.base_url ?? null;

  await env.DB.prepare(
    `INSERT INTO project_llm_credentials (project_id, provider_id, api_key_ciphertext, api_key_iv, base_url, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, provider_id) DO UPDATE SET
       api_key_ciphertext = excluded.api_key_ciphertext,
       api_key_iv = excluded.api_key_iv,
       base_url = excluded.base_url,
       updated_at = excluded.updated_at`
  )
    .bind(projectId, id, ciphertext, iv, baseUrl, now)
    .run();

  return {
    providerId: id,
    hasApiKey: !!(ciphertext && iv),
    apiKeyPreview:
      typeof body.apiKey === "string" && body.apiKey.trim()
        ? maskSecretPreview(body.apiKey.trim())
        : ciphertext
          ? "••••configured"
          : null,
    baseUrl,
    updatedAt: now,
  };
}

export async function deleteProjectLlmCredential(env, projectId, providerId) {
  await env.DB.prepare(
    "DELETE FROM project_llm_credentials WHERE project_id = ? AND provider_id = ?"
  )
    .bind(projectId, providerId.trim().toLowerCase())
    .run();
}
