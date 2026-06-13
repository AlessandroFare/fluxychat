function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createWidget(env, { projectId, name, slug, agentId, type, theme, position, greeting, fallbackMessage, allowedOrigins }) {
  if (!name || !slug) return { error: "name and slug are required" };
  const validTypes = ["chat", "popup", "inline", "sidebar", "floating"];
  if (type && !validTypes.includes(type)) return { error: `type must be one of: ${validTypes.join(", ")}` };

  const id = `wg_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  const embedCode = generateEmbedCode(id, slug);

  try {
    await env.DB.prepare(
      `INSERT INTO widget_configs (id, project_id, name, slug, agent_id, type, theme, position, greeting, fallback_message, allowed_origins, embed_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, projectId, name, slug, agentId || null, type || "chat", theme || null, position || "bottom-right", greeting || null, fallbackMessage || null, allowedOrigins || null, embedCode, now, now)
      .run();
    return { id, embedCode, created: true };
  } catch (err) {
    if (err.message?.includes("UNIQUE")) return { error: "slug_already_exists" };
    throw err;
  }
}

export async function updateWidget(env, { id, projectId, name, agentId, type, theme, position, greeting, fallbackMessage, allowedOrigins, enabled }) {
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const params = [now];

  if (name !== undefined) { sets.push("name = ?"); params.push(name); }
  if (agentId !== undefined) { sets.push("agent_id = ?"); params.push(agentId); }
  if (type !== undefined) { sets.push("type = ?"); params.push(type); }
  if (theme !== undefined) { sets.push("theme = ?"); params.push(theme); }
  if (position !== undefined) { sets.push("position = ?"); params.push(position); }
  if (greeting !== undefined) { sets.push("greeting = ?"); params.push(greeting); }
  if (fallbackMessage !== undefined) { sets.push("fallback_message = ?"); params.push(fallbackMessage); }
  if (allowedOrigins !== undefined) { sets.push("allowed_origins = ?"); params.push(allowedOrigins); }
  if (enabled !== undefined) { sets.push("enabled = ?"); params.push(enabled ? 1 : 0); }

  params.push(id, projectId);
  const result = await env.DB.prepare(
    `UPDATE widget_configs SET ${sets.join(", ")} WHERE id = ? AND project_id = ?`
  )
    .bind(...params)
    .run();
  return { updated: result.meta?.changes || 0 };
}

export async function getWidget(env, { id, projectId }) {
  const row = await env.DB.prepare(
    "SELECT * FROM widget_configs WHERE id = ? AND project_id = ?"
  )
    .bind(id, projectId)
    .first();
  return row ? mapWidgetRow(row) : null;
}

export async function getWidgetBySlug(env, { slug, projectId }) {
  const row = await env.DB.prepare(
    "SELECT * FROM widget_configs WHERE slug = ? AND project_id = ? AND enabled = 1"
  )
    .bind(slug, projectId)
    .first();
  return row ? mapWidgetRow(row) : null;
}

export async function listWidgets(env, { projectId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM widget_configs WHERE project_id = ? ORDER BY created_at DESC"
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapWidgetRow);
}

export async function deleteWidget(env, { id, projectId }) {
  const result = await env.DB.prepare(
    "DELETE FROM widget_configs WHERE id = ? AND project_id = ?"
  )
    .bind(id, projectId)
    .run();
  return { deleted: result.meta?.changes || 0 };
}

export async function createFlow(env, { widgetId, projectId, name, triggerType, triggerValue, steps }) {
  if (!name) return { error: "name is required" };
  const validTriggers = ["greeting", "keyword", "button", "page_url", "idle"];
  if (triggerType && !validTriggers.includes(triggerType)) return { error: `triggerType must be one of: ${validTriggers.join(", ")}` };

  const id = `wgf_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO widget_flows (id, widget_id, project_id, name, trigger_type, trigger_value, steps, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, widgetId, projectId, name, triggerType || "greeting", triggerValue || null, JSON.stringify(steps || []), now)
    .run();
  return { id, created: true };
}

export async function listFlows(env, { widgetId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM widget_flows WHERE widget_id = ? ORDER BY sort_order ASC"
  )
    .bind(widgetId)
    .all();
  return (rows.results || []).map(mapFlowRow);
}

export async function deleteFlow(env, { id }) {
  const result = await env.DB.prepare("DELETE FROM widget_flows WHERE id = ?").bind(id).run();
  return { deleted: result.meta?.changes || 0 };
}

export async function createTheme(env, { projectId, name, primaryColor, secondaryColor, backgroundColor, textColor, fontFamily, borderRadius, bubbleSize, customCss, isSystem }) {
  if (!name) return { error: "name is required" };

  const id = `wgt_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO widget_themes (id, project_id, name, primary_color, secondary_color, background_color, text_color, font_family, border_radius, bubble_size, custom_css, is_system, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, projectId, name, primaryColor || "#0066ff", secondaryColor || "#f5f5f5", backgroundColor || "#ffffff", textColor || "#333333", fontFamily || "Inter, sans-serif", borderRadius || 12, bubbleSize || 60, customCss || null, isSystem ? 1 : 0, now)
    .run();
  return { id, created: true };
}

