function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const CATEGORIES = ["general", "support", "onboarding", "moderation", "analytics", "sales", "developer", "productivity"];

export async function publishAgent(env, { publisherId, name, slug, description, longDescription, category, iconUrl, configTemplate, systemPrompt, tools, integrations, pricing, pricingConfig, version, tags }) {
  if (!name || !slug || !publisherId) return { error: "name, slug, and publisherId are required" };
  if (category && !CATEGORIES.includes(category)) return { error: `category must be one of: ${CATEGORIES.join(", ")}` };

  const id = `ama_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO agent_marketplace (id, publisher_id, name, slug, description, long_description, category, icon_url, config_template, system_prompt, tools, integrations, pricing, pricing_config, version, status, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`
    )
      .bind(id, publisherId, name, slug, description || null, longDescription || null, category || "general", iconUrl || null, JSON.stringify(configTemplate || {}), systemPrompt || null, tools ? JSON.stringify(tools) : null, integrations ? JSON.stringify(integrations) : null, pricing || "free", pricingConfig ? JSON.stringify(pricingConfig) : null, version || "1.0.0", tags ? JSON.stringify(tags) : null, now, now)
      .run();
    return { id, created: true };
  } catch (err) {
    if (err.message?.includes("UNIQUE")) return { error: "slug_already_exists" };
    throw err;
  }
}

export async function updateAgent(env, { id, publisherId, name, description, longDescription, category, iconUrl, configTemplate, systemPrompt, tools, integrations, pricing, pricingConfig, version, tags }) {
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const params = [now];

  if (name !== undefined) { sets.push("name = ?"); params.push(name); }
  if (description !== undefined) { sets.push("description = ?"); params.push(description); }
  if (longDescription !== undefined) { sets.push("long_description = ?"); params.push(longDescription); }
  if (category !== undefined) { sets.push("category = ?"); params.push(category); }
  if (iconUrl !== undefined) { sets.push("icon_url = ?"); params.push(iconUrl); }
  if (configTemplate !== undefined) { sets.push("config_template = ?"); params.push(JSON.stringify(configTemplate)); }
  if (systemPrompt !== undefined) { sets.push("system_prompt = ?"); params.push(systemPrompt); }
  if (tools !== undefined) { sets.push("tools = ?"); params.push(JSON.stringify(tools)); }
  if (integrations !== undefined) { sets.push("integrations = ?"); params.push(JSON.stringify(integrations)); }
  if (pricing !== undefined) { sets.push("pricing = ?"); params.push(pricing); }
  if (pricingConfig !== undefined) { sets.push("pricing_config = ?"); params.push(JSON.stringify(pricingConfig)); }
  if (version !== undefined) { sets.push("version = ?"); params.push(version); }
  if (tags !== undefined) { sets.push("tags = ?"); params.push(JSON.stringify(tags)); }

  params.push(id, publisherId);
  const result = await env.DB.prepare(
    `UPDATE agent_marketplace SET ${sets.join(", ")} WHERE id = ? AND publisher_id = ?`
  )
    .bind(...params)
    .run();
  return { updated: result.meta?.changes || 0 };
}

export async function submitForReview(env, { id, publisherId }) {
  const result = await env.DB.prepare(
    "UPDATE agent_marketplace SET status = 'review', updated_at = ? WHERE id = ? AND publisher_id = ? AND status = 'draft'"
  )
    .bind(new Date().toISOString(), id, publisherId)
    .run();
  return { submitted: result.meta?.changes || 0 };
}

export async function reviewAgent(env, { id, status }) {
  if (!["published", "rejected"].includes(status)) return { error: "status must be published or rejected" };
  const result = await env.DB.prepare(
    "UPDATE agent_marketplace SET status = ?, updated_at = ? WHERE id = ? AND status = 'review'"
  )
    .bind(status, new Date().toISOString(), id)
    .run();
  return { reviewed: result.meta?.changes || 0 };
}

export async function getAgent(env, { id }) {
  const row = await env.DB.prepare("SELECT * FROM agent_marketplace WHERE id = ?").bind(id).first();
  return row ? mapAgentRow(row) : null;
}

export async function getAgentBySlug(env, { slug }) {
  const row = await env.DB.prepare("SELECT * FROM agent_marketplace WHERE slug = ?").bind(slug).first();
  return row ? mapAgentRow(row) : null;
}

export async function listPublisherAgents(env, { publisherId, status, limit, offset }) {
  let sql = "SELECT * FROM agent_marketplace WHERE publisher_id = ?";
  const params = [publisherId];
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(limit || 50, offset || 0);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapAgentRow);
}

export async function listAgents(env, { category, status, search, sort, limit, offset }) {
  let sql = "SELECT * FROM agent_marketplace WHERE 1=1";
  const params = [];

  if (category) { sql += " AND category = ?"; params.push(category); }
  if (status) { sql += " AND status = ?"; params.push(status); }
  if (search) { sql += " AND (name LIKE ? OR description LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }

  const sortMap = {
    popular: "install_count DESC",
    rating: "avg_rating DESC",
    newest: "created_at DESC",
    name: "name ASC",
  };
  sql += ` ORDER BY ${sortMap[sort] || "featured DESC, install_count DESC"}`;
  sql += " LIMIT ? OFFSET ?";
  params.push(limit || 50, offset || 0);

  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapAgentRow);
}

