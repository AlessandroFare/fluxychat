/**
 * LLM Models Catalog — sync from models.dev API, serve from D1.
 */
const MODELS_DEV_URL = "https://models.dev/api.json";

/**
 * Fetch models.dev and insert only new providers/models — no overwrites.
 */
export async function syncModelsCatalog(env) {
  if (!env?.DB) return { synced: 0, error: "no DB" };
  const res = await fetch(MODELS_DEV_URL, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`models.dev returned ${res.status}`);

  const text = await res.text();
  let providers;
  try {
    providers = JSON.parse(text);
  } catch {
    throw new Error("models.dev returned invalid JSON");
  }

  const now = new Date().toISOString();
  const stmts = [];

  // Pre-load existing provider IDs so we only insert new ones.
  const existingProviders = new Set(
    (await env.DB.prepare("SELECT id FROM llm_providers").all()).results?.map(r => r.id) || [],
  );

  // Pre-load all existing model compound IDs (e.g. "openai/gpt-4o")
  // so we can insert only truly new models even for existing providers.
  const existingModels = new Set(
    (await env.DB.prepare("SELECT id FROM llm_models").all()).results?.map(r => r.id) || [],
  );

  let synced = 0;

  for (const [providerId, provider] of Object.entries(providers)) {
    const p = /** @type {any} */ (provider);
    const pid = p.id || providerId;
    if (!pid) continue;

    // Insert provider only if it doesn't exist yet.
    if (!existingProviders.has(pid)) {
      const logoUrl = `https://models.dev/logos/${pid}.svg`;
      stmts.push(
        env.DB.prepare(
          `INSERT INTO llm_providers (id, name, env, npm, doc, api, logo_url, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          pid,
          p.name || pid,
          p.env ? JSON.stringify(p.env) : null,
          p.npm || null,
          p.doc || null,
          p.api || null,
          logoUrl,
          now,
        ),
      );
      synced += 1;
    }

    // Model check: insert only models whose compound ID doesn't exist yet.
    const models = p.models || {};
    for (const [modelKey, model] of Object.entries(models)) {
      const m = /** @type {any} */ (model);
      const modelId = m.id || modelKey;
      if (!modelId) continue;
      const id = `${pid}/${modelId}`;

      if (existingModels.has(id)) continue;

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
      const fullData = JSON.stringify(m);

      stmts.push(
        env.DB.prepare(
          `INSERT INTO llm_models
           (id, provider_id, model_id, display_name, capabilities, cost,
            context_limit, input_limit, output_limit, modalities, status,
            release_date, knowledge_cutoff, open_weights, data, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          id, pid, modelId, displayName,
          JSON.stringify(caps), cost,
          lim.context ?? null, lim.input ?? null, lim.output ?? null,
          modals, status,
          m.release_date || null, m.knowledge || null,
          openWeights, fullData, now,
        ),
      );
      synced += 1;
    }
  }

  if (stmts.length > 0) {
    await env.DB.batch(stmts);
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
 * List providers from llm_providers.
 */
export async function listModelProviders(env) {
  if (!env?.DB) return [];
  const rows = await env.DB.prepare(
    "SELECT * FROM llm_providers ORDER BY name ASC",
  ).all();
  return (rows.results || []).map(mapProviderRow);
}

function mapModelRow(row) {
  return {
    id: row.id,
    providerId: row.provider_id,
    modelId: row.model_id,
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
    data: safeJson(row.data, null),
  };
}

function mapProviderRow(row) {
  return {
    id: row.id,
    name: row.name,
    env: safeJson(row.env, []),
    npm: row.npm,
    doc: row.doc,
    api: row.api,
    logoUrl: row.logo_url,
  };
}

function safeJson(raw, fallback) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
