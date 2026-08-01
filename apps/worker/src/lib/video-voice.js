import { mintLiveKitAccessToken } from "./livekit-token.js";

function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createCallSession(env, { projectId, roomId, provider, startedBy, maxParticipants, settings, recordingEnabled }) {
  const id = `call_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  const providerRoomId = `room_${generateId().slice(0, 16)}`;

  await env.DB.prepare(
    `INSERT INTO call_sessions (id, project_id, room_id, provider, provider_room_id, status, started_by, started_at, recording_enabled, max_participants, settings, created_at)
     VALUES (?, ?, ?, ?, ?, 'waiting', ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, projectId, roomId, provider || "livekit", providerRoomId, startedBy || null, now, recordingEnabled ? 1 : 0, maxParticipants || 50, settings ? JSON.stringify(settings) : null, now)
    .run();

  return { id, providerRoomId, status: "waiting" };
}

export async function startCall(env, { callId }) {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    "UPDATE call_sessions SET status = 'active', started_at = ? WHERE id = ? AND status = 'waiting'"
  )
    .bind(now, callId)
    .run();
  return { started: result.meta?.changes || 0 };
}

export async function endCall(env, { callId }) {
  const now = new Date().toISOString();
  const call = await env.DB.prepare("SELECT started_at FROM call_sessions WHERE id = ?").bind(callId).first();
  const durationMs = call?.started_at ? Date.now() - new Date(call.started_at).getTime() : 0;

  const result = await env.DB.prepare(
    "UPDATE call_sessions SET status = 'ended', ended_at = ?, duration_ms = ? WHERE id = ?"
  )
    .bind(now, durationMs, callId)
    .run();
  return { ended: result.meta?.changes || 0, durationMs };
}

export async function getCallSession(env, { callId }) {
  const row = await env.DB.prepare("SELECT * FROM call_sessions WHERE id = ?").bind(callId).first();
  return row ? mapCallRow(row) : null;
}

export async function listActiveCalls(env, { projectId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM call_sessions WHERE project_id = ? AND status IN ('waiting', 'active') ORDER BY created_at DESC"
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapCallRow);
}

export async function joinCall(env, { callId, userId, displayName, role }) {
  const existing = await env.DB.prepare(
    "SELECT * FROM call_participants WHERE call_id = ? AND user_id = ? AND left_at IS NULL"
  )
    .bind(callId, userId)
    .first();
  if (existing) return { error: "already_in_call" };

  const id = `cp_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO call_participants (id, call_id, user_id, display_name, joined_at, role, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, callId, userId, displayName || null, now, role || "participant", now)
    .run();

  await recordCallEvent(env, { callId, projectId: (await getCallSession(env, { callId }))?.projectId, eventType: "join", userId });
  return { id, joined: true };
}

export async function leaveCall(env, { callId, userId }) {
  const now = new Date().toISOString();
  const participant = await env.DB.prepare(
    "SELECT * FROM call_participants WHERE call_id = ? AND user_id = ? AND left_at IS NULL"
  )
    .bind(callId, userId)
    .first();

  if (!participant) return { error: "not_in_call" };

  const durationMs = Date.now() - new Date(participant.joined_at).getTime();
  await env.DB.prepare(
    "UPDATE call_participants SET left_at = ?, duration_ms = ? WHERE id = ?"
  )
    .bind(now, durationMs, participant.id)
    .run();

  await recordCallEvent(env, { callId, projectId: (await getCallSession(env, { callId }))?.projectId, eventType: "leave", userId });
  return { left: true, durationMs };
}

export async function updateParticipant(env, { callId, userId, audioEnabled, videoEnabled, screenSharing }) {
  const sets = [];
  const params = [];

  if (audioEnabled !== undefined) { sets.push("audio_enabled = ?"); params.push(audioEnabled ? 1 : 0); }
  if (videoEnabled !== undefined) { sets.push("video_enabled = ?"); params.push(videoEnabled ? 1 : 0); }
  if (screenSharing !== undefined) { sets.push("screen_sharing = ?"); params.push(screenSharing ? 1 : 0); }

  if (sets.length === 0) return { updated: 0 };

  params.push(callId, userId);
  const result = await env.DB.prepare(
    `UPDATE call_participants SET ${sets.join(", ")} WHERE call_id = ? AND user_id = ? AND left_at IS NULL`
  )
    .bind(...params)
    .run();

  const eventType = audioEnabled === false ? "mute" : audioEnabled === true ? "unmute" :
    videoEnabled === false ? "video_off" : videoEnabled === true ? "video_on" :
    screenSharing === true ? "screen_share_start" : "screen_share_stop";

  await recordCallEvent(env, { callId, projectId: (await getCallSession(env, { callId }))?.projectId, eventType, userId });
  return { updated: result.meta?.changes || 0 };
}

export async function listParticipants(env, { callId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM call_participants WHERE call_id = ? ORDER BY joined_at ASC"
  )
    .bind(callId)
    .all();
  return (rows.results || []).map(mapParticipantRow);
}

export async function recordCallEvent(env, { callId, projectId, eventType, userId, metadata }) {
  const id = `ce_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO call_events (id, call_id, project_id, event_type, user_id, metadata, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(id, callId, projectId || null, eventType, userId || null, metadata ? JSON.stringify(metadata) : null, now)
    .run();
  return { id };
}

export async function toggleRecording(env, { callId, enabled }) {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    "UPDATE call_sessions SET recording_enabled = ? WHERE id = ? AND status = 'active'"
  )
    .bind(enabled ? 1 : 0, callId)
    .run();

  if (result.meta?.changes > 0) {
    await recordCallEvent(env, { callId, eventType: enabled ? "recording_start" : "recording_stop" });
  }
  return { updated: result.meta?.changes || 0 };
}

