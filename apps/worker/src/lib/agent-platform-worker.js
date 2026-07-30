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
    })),
  };
}
