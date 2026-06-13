function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Sessions ---

export async function createSession(env, { projectId, roomId, name, description }) {
  const id = `rs_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO replay_sessions (id, project_id, room_id, name, description, status, started_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'recording', ?, ?, ?)`
  ).bind(id, projectId, roomId, name || null, description || null, now, now, now).run();
  return { id, status: "recording" };
}

export async function updateSession(env, { sessionId, status }) {
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const params = [now];
  if (status) { sets.push("status = ?"); params.push(status); if (status === "stopped" || status === "archived") { sets.push("stopped_at = ?"); params.push(now); } }
  params.push(sessionId);
  await env.DB.prepare(`UPDATE replay_sessions SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
  return { updated: true };
}

export async function getSession(env, { sessionId }) {
  const row = await env.DB.prepare("SELECT * FROM replay_sessions WHERE id = ?").bind(sessionId).first();
  return row ? mapSessionRow(row) : null;
}

export async function listSessions(env, { projectId, roomId, status, limit = 25 }) {
  let sql = "SELECT * FROM replay_sessions WHERE project_id = ?";
  const params = [projectId];
  if (roomId) { sql += " AND room_id = ?"; params.push(roomId); }
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapSessionRow);
}

// --- Snapshots ---

export async function createSnapshot(env, { sessionId, projectId, roomId, snapshotType, members, roomConfig, pinnedMessages, metadata }) {
  const id = `rss_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  const lastSeq = await env.DB.prepare(
    "SELECT sequence_number FROM replay_snapshots WHERE session_id = ? ORDER BY sequence_number DESC LIMIT 1"
  ).bind(sessionId).first();
  const sequenceNumber = (lastSeq?.sequence_number || 0) + 1;

  await env.DB.prepare(
    `INSERT INTO replay_snapshots (id, session_id, project_id, room_id, snapshot_type, members, room_config, pinned_messages, metadata, sequence_number, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, sessionId, projectId, roomId, snapshotType, members ? JSON.stringify(members) : null, roomConfig ? JSON.stringify(roomConfig) : null, pinnedMessages ? JSON.stringify(pinnedMessages) : null, metadata ? JSON.stringify(metadata) : null, sequenceNumber, now).run();

  await env.DB.prepare(
    "UPDATE replay_sessions SET snapshot_count = snapshot_count + 1, updated_at = ? WHERE id = ?"
  ).bind(now, sessionId).run();

  return { id, sequenceNumber };
}

export async function getSnapshot(env, { snapshotId }) {
  const row = await env.DB.prepare("SELECT * FROM replay_snapshots WHERE id = ?").bind(snapshotId).first();
  return row ? mapSnapshotRow(row) : null;
}

export async function getSnapshotAtSequence(env, { sessionId, sequenceNumber }) {
  const row = await env.DB.prepare(
    "SELECT * FROM replay_snapshots WHERE session_id = ? AND sequence_number <= ? ORDER BY sequence_number DESC LIMIT 1"
  ).bind(sessionId, sequenceNumber).first();
  return row ? mapSnapshotRow(row) : null;
}

export async function listSnapshots(env, { sessionId, limit = 50 }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM replay_snapshots WHERE session_id = ? ORDER BY sequence_number ASC LIMIT ?"
  ).bind(sessionId, limit).all();
  return (rows.results || []).map(mapSnapshotRow);
}

// --- Events ---

export async function recordEvent(env, { sessionId, projectId, roomId, eventType, eventData, actorId, actorType }) {
  const id = `re_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  const lastSeq = await env.DB.prepare(
    "SELECT sequence_number FROM replay_events WHERE session_id = ? ORDER BY sequence_number DESC LIMIT 1"
  ).bind(sessionId).first();
  const sequenceNumber = (lastSeq?.sequence_number || 0) + 1;

  await env.DB.prepare(
    `INSERT INTO replay_events (id, session_id, project_id, room_id, event_type, event_data, actor_id, actor_type, sequence_number, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, sessionId, projectId, roomId, eventType, JSON.stringify(eventData), actorId || null, actorType || null, sequenceNumber, now).run();

  await env.DB.prepare(
    "UPDATE replay_sessions SET event_count = event_count + 1, updated_at = ? WHERE id = ?"
  ).bind(now, sessionId).run();

  return { id, sequenceNumber };
}

export async function listEvents(env, { sessionId, eventType, fromSequence, toSequence, limit = 100 }) {
  let sql = "SELECT * FROM replay_events WHERE session_id = ?";
  const params = [sessionId];
  if (eventType) { sql += " AND event_type = ?"; params.push(eventType); }
  if (fromSequence !== undefined) { sql += " AND sequence_number >= ?"; params.push(fromSequence); }
  if (toSequence !== undefined) { sql += " AND sequence_number <= ?"; params.push(toSequence); }
  sql += " ORDER BY sequence_number ASC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapEventRow);
}

export async function getEventsInRange(env, { sessionId, fromTime, toTime, limit = 500 }) {
  let sql = "SELECT * FROM replay_events WHERE session_id = ? AND created_at >= ? AND created_at <= ?";
  const params = [sessionId, fromTime, toTime];
  sql += " ORDER BY sequence_number ASC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapEventRow);
}

// --- Bookmarks ---

export async function createBookmark(env, { sessionId, projectId, roomId, name, description, snapshotId, sequenceNumber, createdBy }) {
  const id = `rb_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO replay_bookmarks (id, session_id, project_id, room_id, name, description, snapshot_id, sequence_number, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, sessionId, projectId, roomId, name, description || null, snapshotId || null, sequenceNumber, createdBy || null, now).run();
  return { id };
}

export async function listBookmarks(env, { sessionId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM replay_bookmarks WHERE session_id = ? ORDER BY created_at ASC"
  ).bind(sessionId).all();
  return (rows.results || []).map(mapBookmarkRow);
}

// --- Diffs ---

export async function createDiff(env, { sessionId, projectId, roomId, fromSnapshotId, toSnapshotId, fromSequence, toSequence, addedMessages, removedMessages, addedMembers, removedMembers, configChanges, stateDelta }) {
  const id = `rd_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO replay_diffs (id, session_id, project_id, room_id, from_snapshot_id, to_snapshot_id, from_sequence, to_sequence, added_messages, removed_messages, added_members, removed_members, config_changes, state_delta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, sessionId, projectId, roomId, fromSnapshotId, toSnapshotId, fromSequence, toSequence, addedMessages || 0, removedMessages || 0, addedMembers || 0, removedMembers || 0, configChanges ? JSON.stringify(configChanges) : null, stateDelta ? JSON.stringify(stateDelta) : null, now).run();
  return { id };
}

export async function listDiffs(env, { sessionId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM replay_diffs WHERE session_id = ? ORDER BY created_at DESC"
  ).bind(sessionId).all();
  return (rows.results || []).map(mapDiffRow);
}

// --- Stats ---

export async function getReplayStats(env, { projectId }) {
  const sessions = await env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM replay_sessions WHERE project_id = ? GROUP BY status"
  ).bind(projectId).all();

  const totalEvents = await env.DB.prepare(
    "SELECT SUM(event_count) as total FROM replay_sessions WHERE project_id = ?"
  ).bind(projectId).first();

  const totalSnapshots = await env.DB.prepare(
    "SELECT SUM(snapshot_count) as total FROM replay_sessions WHERE project_id = ?"
  ).bind(projectId).first();

  const eventTypes = await env.DB.prepare(
    "SELECT event_type, COUNT(*) as count FROM replay_events WHERE project_id = ? GROUP BY event_type ORDER BY count DESC LIMIT 10"
  ).bind(projectId).all();

  return {
    sessions: (sessions.results || []).map((s) => ({ status: s.status, count: s.count })),
    totalEvents: totalEvents?.total || 0,
    totalSnapshots: totalSnapshots?.total || 0,
    topEventTypes: (eventTypes.results || []).map((e) => ({ type: e.event_type, count: e.count })),
  };
}

// --- Helpers ---

function mapSessionRow(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id,
    name: row.name, description: row.description, status: row.status,
    startedAt: row.started_at, stoppedAt: row.stopped_at,
    snapshotCount: row.snapshot_count, messageCount: row.message_count,
    eventCount: row.event_count, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapSnapshotRow(row) {
  return {
    id: row.id, sessionId: row.session_id, projectId: row.project_id, roomId: row.room_id,
    snapshotType: row.snapshot_type, stateHash: row.state_hash,
    members: row.members ? JSON.parse(row.members) : null,
    roomConfig: row.room_config ? JSON.parse(row.room_config) : null,
    pinnedMessages: row.pinned_messages ? JSON.parse(row.pinned_messages) : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    sequenceNumber: row.sequence_number, createdAt: row.created_at,
  };
}

function mapEventRow(row) {
  return {
    id: row.id, sessionId: row.session_id, projectId: row.project_id, roomId: row.room_id,
    eventType: row.event_type, eventData: JSON.parse(row.event_data),
    actorId: row.actor_id, actorType: row.actor_type,
    sequenceNumber: row.sequence_number, createdAt: row.created_at,
  };
}

function mapBookmarkRow(row) {
  return {
    id: row.id, sessionId: row.session_id, projectId: row.project_id, roomId: row.room_id,
    name: row.name, description: row.description, snapshotId: row.snapshot_id,
    sequenceNumber: row.sequence_number, createdBy: row.created_by, createdAt: row.created_at,
  };
}

function mapDiffRow(row) {
  return {
    id: row.id, sessionId: row.session_id, projectId: row.project_id, roomId: row.room_id,
    fromSnapshotId: row.from_snapshot_id, toSnapshotId: row.to_snapshot_id,
    fromSequence: row.from_sequence, toSequence: row.to_sequence,
    addedMessages: row.added_messages, removedMessages: row.removed_messages,
    addedMembers: row.added_members, removedMembers: row.removed_members,
    configChanges: row.config_changes ? JSON.parse(row.config_changes) : null,
    stateDelta: row.state_delta ? JSON.parse(row.state_delta) : null,
    createdAt: row.created_at,
  };
}
