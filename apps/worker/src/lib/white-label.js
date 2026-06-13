/**
 * P14-I: White-label SDK for Resellers.
 *
 * Custom branding, themes, and reseller management.
 * Features:
 *   • Project-level branding (colors, fonts, logos, CSS)
 *   • Reseller CRUD with commission tracking
 *   • Embed widget theme configuration
 *   • Custom CSS/JS injection for resellers
 *   • Origin allowlist per project
 */

function isWhiteLabelEnabled(env) {
  return env.WHITE_LABEL_ENABLED === "true";
}

/**
 * Get white-label config for a project.
 */
export async function getWhiteLabelConfig(env, { projectId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM white_label_configs WHERE project_id = ?`
  ).bind(projectId).first();
  if (!row) return getDefaultConfig(projectId);
  return {
    ...row,
    showBranding: !!row.show_branding,
    showPoweredBy: !!row.show_powered_by,
    allowedOrigins: tryParse(row.allowed_origins),
    customCss: row.custom_css || null,
    customJs: row.custom_js || null,
  };
}

/**
 * Upsert white-label config.
 */
export async function upsertWhiteLabelConfig(env, {
  projectId, brandName, brandLogoUrl, brandFaviconUrl,
  primaryColor, secondaryColor, backgroundColor, textColor,
  fontFamily, borderRadius, customCss, customJs,
  welcomeMessage, inputPlaceholder, showBranding, showPoweredBy,
  allowedOrigins,
}) {
  const existing = await env.DB.prepare(
    `SELECT id FROM white_label_configs WHERE project_id = ?`
  ).bind(projectId).first();

  const id = existing?.id || crypto.randomUUID();
  const now = new Date().toISOString();

  const fields = {
    brand_name: brandName,
    brand_logo_url: brandLogoUrl,
    brand_favicon_url: brandFaviconUrl,
    primary_color: primaryColor,
    secondary_color: secondaryColor,
    background_color: backgroundColor,
    text_color: textColor,
    font_family: fontFamily,
    border_radius: borderRadius,
    custom_css: customCss,
    custom_js: customJs,
    welcome_message: welcomeMessage,
    input_placeholder: inputPlaceholder,
    show_branding: showBranding ? 1 : 0,
    show_powered_by: showPoweredBy ? 1 : 0,
    allowed_origins: JSON.stringify(allowedOrigins || []),
    updated_at: now,
  };

  // Filter out undefined values
  const updates = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (updates.length === 0) return getWhiteLabelConfig(env, { projectId });

  if (existing) {
    const setClause = updates.map(([k]) => `${k} = ?`).join(", ");
    const values = updates.map(([, v]) => v);
    await env.DB.prepare(
      `UPDATE white_label_configs SET ${setClause}, updated_at = ? WHERE project_id = ?`
    ).bind(...values, now, projectId).run();
  } else {
    const cols = ["id", "project_id", ...updates.map(([k]) => k)].join(", ");
    const placeholders = Array(2 + updates.length).fill("?").join(", ");
    const values = [id, projectId, ...updates.map(([, v]) => v)];
    await env.DB.prepare(
      `INSERT INTO white_label_configs (${cols}) VALUES (${placeholders})`
    ).bind(...values).run();
  }

  return getWhiteLabelConfig(env, { projectId });
}

/**
 * Generate embed snippet with white-label config.
 */
export async function generateEmbedSnippet(env, { projectId, baseUrl }) {
  const config = await getWhiteLabelConfig(env, { projectId });
  const host = baseUrl || "https://chat.fluxy.dev";

  return `<!-- FluxyChat White-label Embed -->
<script src="${host}/embed.js"
  data-project="${projectId}"
  data-primary-color="${config.primary_color || '#6366f1'}"
  data-secondary-color="${config.secondary_color || '#8b5cf6'}"
  data-bg-color="${config.background_color || '#ffffff'}"
  data-text-color="${config.text_color || '#1f2937'}"
  data-font="${config.font_family || 'Inter, sans-serif'}"
  data-radius="${config.border_radius || 8}"
  data-welcome="${escapeAttr(config.welcome_message || '')}"
  data-placeholder="${escapeAttr(config.input_placeholder || 'Type a message...')}"
  data-branding="${config.show_branding ? 'on' : 'off'}"
  ${config.brand_logo_url ? `data-logo="${escapeAttr(config.brand_logo_url)}"` : ""}
  ${config.custom_css ? `data-custom-css="inline"` : ""}
></script>
${config.custom_css ? `<style>${config.custom_css}</style>` : ""}
${config.custom_js ? `<script>${config.custom_js}</script>` : ""}`;
}

// --- Reseller Management ---

/**
 * Create a reseller.
 */
export async function createReseller(env, {
  projectId, resellerName, resellerEmail, resellerDomain, commissionPercent, maxProjects,
}) {
  if (!resellerName || !resellerEmail) {
    return { ok: false, error: "resellerName and resellerEmail required" };
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO white_label_resellers (id, project_id, reseller_name, reseller_email, reseller_domain, commission_percent, max_projects)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, resellerName, resellerEmail, resellerDomain || null, commissionPercent || 0, maxProjects || 10)
    .run();

  return { ok: true, id };
}

/**
 * List resellers for a project.
 */
export async function listResellers(env, { projectId }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM white_label_resellers WHERE project_id = ? AND status != 'deleted' ORDER BY created_at DESC`
  ).bind(projectId).all();
  return results;
}

