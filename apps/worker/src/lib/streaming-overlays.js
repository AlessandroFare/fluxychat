/**
 * P20-G: Streaming Overlays — OBS-ready live event overlays.
 *
 * Features:
 *   • Overlay types: qa, poll, reactions, scoreboard, countdown, ticker
 *   • Custom styling (colors, fonts, position, size)
 *   • Auto-refresh intervals
 *   • Widget data endpoint for OBS browser source
 *   • Multiple overlays per room
 */

const OVERLAY_TYPES = ["qa", "poll", "reactions", "scoreboard", "countdown", "ticker", "chat"];

export async function createOverlay(env, {
  projectId, roomId, name, overlayType, config, style, refreshSeconds,
}) {
  if (!OVERLAY_TYPES.includes(overlayType || "qa")) throw new Error(`Invalid overlay type: ${overlayType}`);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO streaming_overlays (id, project_id, room_id, name, overlay_type, config, style, refresh_seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, roomId, name, overlayType || "qa",
    JSON.stringify(config || {}), JSON.stringify(style || {}),
    refreshSeconds || 30).run();
  return { id, name, overlayType: overlayType || "qa" };
}

export async function getOverlay(env, { projectId, overlayId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM streaming_overlays WHERE project_id = ? AND id = ?`
  ).bind(projectId, overlayId).first();
  return row ? formatOverlay(row) : null;
}

export async function listOverlays(env, { projectId, roomId }) {
  let query = `SELECT * FROM streaming_overlays WHERE project_id = ?`;
  const params = [projectId];
  if (roomId) { query += ` AND room_id = ?`; params.push(roomId); }
  query += ` ORDER BY created_at DESC`;
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatOverlay);
}

export async function deleteOverlay(env, { projectId, overlayId }) {
  const info = await env.DB.prepare(
    `DELETE FROM streaming_overlays WHERE project_id = ? AND id = ?`
  ).bind(projectId, overlayId).run();
  return info.meta?.changes > 0;
}

/** Overlayed hide/show + persist opacity/style without shipping Electron. */
export function parseOverlayPatch(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "body required" };
  const data = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 100) return { ok: false, error: "name required (max 100 chars)" };
    data.name = name;
  }
  if (body.config !== undefined) {
    if (!body.config || typeof body.config !== "object" || Array.isArray(body.config)) {
      return { ok: false, error: "config must be an object" };
    }
    data.config = body.config;
  }
  if (body.style !== undefined) {
    if (!body.style || typeof body.style !== "object" || Array.isArray(body.style)) {
      return { ok: false, error: "style must be an object" };
    }
    data.style = body.style;
  }
  if (body.refreshSeconds !== undefined) {
    const refreshSeconds = Number(body.refreshSeconds);
    if (!Number.isFinite(refreshSeconds) || refreshSeconds < 1) {
      return { ok: false, error: "invalid refreshSeconds" };
    }
    data.refreshSeconds = refreshSeconds;
  }
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") return { ok: false, error: "enabled must be boolean" };
    data.enabled = body.enabled;
  }
  if (!Object.keys(data).length) return { ok: false, error: "no fields to update" };
  return { ok: true, data };
}

export async function updateOverlay(env, { projectId, overlayId, data }) {
  const fields = [];
  const values = [];
  if (data.name != null) {
    fields.push("name = ?");
    values.push(data.name);
  }
  if (data.config != null) {
    fields.push("config = ?");
    values.push(JSON.stringify(data.config));
  }
  if (data.style != null) {
    fields.push("style = ?");
    values.push(JSON.stringify(data.style));
  }
  if (data.refreshSeconds != null) {
    fields.push("refresh_seconds = ?");
    values.push(data.refreshSeconds);
  }
  if (data.enabled !== undefined) {
    fields.push("enabled = ?");
    values.push(data.enabled ? 1 : 0);
  }
  if (!fields.length) return { ok: false, error: "no fields to update" };
  values.push(projectId, overlayId);
  const info = await env.DB.prepare(
    `UPDATE streaming_overlays SET ${fields.join(", ")} WHERE project_id = ? AND id = ?`,
  ).bind(...values).run();
  if (info?.meta?.changes === 0) return { ok: false, error: "not_found", status: 404 };
  const overlay = await getOverlay(env, { projectId, overlayId });
  return { ok: true, overlay };
}

export async function getOverlayById(env, overlayId) {
  const row = await env.DB.prepare(
    `SELECT * FROM streaming_overlays WHERE id = ?`,
  )
    .bind(overlayId)
    .first();
  return row ? formatOverlay(row) : null;
}

export async function getOverlayWidget(env, { projectId, overlayId }) {
  const overlay = projectId
    ? await getOverlay(env, { projectId, overlayId })
    : await getOverlayById(env, overlayId);
  if (!overlay) return null;
  if (!overlay.enabled) return null;
  return {
    type: overlay.overlayType,
    config: overlay.config,
    style: overlay.style,
    refreshSeconds: overlay.refreshSeconds,
    widgetUrl: `/overlays/${overlayId}/widget`,
    dataUrl: `/overlays/${overlayId}/data`,
  };
}

function formatOverlay(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id,
    name: row.name, overlayType: row.overlay_type,
    config: JSON.parse(row.config || "{}"), style: JSON.parse(row.style || "{}"),
    refreshSeconds: row.refresh_seconds, enabled: row.enabled === 1,
    createdAt: row.created_at,
  };
}

