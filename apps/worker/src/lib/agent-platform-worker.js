/**
 * D1-backed Agent Platform configs, versions, deploys, memories (ROADMAP 3.5).
 */

function nowIso() {
  return new Date().toISOString();
}

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function rowToAgent(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    status: row.status,
    config: parseJson(row.config_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createAgentConfig(env, auth, input) {
  const name = String(input.name ?? "").trim().slice(0, 120);
  const workspaceId = String(input.workspaceId ?? "default").trim();
  if (!name) return { ok: false, error: "name_required" };
  if (!input.config || typeof input.config !== "object") {
    return { ok: false, error: "config_required" };
  }

  const id = `agent_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = nowIso();

  await env.DB.prepare(
    `INSERT INTO agent_platform_configs
     (id, project_id, workspace_id, name, status, config_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)`,
  )
    .bind(id, auth.projectId, workspaceId, name, JSON.stringify(input.config), now, now)
    .run();

  return { ok: true, agent: rowToAgent({ id, workspace_id: workspaceId, name, status: "draft", config_json: JSON.stringify(input.config), created_at: now, updated_at: now }) };
}

export async function listAgentConfigs(env, auth, filter = {}) {
  let sql = `SELECT * FROM agent_platform_configs WHERE project_id = ?`;
  const params = [auth.projectId];
  if (filter.workspaceId) {
    sql += ` AND workspace_id = ?`;
    params.push(filter.workspaceId);
  }
  if (filter.status) {
    sql += ` AND status = ?`;
    params.push(filter.status);
  }
  sql += ` ORDER BY updated_at DESC LIMIT ?`;
  params.push(Math.min(Number(filter.limit) || 50, 100));

  const rows = await env.DB.prepare(sql).bind(...params).all();
  return { ok: true, agents: (rows.results || []).map(rowToAgent) };
}

export async function getAgentConfig(env, auth, agentId) {
  const row = await env.DB.prepare(
    `SELECT * FROM agent_platform_configs WHERE project_id = ? AND id = ?`,
  )
    .bind(auth.projectId, agentId)
    .first();
  if (!row) return { ok: false, error: "not_found" };
  return { ok: true, agent: rowToAgent(row) };
}

export async function commitAgentVersion(env, auth, agentId, input) {
  const current = await getAgentConfig(env, auth, agentId);
  if (!current.ok) return current;

  const version = String(input.version ?? `v${Date.now()}`).slice(0, 32);
  const commitHash = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const id = `ver_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = nowIso();
  const config = input.config ?? current.agent.config;

  await env.DB.prepare(
    `INSERT INTO agent_platform_versions
     (id, agent_id, project_id, version, commit_hash, message, author, config_json, parent_version, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      agentId,
      auth.projectId,
      version,
      commitHash,
      input.message ? String(input.message).slice(0, 500) : null,
      String(input.author ?? auth.userId).slice(0, 64),
      JSON.stringify(config),
      input.parentVersion || null,
      now,
    )
    .run();

  await env.DB.prepare(
    `UPDATE agent_platform_configs SET config_json = ?, updated_at = ? WHERE id = ? AND project_id = ?`,
  )
    .bind(JSON.stringify(config), now, agentId, auth.projectId)
    .run();

  return {
    ok: true,
    version: {
      id,
      agentId,
      version,
      commitHash,
      message: input.message,
      author: input.author ?? auth.userId,
      config,
      parentVersion: input.parentVersion,
      createdAt: now,
    },
  };
}

export async function deployAgentVersion(env, auth, agentId, input) {
  const current = await getAgentConfig(env, auth, agentId);
  if (!current.ok) return current;

  const stage = String(input.stage ?? "dev");
  if (!["dev", "staging", "production"].includes(stage)) {
    return { ok: false, error: "invalid_stage" };
  }

  const version = String(input.version ?? "").trim();
  if (!version) return { ok: false, error: "version_required" };

  const id = `dep_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = nowIso();

  await env.DB.prepare(
    `INSERT INTO agent_platform_deploys
     (id, agent_id, project_id, stage, version, deployed_by, status, deployed_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
  )
    .bind(id, agentId, auth.projectId, stage, version, auth.userId, now)
    .run();

  await env.DB.prepare(
    `UPDATE agent_platform_configs SET status = ?, updated_at = ? WHERE id = ? AND project_id = ?`,
  )
    .bind(stage === "production" ? "production" : stage, now, agentId, auth.projectId)
    .run();

  return {
    ok: true,
    deploy: { id, agentId, stage, version, deployedBy: auth.userId, status: "active", deployedAt: now },
  };
}

export async function upsertAgentMemory(env, auth, agentId, input) {
  const current = await getAgentConfig(env, auth, agentId);
  if (!current.ok) return current;

  const userId = String(input.userId ?? auth.userId).trim();
  const memKey = String(input.key ?? "").trim().slice(0, 128);
  if (!memKey) return { ok: false, error: "key_required" };

  const id = `mem_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = nowIso();

  await env.DB.prepare(
    `INSERT INTO agent_platform_memories
     (id, agent_id, project_id, user_id, platform, mem_key, value, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(agent_id, user_id, platform, mem_key) DO UPDATE SET
       value = excluded.value,
       created_at = excluded.created_at`,
  )
    .bind(
      id,
      agentId,
      auth.projectId,
      userId,
      String(input.platform ?? "fluxy").slice(0, 32),
      memKey,
      String(input.value ?? "").slice(0, 16_384),
      now,
    )
    .run();

  return { ok: true, memory: { agentId, userId, key: memKey, value: input.value, platform: input.platform ?? "fluxy" } };
}

export async function listAgentVersions(env, auth, agentId, filter = {}) {
  const current = await getAgentConfig(env, auth, agentId);
  if (!current.ok) return current;

  const rows = await env.DB.prepare(
    `SELECT * FROM agent_platform_versions WHERE project_id = ? AND agent_id = ?
     ORDER BY created_at DESC LIMIT ?`,
  )
    .bind(auth.projectId, agentId, Math.min(Number(filter.limit) || 50, 100))
    .all();

  return {
    ok: true,
    versions: (rows.results || []).map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      version: row.version,
      commitHash: row.commit_hash,
      message: row.message,
      author: row.author,
      parentVersion: row.parent_version,
      createdAt: row.created_at,
    })),
  };
}

export async function listAgentDeploys(env, auth, agentId, filter = {}) {
  const current = await getAgentConfig(env, auth, agentId);
  if (!current.ok) return current;

  const rows = await env.DB.prepare(
    `SELECT * FROM agent_platform_deploys WHERE project_id = ? AND agent_id = ?
     ORDER BY deployed_at DESC LIMIT ?`,
  )
    .bind(auth.projectId, agentId, Math.min(Number(filter.limit) || 50, 100))
    .all();

  return {
    ok: true,
    deploys: (rows.results || []).map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      stage: row.stage,
      version: row.version,
      deployedBy: row.deployed_by,
      status: row.status,
      deployedAt: row.deployed_at,
    })),
  };
}