/**
 * Get a reseller by ID.
 */
export async function getReseller(env, { projectId, id }) {
  return await env.DB.prepare(
    `SELECT * FROM white_label_resellers WHERE id = ? AND project_id = ?`
  ).bind(id, projectId).first() || null;
}

/**
 * Update a reseller.
 */
export async function updateReseller(env, { projectId, id, ...updates }) {
  const existing = await getReseller(env, { projectId, id });
  if (!existing) return { ok: false, error: "not_found" };

  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (fields.length === 0) return { ok: true };

  values.push(id, projectId);
  await env.DB.prepare(
    `UPDATE white_label_resellers SET ${fields.join(", ")} WHERE id = ? AND project_id = ?`
  ).bind(...values).run();

  return { ok: true };
}

/**
 * Delete a reseller (soft delete).
 */
export async function deleteReseller(env, { projectId, id }) {
  const existing = await getReseller(env, { projectId, id });
  if (!existing) return { ok: false, error: "not_found" };

  await env.DB.prepare(
    `UPDATE white_label_resellers SET status = 'deleted' WHERE id = ? AND project_id = ?`
  ).bind(id, projectId).run();

  return { ok: true };
}

/**
 * Get reseller stats.
 */
export async function getResellerStats(env, { projectId }) {
  const total = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM white_label_resellers WHERE project_id = ? AND status != 'deleted'`
  ).bind(projectId).first();

  const active = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM white_label_resellers WHERE project_id = ? AND status = 'active'`
  ).bind(projectId).first();

  const totalCommission = await env.DB.prepare(
    `SELECT SUM(commission_percent) as total FROM white_label_resellers WHERE project_id = ? AND status = 'active'`
  ).bind(projectId).first();

  return {
    total: total?.count || 0,
    active: active?.count || 0,
    totalCommissionPercent: totalCommission?.total || 0,
  };
}

function getDefaultConfig(projectId) {
  return {
    id: null,
    project_id: projectId,
    brand_name: null,
    brand_logo_url: null,
    brand_favicon_url: null,
    primary_color: "#6366f1",
    secondary_color: "#8b5cf6",
    background_color: "#ffffff",
    text_color: "#1f2937",
    font_family: "Inter, sans-serif",
    border_radius: 8,
    custom_css: null,
    custom_js: null,
    welcome_message: null,
    input_placeholder: null,
    show_branding: true,
    show_powered_by: true,
    allowed_origins: [],
    showBranding: true,
    showPoweredBy: true,
  };
}

function tryParse(str) {
  try { return JSON.parse(str); } catch { return []; }
}

function escapeAttr(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
