/**
 * P22-D4: Tool Override System
 * Adapted from Vercel Chat SDK's ToolOverrides interface.
 *
 * Allows per-agent-profile tool customization without duplicating tool code.
 * Operators can override:
 * - tool description (customize for agent persona)
 * - tool title (display name in UI)
 * - needsApproval (per-tool approval requirements)
 * - enabled (enable/disable specific tools)
 *
 * Overrides are stored in D1 per profile and applied at tool build time.
 */

import { TOOL_DEFINITIONS, WRITE_TOOLS, PRESETS } from "./ai-tool-presets.js";

// =============================================================================
// Types
// =============================================================================

/**
 * @typedef {Object} ToolOverride
 * @property {string} [description] - Custom description
 * @property {string} [title] - Custom display title
 * @property {boolean} [needsApproval] - Override approval requirement
 * @property {boolean} [enabled] - Enable/disable this tool
 */

/**
 * @typedef {Object} ToolOverridesConfig
 * @property {string} profileId - Agent profile ID
 * @property {string} projectId - Project ID
 * @property {Record<string, ToolOverride>} overrides - Tool name → override
 * @property {string} createdAt
 * @property {string} updatedAt
 */

// =============================================================================
// CRUD
// =============================================================================

/**
 * Get tool overrides for a profile.
 * @param {Object} db - D1 database
 * @param {{projectId: string, profileId: string}} params
 * @returns {Promise<Record<string, ToolOverride>>}
 */
export async function getToolOverrides(db, { projectId, profileId }) {
  const row = await db.prepare(
    `SELECT overrides_json FROM tool_overrides WHERE project_id = ? AND profile_id = ?`
  )
    .bind(projectId, profileId)
    .first();

  if (!row) return {};
  try {
    return JSON.parse(row.overrides_json || "{}");
  } catch {
    return {};
  }
}

/**
 * Set tool overrides for a profile (merges with existing).
 * @param {Object} db - D1 database
 * @param {{projectId: string, profileId: string, overrides: Record<string, ToolOverride>}} params
 * @returns {Promise<{ok: boolean}>}
 */
