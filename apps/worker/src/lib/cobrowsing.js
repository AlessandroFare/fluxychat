function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSession(env, { projectId, roomId, createdBy, url, maxViewers, annotationsEnabled, remoteControlEnabled }) {
  const id = `cb_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO cobrowsing_sessions (id, project_id, room_id, created_by, url, status, max_viewers, annotations_enabled, remote_control_enabled, started_at, created_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`
  )
    .bind(id, projectId, roomId, createdBy, url || null, maxViewers || 25, annotationsEnabled !== false ? 1 : 0, remoteControlEnabled ? 1 : 0, now, now)
    .run();

  return { id, status: "active", startedAt: now };
}

export async function endSession(env, { sessionId }) {
  const now = new Date().toISOString();
  const session = await env.DB.prepare("SELECT started_at FROM cobrowsing_sessions WHERE id = ?").bind(sessionId).first();
  const durationMs = session?.started_at ? Date.now() - new Date(session.started_at).getTime() : 0;

  const result = await env.DB.prepare(
    "UPDATE cobrowsing_sessions SET status = 'ended', ended_at = ?, duration_ms = ? WHERE id = ? AND status IN ('active', 'paused')"
  )
    .bind(now, durationMs, sessionId)
    .run();

  return { ended: result.meta?.changes || 0, durationMs };
}

export async function pauseSession(env, { sessionId }) {
  const result = await env.DB.prepare(
    "UPDATE cobrowsing_sessions SET status = 'paused' WHERE id = ? AND status = 'active'"
  )
    .bind(sessionId)
    .run();
  return { paused: result.meta?.changes || 0 };
}

export async function resumeSession(env, { sessionId }) {
  const result = await env.DB.prepare(
    "UPDATE cobrowsing_sessions SET status = 'active' WHERE id = ? AND status = 'paused'"
  )
    .bind(sessionId)
    .run();
  return { resumed: result.meta?.changes || 0 };
}

export async function getSession(env, { sessionId }) {
  const row = await env.DB.prepare("SELECT * FROM cobrowsing_sessions WHERE id = ?").bind(sessionId).first();
  return row ? mapSessionRow(row) : null;
}

export async function listActiveSessions(env, { projectId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM cobrowsing_sessions WHERE project_id = ? AND status IN ('active', 'paused') ORDER BY created_at DESC"
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapSessionRow);
}

export async function joinSession(env, { sessionId, userId, displayName }) {
  const session = await env.DB.prepare("SELECT * FROM cobrowsing_sessions WHERE id = ?").bind(sessionId).first();
  if (!session || session.status === "ended") return { error: "session_not_active" };

  const existing = await env.DB.prepare(
    "SELECT * FROM cobrowsing_viewers WHERE session_id = ? AND user_id = ? AND left_at IS NULL"
  )
    .bind(sessionId, userId)
    .first();
  if (existing) return { error: "already_joined" };

  const count = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM cobrowsing_viewers WHERE session_id = ? AND left_at IS NULL"
  )
    .bind(sessionId)
    .first();
  if ((count?.cnt || 0) >= session.max_viewers) return { error: "session_full" };

  const id = `cbv_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO cobrowsing_viewers (id, session_id, user_id, display_name, joined_at, remote_control, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, sessionId, userId, displayName || null, now, session.remote_control_enabled ? 1 : 0, now)
    .run();

  return { id, joined: true };
}

export async function leaveSession(env, { sessionId, userId }) {
  const now = new Date().toISOString();
  const viewer = await env.DB.prepare(
    "SELECT * FROM cobrowsing_viewers WHERE session_id = ? AND user_id = ? AND left_at IS NULL"
  )
    .bind(sessionId, userId)
    .first();

  if (!viewer) return { error: "not_in_session" };

  await env.DB.prepare("UPDATE cobrowsing_viewers SET left_at = ? WHERE id = ?")
    .bind(now, viewer.id)
    .run();

  return { left: true };
}

export async function updateCursor(env, { sessionId, userId, x, y, pageUrl }) {
  const result = await env.DB.prepare(
    "UPDATE cobrowsing_viewers SET cursor_x = ?, cursor_y = ?, page_url = ? WHERE session_id = ? AND user_id = ? AND left_at IS NULL"
  )
    .bind(x, y, pageUrl || null, sessionId, userId)
    .run();
  return { updated: result.meta?.changes || 0 };
}

export async function addAnnotation(env, { sessionId, projectId, userId, type, payload, pageUrl }) {
  const id = `cba_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO cobrowsing_annotations (id, session_id, project_id, user_id, type, payload, page_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, sessionId, projectId, userId, type, JSON.stringify(payload), pageUrl || null, now)
    .run();
  return { id };
}

