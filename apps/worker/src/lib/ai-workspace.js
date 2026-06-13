function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const DEFAULT_TABS = ["chat", "tasks", "files"];
const VALID_TAB_TYPES = ["chat", "knowledge", "tasks", "files", "agent", "custom"];

export async function createWorkspace(env, { projectId, roomId, name, description, tabs, agentId, knowledgeScope, settings }) {
  const id = `ws_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  const tabList = tabs || DEFAULT_TABS;

  try {
    await env.DB.prepare(
      `INSERT INTO workspace_configs (id, project_id, room_id, name, description, tabs, agent_id, knowledge_scope, settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, projectId, roomId, name || null, description || null, JSON.stringify(tabList), agentId || null, knowledgeScope || "room", settings ? JSON.stringify(settings) : null, now, now)
      .run();

    for (let i = 0; i < tabList.length; i++) {
      const tabType = tabList[i];
      const tabId = `wst_${generateId().slice(0, 12)}`;
      await env.DB.prepare(
        "INSERT INTO workspace_tabs (id, workspace_id, tab_type, label, sort_order, enabled, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)"
      )
        .bind(tabId, id, tabType, tabType.charAt(0).toUpperCase() + tabType.slice(1), i, now)
        .run();
    }

    return { id, created: true };
  } catch (err) {
    if (err.message?.includes("UNIQUE")) return { error: "workspace_already_exists_for_room" };
    throw err;
  }
}

export async function getWorkspace(env, { projectId, roomId }) {
  const row = await env.DB.prepare(
    "SELECT * FROM workspace_configs WHERE project_id = ? AND room_id = ?"
  )
    .bind(projectId, roomId)
    .first();
  if (!row) return null;

  const tabs = await env.DB.prepare(
    "SELECT * FROM workspace_tabs WHERE workspace_id = ? ORDER BY sort_order ASC"
  )
    .bind(row.id)
    .all();

  const pins = await env.DB.prepare(
    "SELECT * FROM workspace_pins WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 20"
  )
    .bind(row.id)
    .all();

  return {
    ...mapConfigRow(row),
    tabs: (tabs.results || []).map(mapTabRow),
    pins: (pins.results || []).map(mapPinRow),
  };
}

export async function updateWorkspace(env, { id, projectId, name, description, agentId, knowledgeScope, settings }) {
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const params = [now];

  if (name !== undefined) { sets.push("name = ?"); params.push(name); }
  if (description !== undefined) { sets.push("description = ?"); params.push(description); }
  if (agentId !== undefined) { sets.push("agent_id = ?"); params.push(agentId); }
  if (knowledgeScope !== undefined) { sets.push("knowledge_scope = ?"); params.push(knowledgeScope); }
  if (settings !== undefined) { sets.push("settings = ?"); params.push(JSON.stringify(settings)); }

  params.push(id, projectId);
  const result = await env.DB.prepare(
    `UPDATE workspace_configs SET ${sets.join(", ")} WHERE id = ? AND project_id = ?`
  )
    .bind(...params)
    .run();
  return { updated: result.meta?.changes || 0 };
}

export async function addTab(env, { workspaceId, tabType, label, icon, sortOrder, config }) {
  if (!VALID_TAB_TYPES.includes(tabType)) return { error: `tabType must be one of: ${VALID_TAB_TYPES.join(", ")}` };

  const id = `wst_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO workspace_tabs (id, workspace_id, tab_type, label, icon, sort_order, config, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)"
  )
    .bind(id, workspaceId, tabType, label || tabType, icon || null, sortOrder || 0, config ? JSON.stringify(config) : null, now)
    .run();
  return { id, created: true };
}

export async function removeTab(env, { id }) {
  const result = await env.DB.prepare("DELETE FROM workspace_tabs WHERE id = ?").bind(id).run();
  return { deleted: result.meta?.changes || 0 };
}

export async function listTabs(env, { workspaceId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM workspace_tabs WHERE workspace_id = ? ORDER BY sort_order ASC"
  )
    .bind(workspaceId)
    .all();
  return (rows.results || []).map(mapTabRow);
}

export async function pinItem(env, { workspaceId, itemType, itemId, pinnedBy, note }) {
  if (!["message", "task", "file", "knowledge", "agent_output"].includes(itemType)) {
    return { error: "invalid itemType" };
  }

  const id = `wsp_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO workspace_pins (id, workspace_id, item_type, item_id, pinned_by, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(id, workspaceId, itemType, itemId, pinnedBy, note || null, now)
    .run();
  return { id, created: true };
}

export async function unpinItem(env, { id }) {
  const result = await env.DB.prepare("DELETE FROM workspace_pins WHERE id = ?").bind(id).run();
  return { deleted: result.meta?.changes || 0 };
}

export async function listPins(env, { workspaceId, itemType }) {
  let sql = "SELECT * FROM workspace_pins WHERE workspace_id = ?";
  const params = [workspaceId];
  if (itemType) { sql += " AND item_type = ?"; params.push(itemType); }
  sql += " ORDER BY created_at DESC";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapPinRow);
}