export async function listAgentMemories(env, auth, agentId, filter = {}) {
  const current = await getAgentConfig(env, auth, agentId);
  if (!current.ok) return current;

  let sql = `SELECT * FROM agent_platform_memories WHERE project_id = ? AND agent_id = ?`;
  const params = [auth.projectId, agentId];
  if (filter.userId) {
    sql += ` AND user_id = ?`;
    params.push(filter.userId);
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(Math.min(Number(filter.limit) || 50, 100));

  const rows = await env.DB.prepare(sql).bind(...params).all();
  return {
    ok: true,
    memories: (rows.results || []).map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      userId: row.user_id,
      platform: row.platform,
      key: row.mem_key,
      value: row.value,
      createdAt: row.created_at,
      timestamp: row.created_at,
    })),
  };
}

export async function recordAgentCost(env, auth, agentId, input) {
  const current = await getAgentConfig(env, auth, agentId);
  if (!current.ok) return current;

  const inputTokens = Number(input.inputTokens);
  const outputTokens = Number(input.outputTokens);
  const costCents = Number(input.costCents);
  const model = String(input.model ?? current.agent.config?.model ?? "unknown").slice(0, 64);
  if (!Number.isFinite(inputTokens) || inputTokens < 0 || inputTokens > 2_000_000) {
    return { ok: false, error: "input_tokens_invalid" };
  }
  if (!Number.isFinite(outputTokens) || outputTokens < 0 || outputTokens > 2_000_000) {
    return { ok: false, error: "output_tokens_invalid" };
  }
  if (!Number.isFinite(costCents) || costCents < 0 || costCents > 100_000) {
    return { ok: false, error: "cost_cents_invalid" };
  }

  const id = `cost_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO agent_platform_costs
     (id, agent_id, project_id, model, input_tokens, output_tokens, cost_cents, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, agentId, auth.projectId, model, Math.round(inputTokens), Math.round(outputTokens), Math.round(costCents), now)
    .run();

  return {
    ok: true,
    entry: {
      id,
      agentId,
      model,
      inputTokens: Math.round(inputTokens),
      outputTokens: Math.round(outputTokens),
      costCents: Math.round(costCents),
      createdAt: now,
    },
  };
}

export async function summarizeAgentCosts(env, auth, filter = {}) {
  let sql = `SELECT agent_id,
      COUNT(*) AS entries,
      SUM(input_tokens) AS total_input_tokens,
      SUM(output_tokens) AS total_output_tokens,
      SUM(cost_cents) AS total_cost_cents
     FROM agent_platform_costs WHERE project_id = ?`;
  const params = [auth.projectId];
  if (filter.agentId) {
    sql += ` AND agent_id = ?`;
    params.push(filter.agentId);
  }
  sql += ` GROUP BY agent_id LIMIT 100`;

  const rows = await env.DB.prepare(sql).bind(...params).all();
  return {
    ok: true,
    summaries: (rows.results || []).map((row) => {
      const entries = Number(row.entries) || 0;
      const totalCostCents = Number(row.total_cost_cents) || 0;
      return {
        agentId: row.agent_id,
        entries,
        totalInputTokens: Number(row.total_input_tokens) || 0,
        totalOutputTokens: Number(row.total_output_tokens) || 0,
        totalCostCents,
        avgCostPerRequest: entries ? totalCostCents / entries : 0,
      };
    }),
  };
}

const AB_METRICS = new Set([
  "click_rate",
  "resolution_rate",
  "satisfaction_score",
  "response_time",
  "custom",
]);

function normalizeAbVariants(raw) {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const variants = [];
  for (const item of raw) {
    const id = String(item?.id ?? "").trim().slice(0, 64);
    const name = String(item?.name ?? "").trim().slice(0, 80);
    const trafficPercent = Number(item?.trafficPercent);
    if (!id || !name || !Number.isFinite(trafficPercent) || trafficPercent < 0) return null;
    variants.push({
      id,
      name,
      config: item?.config && typeof item.config === "object" ? item.config : {},
      trafficPercent,
      exposures: Math.max(0, Number(item?.exposures) || 0),
      conversions: Math.max(0, Number(item?.conversions) || 0),
    });
  }
  return variants;
}

function rowToAbTest(row) {
  const variants = parseJson(row.variants_json, []);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    metric: row.metric,
    status: row.status,
    variants,
    results: variants.map((v) => ({
      variantId: v.id,
      variantName: v.name,
      exposures: v.exposures,
      conversions: v.conversions,
      conversionRate: v.exposures ? v.conversions / v.exposures : 0,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createAgentAbTest(env, auth, input) {
  const name = String(input.name ?? "").trim().slice(0, 120);
  const variants = normalizeAbVariants(input.variants);
  if (!name) return { ok: false, error: "name_required" };
  if (!variants) return { ok: false, error: "variants_min_2" };
  const metric = String(input.metric ?? "satisfaction_score");
  if (!AB_METRICS.has(metric)) return { ok: false, error: "invalid_metric" };

  const id = `ab_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO agent_platform_ab_tests
     (id, project_id, name, description, metric, status, variants_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?)`,
  )
    .bind(
      id,
      auth.projectId,
      name,
      input.description ? String(input.description).slice(0, 500) : null,
      metric,
      JSON.stringify(variants),
      now,
      now,
    )
    .run();

  return {
    ok: true,
    test: rowToAbTest({
      id,
      name,
      description: input.description ?? null,
      metric,
      status: "running",
      variants_json: JSON.stringify(variants),
      created_at: now,
      updated_at: now,
    }),
  };
}

export async function listAgentAbTests(env, auth) {
  const rows = await env.DB.prepare(
    `SELECT * FROM agent_platform_ab_tests WHERE project_id = ? ORDER BY updated_at DESC LIMIT 50`,
  )
    .bind(auth.projectId)
    .all();
  return { ok: true, tests: (rows.results || []).map(rowToAbTest) };
}

export async function runAgentAbTest(env, auth, testId) {
  const row = await env.DB.prepare(
    `SELECT * FROM agent_platform_ab_tests WHERE project_id = ? AND id = ?`,
  )
    .bind(auth.projectId, testId)
    .first();
  if (!row) return { ok: false, error: "not_found" };

  const variants = normalizeAbVariants(parseJson(row.variants_json, []));
  if (!variants) return { ok: false, error: "variants_corrupt" };

  const total = variants.reduce((sum, v) => sum + v.trafficPercent, 0) || 1;
  let rand = Math.random() * total;
  let picked = variants[variants.length - 1];
  for (const v of variants) {
    rand -= v.trafficPercent;
    if (rand <= 0) {
      picked = v;
      break;
    }
  }
  picked.exposures += 1;
  picked.conversions += 1;

  const now = nowIso();
  await env.DB.prepare(
    `UPDATE agent_platform_ab_tests SET variants_json = ?, updated_at = ? WHERE id = ? AND project_id = ?`,
  )
    .bind(JSON.stringify(variants), now, testId, auth.projectId)
    .run();

  return { ok: true, test: rowToAbTest({ ...row, variants_json: JSON.stringify(variants), updated_at: now }) };
}