export async function setToolOverrides(db, { projectId, profileId, overrides }) {
  const existing = await getToolOverrides(db, { projectId, profileId });
  const merged = { ...existing, ...overrides };
  const now = new Date().toISOString();

  // Remove entries with null value (delete override)
  for (const [key, val] of Object.entries(merged)) {
    if (val === null) delete merged[key];
  }

  const existingRow = await db.prepare(
    `SELECT id FROM tool_overrides WHERE project_id = ? AND profile_id = ?`
  )
    .bind(projectId, profileId)
    .first();

  if (existingRow) {
    await db.prepare(
      `UPDATE tool_overrides SET overrides_json = ?, updated_at = ? WHERE project_id = ? AND profile_id = ?`
    )
      .bind(JSON.stringify(merged), now, projectId, profileId)
      .run();
  } else {
    const id = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO tool_overrides (id, project_id, profile_id, overrides_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(id, projectId, profileId, JSON.stringify(merged), now, now)
      .run();
  }

  return { ok: true };
}

/**
 * Delete all tool overrides for a profile.
 * @param {Object} db - D1 database
 * @param {{projectId: string, profileId: string}} params
 * @returns {Promise<{ok: boolean}>}
 */
export async function deleteToolOverrides(db, { projectId, profileId }) {
  await db.prepare(
    `DELETE FROM tool_overrides WHERE project_id = ? AND profile_id = ?`
  )
    .bind(projectId, profileId)
    .run();
  return { ok: true };
}

/**
 * List all profiles with tool overrides for a project.
 * @param {Object} db - D1 database
 * @param {{projectId: string}} params
 * @returns {Promise<Array<{profileId: string, overrides: Record<string, ToolOverride>}>>}
 */
export async function listProfilesWithOverrides(db, { projectId }) {
  const { results } = await db.prepare(
    `SELECT profile_id, overrides_json FROM tool_overrides WHERE project_id = ?`
  )
    .bind(projectId)
    .all();

  return (results || []).map((row) => {
    let overrides = {};
    try {
      overrides = JSON.parse(row.overrides_json || "{}");
    } catch {
      // ignore parse errors
    }
    return { profileId: row.profile_id, overrides };
  });
}

// =============================================================================
// Tool Building with Overrides
// =============================================================================

/**
 * Validate an override value against the tool definition.
 * @param {string} toolName
 * @param {ToolOverride} override
 * @returns {{valid: boolean, error?: string}}
 */
export function validateOverride(toolName, override) {
  const def = TOOL_DEFINITIONS[toolName];
  if (!def) return { valid: false, error: "unknown_tool" };

  if (override.description !== undefined) {
    if (typeof override.description !== "string") {
      return { valid: false, error: "description_must_be_string" };
    }
    if (override.description.length > 1024) {
      return { valid: false, error: "description_too_long" };
    }
  }

  if (override.title !== undefined) {
    if (typeof override.title !== "string") {
      return { valid: false, error: "title_must_be_string" };
    }
    if (override.title.length > 128) {
      return { valid: false, error: "title_too_long" };
    }
  }

  if (override.needsApproval !== undefined) {
    if (typeof override.needsApproval !== "boolean") {
      return { valid: false, error: "needsApproval_must_be_boolean" };
    }
  }

  if (override.enabled !== undefined) {
    if (typeof override.enabled !== "boolean") {
      return { valid: false, error: "enabled_must_be_boolean" };
    }
  }

  return { valid: true };
}

/**
 * Build a tool list for a profile with overrides applied.
 * @param {string} preset - Preset name ('reader', 'messenger', 'moderator')
 * @param {Record<string, ToolOverride>} overrides - Tool overrides
 * @returns {Array<Object>} Tool definitions with overrides applied
 */
export function buildToolsWithOverrides(preset, overrides = {}) {
  const presetConfig = PRESETS[preset];
  if (!presetConfig) return [];

  return presetConfig.tools
    .map((toolName) => {
      const def = TOOL_DEFINITIONS[toolName];
      if (!def) return null;

      const override = overrides[toolName] || {};

      // Check if tool is disabled
      if (override.enabled === false) return null;

      // Apply overrides
      return {
        ...def,
        name: override.title || def.name,
        description: override.description || def.description,
        title: override.title || toolName,
        needsApproval:
          override.needsApproval !== undefined
            ? override.needsApproval
            : presetConfig.needsApproval[toolName] !== undefined
              ? presetConfig.needsApproval[toolName]
              : WRITE_TOOLS.has(toolName),
      };
    })
    .filter(Boolean);
}

/**
 * Get the effective approval status for a tool with overrides.
 * @param {string} preset - Preset name
 * @param {string} toolName - Tool name
 * @param {Record<string, ToolOverride>} overrides - Tool overrides
 * @returns {boolean}
 */
export function getEffectiveApproval(preset, toolName, overrides = {}) {
  const override = overrides[toolName];
  if (override?.needsApproval !== undefined) {
    return override.needsApproval;
  }

  const presetConfig = PRESETS[preset];
  if (presetConfig?.needsApproval[toolName] !== undefined) {
    return presetConfig.needsApproval[toolName];
  }

  return WRITE_TOOLS.has(toolName);
}

/**
 * Check if a tool is enabled for a profile.
 * @param {string} preset - Preset name
 * @param {string} toolName - Tool name
 * @param {Record<string, ToolOverride>} overrides - Tool overrides
 * @returns {boolean}
 */
export function isToolEnabled(preset, toolName, overrides = {}) {
  const override = overrides[toolName];
  if (override?.enabled === false) return false;

  const presetConfig = PRESETS[preset];
  return presetConfig?.tools.includes(toolName) ?? false;
}