export async function listAnnotations(env, { sessionId, limit = 50 }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM cobrowsing_annotations WHERE session_id = ? ORDER BY created_at DESC LIMIT ?"
  )
    .bind(sessionId, limit)
    .all();
  return (rows.results || []).map(mapAnnotationRow);
}

export async function grantRemoteControl(env, { sessionId, userId }) {
  const result = await env.DB.prepare(
    "UPDATE cobrowsing_viewers SET remote_control = 1 WHERE session_id = ? AND user_id = ? AND left_at IS NULL"
  )
    .bind(sessionId, userId)
    .run();
  return { granted: result.meta?.changes || 0 };
}

export async function revokeRemoteControl(env, { sessionId, userId }) {
  const result = await env.DB.prepare(
    "UPDATE cobrowsing_viewers SET remote_control = 0 WHERE session_id = ? AND user_id = ? AND left_at IS NULL"
  )
    .bind(sessionId, userId)
    .run();
  return { revoked: result.meta?.changes || 0 };
}

export async function listViewers(env, { sessionId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM cobrowsing_viewers WHERE session_id = ? ORDER BY joined_at ASC"
  )
    .bind(sessionId)
    .all();
  return (rows.results || []).map(mapViewerRow);
}

export async function getCobrowsingStats(env, { projectId }) {
  const sessions = await env.DB.prepare(
    "SELECT status, COUNT(*) as count, AVG(duration_ms) as avg_duration FROM cobrowsing_sessions WHERE project_id = ? GROUP BY status"
  )
    .bind(projectId)
    .all();

  const viewers = await env.DB.prepare(
    "SELECT COUNT(DISTINCT user_id) as unique_viewers, COUNT(*) as total_joins FROM cobrowsing_viewers cv JOIN cobrowsing_sessions cs ON cv.session_id = cs.id WHERE cs.project_id = ?"
  )
    .bind(projectId)
    .first();

  return {
    totalSessions: (sessions.results || []).reduce((s, c) => s + c.count, 0),
    byStatus: (sessions.results || []).map((c) => ({ status: c.status, count: c.count, avgDuration: Math.round(c.avg_duration || 0) })),
    uniqueViewers: viewers?.unique_viewers || 0,
    totalJoins: viewers?.total_joins || 0,
  };
}

function mapSessionRow(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id,
    createdBy: row.created_by, url: row.url, status: row.status,
    maxViewers: row.max_viewers, annotationsEnabled: row.annotations_enabled === 1,
    remoteControlEnabled: row.remote_control_enabled === 1,
    startedAt: row.started_at, endedAt: row.ended_at, durationMs: row.duration_ms,
    createdAt: row.created_at,
  };
}

function mapViewerRow(row) {
  return {
    id: row.id, sessionId: row.session_id, userId: row.user_id,
    displayName: row.display_name, joinedAt: row.joined_at, leftAt: row.left_at,
    cursorX: row.cursor_x, cursorY: row.cursor_y, pageUrl: row.page_url,
    remoteControl: row.remote_control === 1, createdAt: row.created_at,
  };
}

function mapAnnotationRow(row) {
  return {
    id: row.id, sessionId: row.session_id, projectId: row.project_id,
    userId: row.user_id, type: row.type,
    payload: row.payload ? JSON.parse(row.payload) : null,
    pageUrl: row.page_url, createdAt: row.created_at,
  };
}