export async function listThemes(env, { projectId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM widget_themes WHERE project_id = ? OR is_system = 1 ORDER BY is_system DESC, created_at DESC"
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapThemeRow);
}

export async function recordEvent(env, { widgetId, projectId, eventType, sessionId, metadata }) {
  const validEvents = ["view", "open", "message", "close", "resolution", "redirect"];
  if (!validEvents.includes(eventType)) return { error: "invalid eventType" };

  const id = `wge_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO widget_analytics (id, widget_id, project_id, event_type, session_id, metadata, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(id, widgetId, projectId, eventType, sessionId || null, metadata ? JSON.stringify(metadata) : null, now)
    .run();

  if (eventType === "view") {
    await env.DB.prepare("UPDATE widget_configs SET view_count = view_count + 1 WHERE id = ?").bind(widgetId).run();
  } else if (eventType === "message") {
    await env.DB.prepare("UPDATE widget_configs SET interaction_count = interaction_count + 1 WHERE id = ?").bind(widgetId).run();
  }

  return { id, recorded: true };
}

export async function getWidgetAnalytics(env, { widgetId, projectId, startTime, endTime }) {
  let sql = "SELECT event_type, COUNT(*) as count FROM widget_analytics WHERE project_id = ?";
  const params = [projectId];
  if (widgetId) { sql += " AND widget_id = ?"; params.push(widgetId); }
  if (startTime) { sql += " AND recorded_at >= ?"; params.push(startTime); }
  if (endTime) { sql += " AND recorded_at <= ?"; params.push(endTime); }
  sql += " GROUP BY event_type";

  const rows = await env.DB.prepare(sql).bind(...params).all();
  const byEvent = {};
  for (const r of rows.results || []) byEvent[r.event_type] = r.count;
  return { byEvent, totalEvents: Object.values(byEvent).reduce((s, c) => s + c, 0) };
}

export async function getWidgetStats(env, { projectId }) {
  const widgets = await env.DB.prepare(
    "SELECT type, COUNT(*) as count, SUM(view_count) as views, SUM(interaction_count) as interactions FROM widget_configs WHERE project_id = ? GROUP BY type"
  )
    .bind(projectId)
    .all();

  return {
    totalWidgets: (widgets.results || []).reduce((s, w) => s + w.count, 0),
    totalViews: (widgets.results || []).reduce((s, w) => s + (w.views || 0), 0),
    totalInteractions: (widgets.results || []).reduce((s, w) => s + (w.interactions || 0), 0),
    byType: (widgets.results || []).map((w) => ({ type: w.type, count: w.count, views: w.views, interactions: w.interactions })),
  };
}

function generateEmbedCode(widgetId, slug) {
  return `<script src="https://chat.fluxychat.com/widget.js" data-widget-id="${widgetId}" data-slug="${slug}" async></script>`;
}

function mapWidgetRow(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name, slug: row.slug,
    agentId: row.agent_id, type: row.type, theme: row.theme, position: row.position,
    greeting: row.greeting, fallbackMessage: row.fallback_message,
    allowedOrigins: row.allowed_origins, embedCode: row.embed_code,
    enabled: row.enabled === 1, viewCount: row.view_count, interactionCount: row.interaction_count,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapFlowRow(row) {
  return {
    id: row.id, widgetId: row.widget_id, projectId: row.project_id,
    name: row.name, triggerType: row.trigger_type, triggerValue: row.trigger_value,
    steps: row.steps ? JSON.parse(row.steps) : [], enabled: row.enabled === 1,
    sortOrder: row.sort_order, createdAt: row.created_at,
  };
}

function mapThemeRow(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name,
    primaryColor: row.primary_color, secondaryColor: row.secondary_color,
    backgroundColor: row.background_color, textColor: row.text_color,
    fontFamily: row.font_family, borderRadius: row.border_radius,
    bubbleSize: row.bubble_size, customCss: row.custom_css,
    isSystem: row.is_system === 1, createdAt: row.created_at,
  };
}
