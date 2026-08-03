/**
 * Per-project semantic search settings layered on SEMANTIC_SEARCH_ENABLED env flag.
 */

export function isSemanticSearchGloballyEnabled(env) {
  return env.SEMANTIC_SEARCH_ENABLED === "true" || env.SEMANTIC_SEARCH_ENABLED === "1";
}

/**
 * @param {object} env
 * @param {string} projectId
 * @returns {Promise<{
 *   globalEnabled: boolean,
 *   enabled: boolean,
 *   autoEmbed: boolean,
 *   defaultMode: 'keyword' | 'hybrid' | 'semantic',
 *   embeddingCount: number,
 *   updatedAt: string | null,
 *   available: boolean,
 * }>}
 */
export async function getSemanticSearchSettings(env, projectId) {
  const globalEnabled = isSemanticSearchGloballyEnabled(env);

  const row = await env.DB.prepare(
    `SELECT enabled, auto_embed, default_mode, updated_at
     FROM project_semantic_search WHERE project_id = ?`,
  )
    .bind(projectId)
    .first();

  const countRow = await env.DB.prepare(
    "SELECT COUNT(*) AS cnt FROM message_embeddings WHERE project_id = ?",
  )
    .bind(projectId)
    .first();

  const embeddingCount = Number(countRow?.cnt ?? 0);
  const projectEnabled = row ? row.enabled === 1 : true;
  const autoEmbed = row ? row.auto_embed === 1 : true;
  const defaultMode = row?.default_mode || "hybrid";

  return {
    globalEnabled,
    enabled: projectEnabled,
    autoEmbed,
    defaultMode,
    embeddingCount,
    updatedAt: row?.updated_at ?? null,
    available: globalEnabled && projectEnabled,
  };
}

/**
 * @param {Awaited<ReturnType<typeof getSemanticSearchSettings>>} settings
 */
export function isSemanticSearchActive(settings) {
  return settings.globalEnabled && settings.enabled;
}

/**
 * @param {object} env
 * @param {string} projectId
 * @returns {Promise<boolean>}
 */
export async function shouldAutoEmbedMessage(env, projectId) {
  if (!isSemanticSearchGloballyEnabled(env)) return false;
  const settings = await getSemanticSearchSettings(env, projectId);
  return isSemanticSearchActive(settings) && settings.autoEmbed;
}

/**
 * @param {object} env
 * @param {string} projectId
 * @param {{ enabled?: boolean, autoEmbed?: boolean, defaultMode?: string }} input
 */
export async function upsertSemanticSearchSettings(env, projectId, input) {
  const current = await getSemanticSearchSettings(env, projectId);
  const enabled = input.enabled !== undefined ? (input.enabled ? 1 : 0) : (current.enabled ? 1 : 0);
  const autoEmbed =
    input.autoEmbed !== undefined ? (input.autoEmbed ? 1 : 0) : (current.autoEmbed ? 1 : 0);
  const defaultMode = input.defaultMode || current.defaultMode;
  if (!["keyword", "hybrid", "semantic"].includes(defaultMode)) {
    return { ok: false, error: "invalid_default_mode" };
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO project_semantic_search (project_id, enabled, auto_embed, default_mode, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(project_id) DO UPDATE SET
       enabled = excluded.enabled,
       auto_embed = excluded.auto_embed,
       default_mode = excluded.default_mode,
       updated_at = excluded.updated_at`,
  )
    .bind(projectId, enabled, autoEmbed, defaultMode, now)
    .run();

  return { ok: true, settings: await getSemanticSearchSettings(env, projectId) };
}