export async function getCallStats(env, { projectId }) {
  const calls = await env.DB.prepare(
    "SELECT status, COUNT(*) as count, AVG(duration_ms) as avg_duration FROM call_sessions WHERE project_id = ? GROUP BY status"
  )
    .bind(projectId)
    .all();

  const participants = await env.DB.prepare(
    "SELECT COUNT(DISTINCT user_id) as unique_users, COUNT(*) as total_joins FROM call_participants cp JOIN call_sessions cs ON cp.call_id = cs.id WHERE cs.project_id = ?"
  )
    .bind(projectId)
    .first();

  return {
    totalCalls: (calls.results || []).reduce((s, c) => s + c.count, 0),
    byStatus: (calls.results || []).map((c) => ({ status: c.status, count: c.count, avgDuration: Math.round(c.avg_duration || 0) })),
    uniqueUsers: participants?.unique_users || 0,
    totalJoins: participants?.total_joins || 0,
  };
}

export async function generateToken(env, provider, { roomId, userId, displayName, ttl, roomName }) {
  const livekitRoom = roomName || roomId;

  if (provider === "livekit") {
    const minted = await mintLiveKitAccessToken(env, {
      roomName: livekitRoom,
      identity: userId,
      displayName,
      ttlSeconds: ttl || 3600,
    });
    if (minted.error) {
      const exp = Math.floor(Date.now() / 1000) + (ttl || 86400);
      return {
        provider: "livekit",
        stub: true,
        payload: { room: livekitRoom, sub: userId, name: displayName, exp },
        note: minted.message,
      };
    }
    return minted;
  }

  const exp = Math.floor(Date.now() / 1000) + (ttl || 86400);
  const payload = { room: roomId, sub: userId, name: displayName, exp };

  if (provider === "daily") {
    return { provider: "daily", payload, note: "Use Daily.co API to create meeting token" };
  }
  return { provider: "custom", payload };
}

function mapCallRow(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id,
    provider: row.provider, providerRoomId: row.provider_room_id,
    status: row.status, startedBy: row.started_by,
    startedAt: row.started_at, endedAt: row.ended_at, durationMs: row.duration_ms,
    recordingEnabled: row.recording_enabled === 1, recordingUrl: row.recording_url,
    maxParticipants: row.max_participants,
    settings: row.settings ? JSON.parse(row.settings) : null,
    createdAt: row.created_at,
  };
}

function mapParticipantRow(row) {
  return {
    id: row.id, callId: row.call_id, userId: row.user_id,
    displayName: row.display_name, joinedAt: row.joined_at, leftAt: row.left_at,
    durationMs: row.duration_ms, audioEnabled: row.audio_enabled === 1,
    videoEnabled: row.video_enabled === 1, screenSharing: row.screen_sharing === 1,
    role: row.role, createdAt: row.created_at,
  };
}
