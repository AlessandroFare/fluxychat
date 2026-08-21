/**
 * Embeddable widget config (P12-A).
 */
import { parseAllowedOriginsField } from "./custom-domains.js";
import { parseAllowedOrigins, isDemoOriginAllowed } from "./demo-guard.js";
import {
  parseProactiveTriggers,
  sanitizeProactiveTriggersInput,
} from "./embed-proactive-triggers.js";
import {
  FEATURE_FLAG_KEYS,
  envFallbackBoolean,
  getFeatureFlagBoolean,
} from "./feature-flags.js";

const DEFAULT_Z_INDEX = 2147483000;
const MIN_Z_INDEX = 1;
const MAX_Z_INDEX = 2147483647;

const POSITIONS = new Set(["bottom-right", "bottom-left"]);

/**
 * @param {*} env
 * @param {{ projectId?: string }} [context]
 */
export async function isEmbedWidgetGloballyEnabled(env, context = {}) {
  return getFeatureFlagBoolean(env, FEATURE_FLAG_KEYS.EMBED_WIDGET, {
    context,
    defaultValue: envFallbackBoolean(FEATURE_FLAG_KEYS.EMBED_WIDGET, env),
  });
}

/**
 * Sync check for hot paths that cannot await (uses env fallback only).
 * @param {*} env
 */
export function isEmbedWidgetGloballyEnabledSync(env) {
  return envFallbackBoolean(FEATURE_FLAG_KEYS.EMBED_WIDGET, env);
}

/**
 * @param {*} row
 */
