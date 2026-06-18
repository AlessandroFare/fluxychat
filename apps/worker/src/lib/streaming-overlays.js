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

const OVERLAY_TYPES = ["qa", "poll", "reactions", "scoreboard", "countdown", "ticker"];

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

export async function getOverlayWidget(env, { projectId, overlayId }) {
  const overlay = await getOverlay(env, { projectId, overlayId });
  if (!overlay) return null;
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