export async function createTemplate(env, { projectId, name, description, tabs, agentConfig, settings, isSystem }) {
  if (!name) return { error: "name is required" };

  const id = `wstpl_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO workspace_templates (id, project_id, name, description, tabs, agent_config, settings, is_system, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, projectId, name, description || null, JSON.stringify(tabs || DEFAULT_TABS), agentConfig ? JSON.stringify(agentConfig) : null, settings ? JSON.stringify(settings) : null, isSystem ? 1 : 0, now)
    .run();
  return { id, created: true };
}

export async function listTemplates(env, { projectId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM workspace_templates WHERE project_id = ? OR is_system = 1 ORDER BY use_count DESC"
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapTemplateRow);
}

export async function applyTemplate(env, { templateId, projectId, roomId }) {
  const template = await env.DB.prepare(
    "SELECT * FROM workspace_templates WHERE id = ? AND (project_id = ? OR is_system = 1)"
  )
    .bind(templateId, projectId)
    .first();
  if (!template) return { error: "template_not_found" };

  const result = await createWorkspace(env, {
    projectId, roomId,
    name: template.name,
    tabs: JSON.parse(template.tabs || "[]"),
    settings: template.settings ? JSON.parse(template.settings) : undefined,
  });

  if (!result.error) {
    await env.DB.prepare(
      "UPDATE workspace_templates SET use_count = use_count + 1 WHERE id = ?"
    )
      .bind(templateId)
      .run();
  }

  return result;
}

export async function getWorkspaceStats(env, { projectId }) {
  const configs = await env.DB.prepare(
    "SELECT knowledge_scope, COUNT(*) as count FROM workspace_configs WHERE project_id = ? GROUP BY knowledge_scope"
  )
    .bind(projectId)
    .all();

  const tabs = await env.DB.prepare(
    "SELECT tab_type, COUNT(*) as count FROM workspace_tabs w JOIN workspace_configs c ON w.workspace_id = c.id WHERE c.project_id = ? GROUP BY tab_type"
  )
    .bind(projectId)
    .all();

  const pins = await env.DB.prepare(
    "SELECT item_type, COUNT(*) as count FROM workspace_pins p JOIN workspace_configs c ON p.workspace_id = c.id WHERE c.project_id = ? GROUP BY item_type"
  )
    .bind(projectId)
    .all();

  return {
    totalWorkspaces: (configs.results || []).reduce((s, c) => s + c.count, 0),
    byScope: Object.fromEntries((configs.results || []).map((c) => [c.knowledge_scope, c.count])),
    byTabType: Object.fromEntries((tabs.results || []).map((t) => [t.tab_type, t.count])),
    byPinType: Object.fromEntries((pins.results || []).map((p) => [p.item_type, p.count])),
  };
}

function mapConfigRow(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id,
    name: row.name, description: row.description,
    tabs: row.tabs ? JSON.parse(row.tabs) : [],
    agentId: row.agent_id, knowledgeScope: row.knowledge_scope,
    settings: row.settings ? JSON.parse(row.settings) : null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapTabRow(row) {
  return {
    id: row.id, workspaceId: row.workspace_id, tabType: row.tab_type,
    label: row.label, icon: row.icon, sortOrder: row.sort_order,
    config: row.config ? JSON.parse(row.config) : null,
    enabled: row.enabled === 1, createdAt: row.created_at,
  };
}

function mapPinRow(row) {
  return {
    id: row.id, workspaceId: row.workspace_id, itemType: row.item_type,
    itemId: row.item_id, pinnedBy: row.pinned_by, note: row.note, createdAt: row.created_at,
  };
}

function mapTemplateRow(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name, description: row.description,
    tabs: row.tabs ? JSON.parse(row.tabs) : [],
    agentConfig: row.agent_config ? JSON.parse(row.agent_config) : null,
    settings: row.settings ? JSON.parse(row.settings) : null,
    isSystem: row.is_system === 1, useCount: row.use_count, createdAt: row.created_at,
  };
}