export async function installAgent(env, { agentId, projectId, installedBy, configOverride }) {
  const agent = await getAgent(env, { id: agentId });
  if (!agent) return { error: "agent_not_found" };
  if (agent.status !== "published") return { error: "agent_not_published" };

  const id = `amai_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO agent_marketplace_installs (id, agent_id, project_id, installed_by, config_override, enabled, installed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
    )
      .bind(id, agentId, projectId, installedBy, configOverride ? JSON.stringify(configOverride) : null, now, now)
      .run();

    await env.DB.prepare(
      "UPDATE agent_marketplace SET install_count = install_count + 1 WHERE id = ?"
    )
      .bind(agentId)
    .run();

    return { id, installed: true };
  } catch (err) {
    if (err.message?.includes("UNIQUE")) return { error: "already_installed" };
    throw err;
  }
}

export async function uninstallAgent(env, { agentId, projectId }) {
  const result = await env.DB.prepare(
    "DELETE FROM agent_marketplace_installs WHERE agent_id = ? AND project_id = ?"
  )
    .bind(agentId, projectId)
    .run();

  if (result.meta?.changes > 0) {
    await env.DB.prepare(
      "UPDATE agent_marketplace SET install_count = MAX(0, install_count - 1) WHERE id = ?"
    )
      .bind(agentId)
    .run();
  }

  return { uninstalled: result.meta?.changes || 0 };
}

export async function listInstalledAgents(env, { projectId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM agent_marketplace_installs WHERE project_id = ? AND enabled = 1 ORDER BY installed_at DESC"
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapInstallRow);
}

export async function addReview(env, { agentId, projectId, userId, rating, title, body }) {
  if (!rating || rating < 1 || rating > 5) return { error: "rating must be 1-5" };

  const id = `amr_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(
      "INSERT INTO agent_marketplace_reviews (id, agent_id, project_id, user_id, rating, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(id, agentId, projectId, userId, rating, title || null, body || null, now)
      .run();

    const stats = await env.DB.prepare(
      "SELECT AVG(rating) as avg, COUNT(*) as count FROM agent_marketplace_reviews WHERE agent_id = ?"
    )
      .bind(agentId)
    .first();

    await env.DB.prepare(
      "UPDATE agent_marketplace SET avg_rating = ?, review_count = ? WHERE id = ?"
    )
      .bind(stats.avg, stats.count, agentId)
    .run();

    return { id, created: true };
  } catch (err) {
    if (err.message?.includes("UNIQUE")) return { error: "already_reviewed" };
    throw err;
  }
}

export async function listReviews(env, { agentId, limit }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM agent_marketplace_reviews WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?"
  )
    .bind(agentId, limit || 20)
    .all();
  return (rows.results || []).map(mapReviewRow);
}

export async function getMarketplaceStats(env) {
  const byCategory = await env.DB.prepare(
    "SELECT category, COUNT(*) as count, SUM(install_count) as installs FROM agent_marketplace WHERE status = 'published' GROUP BY category"
  )
    .all();

  const totals = await env.DB.prepare(
    "SELECT COUNT(*) as agents, SUM(install_count) as installs, AVG(avg_rating) as rating FROM agent_marketplace WHERE status = 'published'"
  )
    .first();

  return {
    totalAgents: totals?.agents || 0,
    totalInstalls: totals?.installs || 0,
    avgRating: totals?.rating ? Math.round(totals.rating * 10) / 10 : 0,
    byCategory: (byCategory.results || []).map((r) => ({ category: r.category, agents: r.count, installs: r.installs })),
  };
}

function safeJsonParse(val, fallback) {
  if (!val) return fallback;
  if (typeof val === "object") return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

function mapAgentRow(row) {
  return {
    id: row.id, publisherId: row.publisher_id, name: row.name, slug: row.slug,
    description: row.description, longDescription: row.long_description,
    category: row.category, iconUrl: row.icon_url,
    configTemplate: safeJsonParse(row.config_template, {}),
    systemPrompt: row.system_prompt,
    tools: safeJsonParse(row.tools, null),
    integrations: safeJsonParse(row.integrations, null),
    pricing: row.pricing, pricingConfig: safeJsonParse(row.pricing_config, null),
    version: row.version, status: row.status,
    installCount: row.install_count, avgRating: row.avg_rating, reviewCount: row.review_count,
    featured: row.featured === 1, tags: safeJsonParse(row.tags, []),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapInstallRow(row) {
  return {
    id: row.id, agentId: row.agent_id, projectId: row.project_id,
    installedBy: row.installed_by, configOverride: row.config_override ? JSON.parse(row.config_override) : null,
    enabled: row.enabled === 1, installedAt: row.installed_at, updatedAt: row.updated_at,
  };
}

function mapReviewRow(row) {
  return {
    id: row.id, agentId: row.agent_id, projectId: row.project_id,
    userId: row.user_id, rating: row.rating, title: row.title, body: row.body, createdAt: row.created_at,
  };
}
