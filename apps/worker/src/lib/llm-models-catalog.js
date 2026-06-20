/**
 * LLM Models Catalog — sync from models.dev API, serve from D1.
 */
const MODELS_DEV_URL = "https://models.dev/api.json";

/**
 * Fetch models.dev and upsert into D1.
 */
export async function syncModelsCatalog(env) {
  if (!env?.DB) return { synced: 0, error: "no DB" };
  const res = await fetch(MODELS_DEV_URL);
  if (!res.ok) throw new Error(`models.dev returned ${res.status}`);

  const data = await res.json();
  const providers = data.providers || data.data || [];
  let synced = 0;
  const now = new Date().toISOString();

  for (const provider of Object.values(providers)) {
    const p = /** @type {any} */ (provider);
    const providerId = p.id || p.provider_id;
    const providerName = p.name || providerId;
    if (!providerId) continue;

    const models = p.models || {};
    for (const [modelKey, model] of Object.entries(/** @type {any} */ (models))) {
      const m = /** @type {any} */ (model);
      const modelId = m.id || modelKey;
      if (!modelId) continue;
      const id = `${providerId}/${modelId}`;
      const displayName = m.name || modelId;

      const caps = {
        tool_call: !!m.tool_call,
        reasoning: !!m.reasoning,
        structured_output: !!m.structured_output,
        attachment: !!m.attachment,
        temperature: m.temperature !== false,
        streaming: true,
      };

      const cost = m.cost ? JSON.stringify(m.cost) : null;
      const lim = m.limit || {};
      const modals = m.modalities ? JSON.stringify(m.modalities) : null;
      const status = m.status || "active";
      const openWeights = m.open_weights ? 1 : 0;

      await env.DB.prepare(
        `INSERT OR REPLACE INTO llm_models
         (id, provider_id, model_id, provider_name, display_name, capabilities, cost,
          context_limit, input_limit, output_limit, modalities, status,
          release_date, knowledge_cutoff, open_weights, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id, providerId, modelId, providerName, displayName,
          JSON.stringify(caps), cost,
          lim.context ?? null, lim.input ?? null, lim.output ?? null,
          modals, status,
          m.release_date || null, m.knowledge || null,
          openWeights, now,
        )
        .run();
      synced += 1;
    }
  }

  return { synced, at: now };
}

/**
 * Query llm_models from D1.
 */
export async function queryModelsCatalog(env, opts = {}) {
  if (!env?.DB) return [];
  const { search, provider, capability, limit = 50 } = opts;
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push("(provider_id LIKE ? OR model_id LIKE ? OR display_name LIKE ?)");
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (provider) {
    conditions.push("provider_id = ?");
    params.push(provider);
  }
  if (capability) {
    conditions.push("json_extract(capabilities, ?) = 'true'");
    params.push(`$.${capability}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT * FROM llm_models ${where} ORDER BY provider_id, display_name ASC LIMIT ?`;
  params.push(Math.min(limit, 200));

  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapModelRow);
}

/**
 * Get a single model by compound ID (e.g. "openai/gpt-4o").
 */
export async function getModelById(env, id) {
  if (!env?.DB || !id) return null;
  const row = await env.DB.prepare("SELECT * FROM llm_models WHERE id = ?").bind(id).first();
  return row ? mapModelRow(row) : null;
}

/**
 * List unique provider IDs and names.
 */
export async function listModelProviders(env) {
  if (!env?.DB) return [];
  const rows = await env.DB.prepare(
    "SELECT DISTINCT provider_id, provider_name FROM llm_models WHERE status != 'deprecated' ORDER BY provider_name ASC",
  ).all();
  return (rows.results || []).map((r) => ({ id: r.provider_id, name: r.provider_name }));
}

function mapModelRow(row) {
  return {
    id: row.id,
    providerId: row.provider_id,
    modelId: row.model_id,
    providerName: row.provider_name,
    displayName: row.display_name,
    capabilities: safeJson(row.capabilities, {}),
    cost: safeJson(row.cost, null),
    contextLimit: row.context_limit,
    inputLimit: row.input_limit,
    outputLimit: row.output_limit,
    modalities: safeJson(row.modalities, null),
    status: row.status,
    releaseDate: row.release_date,
    knowledgeCutoff: row.knowledge_cutoff,
    openWeights: row.open_weights === 1,
  };
}

function safeJson(raw, fallback) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