export function mapEmbedConfigRow(row) {
  if (!row) return null;
  let theme = { primaryColor: "#2563eb", position: "bottom-right" };
  if (row.theme_json) {
    try {
      const parsed = JSON.parse(row.theme_json);
      if (parsed && typeof parsed === "object") {
        theme = {
          primaryColor:
            typeof parsed.primaryColor === "string"
              ? parsed.primaryColor.slice(0, 32)
              : theme.primaryColor,
          position: POSITIONS.has(parsed.position) ? parsed.position : theme.position,
        };
      }
    } catch {
      /* keep defaults */
    }
  }

  return {
    projectId: row.project_id,
    enabled: Boolean(row.enabled),
    defaultRoomId: row.default_room_id ?? null,
    allowedOrigins: parseAllowedOriginsField(row.allowed_origins),
    zIndex: clampZIndex(row.z_index),
    launcherTitle: row.launcher_title?.slice(0, 80) ?? "Chat",
    theme,
    proactiveTriggers: parseProactiveTriggers(row.proactive_triggers_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * @param {number | string | null | undefined} raw
 */
export function clampZIndex(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_Z_INDEX;
  return Math.min(MAX_Z_INDEX, Math.max(MIN_Z_INDEX, Math.floor(n)));
}

/**
 * @param {*} env
 * @param {string} projectId
 */
export async function getEmbedConfigForProject(env, projectId) {
  const row = await env.DB.prepare(
    "SELECT * FROM project_embed_configs WHERE project_id = ? LIMIT 1",
  )
    .bind(projectId)
    .first();
  return mapEmbedConfigRow(row);
}

/**
 * Merge embed origins with active custom-domain origins for the project.
 * @param {*} env
 * @param {string} projectId
 * @param {{ allowedOrigins?: string[] }} embedConfig
 */
export async function getEffectiveEmbedOrigins(env, projectId, embedConfig) {
  const origins = new Set(embedConfig?.allowedOrigins ?? []);

  const domainRows = await env.DB.prepare(
    `SELECT allowed_origins, hostname FROM project_custom_domains
     WHERE project_id = ? AND status = 'active'`,
  )
    .bind(projectId)
    .all();

  for (const row of domainRows.results ?? []) {
    for (const origin of parseAllowedOriginsField(row.allowed_origins)) {
      origins.add(origin);
    }
    if (row.hostname) {
      origins.add(`https://${row.hostname}`);
    }
  }

  return [...origins];
}

/**
 * Validate parent page origin for embed guest sessions.
 * @param {*} env
 * @param {Request} request
 * @param {{
 *   embedConfig: { enabled: boolean, allowedOrigins?: string[] } | null,
 *   projectId: string,
 *   parentOrigin?: string | null,
 * }} options
 */
export async function validateEmbedParentOrigin(env, request, options) {
  const { embedConfig, projectId, parentOrigin } = options;
  if (!embedConfig?.enabled || !(await isEmbedWidgetGloballyEnabled(env, { projectId }))) {
    return { ok: true };
  }

  const embedOrigins = await getEffectiveEmbedOrigins(env, projectId, embedConfig);
  const globalOrigins = parseAllowedOrigins(
    env.PUBLIC_GUEST_ALLOWED_ORIGINS || env.DEMO_ALLOWED_ORIGINS,
  );

  const allowed = [...new Set([...globalOrigins, ...embedOrigins])];
  if (!allowed.length) {
    const nodeEnv = String(env?.NODE_ENV || "").trim().toLowerCase();
    if (nodeEnv === "development" || nodeEnv === "test") return { ok: true };
    return { ok: false, error: "embed_origin_forbidden" };
  }

  const parent = String(parentOrigin || "").trim();
  if (parent) {
    const fakeRequest = new Request(request.url, {
      headers: { Origin: parent },
    });
    if (isDemoOriginAllowed(fakeRequest, allowed, env)) {
      return { ok: true };
    }
    return { ok: false, error: "embed_origin_forbidden" };
  }

  if (isDemoOriginAllowed(request, allowed, env)) {
    return { ok: true };
  }

  return { ok: false, error: "embed_origin_forbidden" };
}

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string | null | undefined} hostname
 */
export async function getPublicEmbedConfig(env, projectId, hostname) {
  if (!(await isEmbedWidgetGloballyEnabled(env, { projectId }))) {
    return { enabled: false, reason: "embed_disabled_globally" };
  }

  const config = await getEmbedConfigForProject(env, projectId);
  if (!config?.enabled) {
    return { enabled: false, reason: "embed_not_enabled" };
  }

  let defaultRoomId = config.defaultRoomId;
  if (!defaultRoomId && hostname) {
    const domainRow = await env.DB.prepare(
      `SELECT default_room_id FROM project_custom_domains
       WHERE hostname = ? AND project_id = ? AND status = 'active' LIMIT 1`,
    )
      .bind(hostname, projectId)
      .first();
    defaultRoomId = domainRow?.default_room_id ?? null;
  }

  return {
    enabled: true,
    projectId,
    defaultRoomId,
    zIndex: config.zIndex,
    launcherTitle: config.launcherTitle,
    theme: config.theme,
    proactiveTriggers: config.proactiveTriggers ?? [],
    readOnly:
      env.PUBLIC_GUEST_READ_ONLY !== "false" && env.PUBLIC_GUEST_READ_ONLY !== "0",
    scriptUrl: "/embed.js",
    framePath: "/embed/frame",
  };
}

/**
 * @param {*} env
 * @param {string} projectId
 */
export async function getAdminEmbedConfig(env, projectId) {
  const existing = await getEmbedConfigForProject(env, projectId);
  if (existing) return existing;

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO project_embed_configs
     (project_id, enabled, default_room_id, allowed_origins, z_index, launcher_title, theme_json, created_at, updated_at)
     VALUES (?, 0, NULL, '[]', ?, 'Chat', ?, ?, ?)`,
  )
    .bind(
      projectId,
      DEFAULT_Z_INDEX,
      JSON.stringify({ primaryColor: "#2563eb", position: "bottom-right" }),
      now,
      now,
    )
    .run();

  return getEmbedConfigForProject(env, projectId);
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   enabled?: boolean,
 *   defaultRoomId?: string | null,
 *   allowedOrigins?: string[],
 *   zIndex?: number,
 *   launcherTitle?: string | null,
 *   theme?: { primaryColor?: string, position?: string },
 *   proactiveTriggers?: Array<{ id?: string, enabled?: boolean, urlPattern?: string, dwellSeconds?: number, message?: string, autoOpen?: boolean }>,
 * }} input
 * @param {{ isValidId: (id: string) => boolean }} deps
 */
export async function upsertEmbedConfig(env, input, deps) {
  const { isValidId } = deps;
  const now = new Date().toISOString();

  if (input.defaultRoomId) {
    const room = await env.DB.prepare(
      "SELECT id FROM rooms WHERE id = ? AND project_id = ? LIMIT 1",
    )
      .bind(input.defaultRoomId, input.projectId)
      .first();
    if (!room) return { ok: false, error: "room_not_found" };
  }

  const existing = await getEmbedConfigForProject(env, input.projectId);
  const theme = {
    primaryColor:
      input.theme?.primaryColor?.slice(0, 32) ??
      existing?.theme?.primaryColor ??
      "#2563eb",
    position: POSITIONS.has(input.theme?.position ?? "")
      ? input.theme.position
      : existing?.theme?.position ?? "bottom-right",
  };

  const allowedOrigins =
    input.allowedOrigins !== undefined
      ? JSON.stringify(input.allowedOrigins.slice(0, 30))
      : existing
        ? JSON.stringify(existing.allowedOrigins)
        : "[]";

  const enabled =
    input.enabled !== undefined ? (input.enabled ? 1 : 0) : existing?.enabled ? 1 : 0;

  const zIndex = input.zIndex !== undefined ? clampZIndex(input.zIndex) : existing?.zIndex ?? DEFAULT_Z_INDEX;
  const launcherTitle = (
    input.launcherTitle !== undefined
      ? input.launcherTitle
      : existing?.launcherTitle ?? "Chat"
  )
    ?.slice(0, 80) ?? "Chat";

  const defaultRoomId =
    input.defaultRoomId !== undefined ? input.defaultRoomId : existing?.defaultRoomId ?? null;

  const proactiveTriggersJson =
    input.proactiveTriggers !== undefined
      ? JSON.stringify(sanitizeProactiveTriggersInput(input.proactiveTriggers))
      : existing
        ? JSON.stringify(existing.proactiveTriggers ?? [])
        : "[]";

  if (defaultRoomId && !isValidId(defaultRoomId)) {
    return { ok: false, error: "invalid_room_id" };
  }

  if (existing) {
    await env.DB.prepare(
      `UPDATE project_embed_configs SET
         enabled = ?,
         default_room_id = ?,
         allowed_origins = ?,
         z_index = ?,
         launcher_title = ?,
         theme_json = ?,
         proactive_triggers_json = ?,
         updated_at = ?
       WHERE project_id = ?`,
    )
      .bind(
        enabled,
        defaultRoomId,
        allowedOrigins,
        zIndex,
        launcherTitle,
        JSON.stringify(theme),
        proactiveTriggersJson,
        now,
        input.projectId,
      )
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO project_embed_configs
       (project_id, enabled, default_room_id, allowed_origins, z_index, launcher_title, theme_json, proactive_triggers_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        input.projectId,
        enabled,
        defaultRoomId,
        allowedOrigins,
        zIndex,
        launcherTitle,
        JSON.stringify(theme),
        proactiveTriggersJson,
        now,
        now,
      )
      .run();
  }

  const updated = await getEmbedConfigForProject(env, input.projectId);
  return { ok: true, config: updated };
}
