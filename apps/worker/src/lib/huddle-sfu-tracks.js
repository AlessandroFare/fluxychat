const MAX_SDP_CHARS = 64 * 1024;
const MAX_TRACKS = 8;
const MAX_NAME = 128;

function asTrimmedString(value, max) {
  const s = String(value ?? "").trim();
  if (!s || s.length > max) return "";
  return s;
}

export function sanitizeSessionDescription(raw, allowedTypes) {
  if (!raw || typeof raw !== "object") {
    throw new Error("sessionDescription is required");
  }
  const type = String(raw.type || "");
  if (!allowedTypes.includes(type)) {
    throw new Error("sessionDescription.type is invalid");
  }
  const sdp = String(raw.sdp ?? "");
  if (!sdp || sdp.length > MAX_SDP_CHARS) {
    throw new Error("sessionDescription.sdp is invalid");
  }
  return { type, sdp };
}

export function sanitizeSfuSessionPayload(body) {
  return {
    sessionDescription: sanitizeSessionDescription(body?.sessionDescription, ["offer"]),
  };
}

export function sanitizeSfuRenegotiatePayload(body) {
  return {
    sessionDescription: sanitizeSessionDescription(body?.sessionDescription, ["answer"]),
  };
}

export function sanitizeSfuTracksPayload(body) {
  const tracksIn = Array.isArray(body?.tracks) ? body.tracks : [];
  if (!tracksIn.length || tracksIn.length > MAX_TRACKS) {
    throw new Error("tracks is invalid");
  }
  const tracks = tracksIn.map((track) => {
    const location = String(track?.location || "");
    const trackName = asTrimmedString(track?.trackName, MAX_NAME);
    if (!trackName) throw new Error("trackName is invalid");
    if (location === "local") {
      const mid = asTrimmedString(track?.mid, 32);
      if (!mid) throw new Error("mid is invalid");
      return { location: "local", mid, trackName };
    }
    if (location === "remote") {
      const sessionId = asTrimmedString(track?.sessionId, MAX_NAME);
      if (!sessionId) throw new Error("sessionId is invalid");
      return { location: "remote", sessionId, trackName };
    }
    throw new Error("location is invalid");
  });
  const payload = { tracks };
  if (body?.sessionDescription) {
    payload.sessionDescription = sanitizeSessionDescription(body.sessionDescription, [
      "offer",
      "answer",
    ]);
  }
  return payload;
}

function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function withdrawHuddleSfuTracks(env, { projectId, roomId, userId }) {
  await env.DB.prepare(
    "DELETE FROM huddle_sfu_tracks WHERE project_id = ? AND room_id = ? AND user_id = ?",
  )
    .bind(projectId, roomId, userId)
    .run();
}

export async function announceHuddleSfuTracks(env, { projectId, roomId, userId, sessionId, tracks }) {
  const session = asTrimmedString(sessionId, MAX_NAME);
  const list = Array.isArray(tracks) ? tracks.slice(0, MAX_TRACKS) : [];
  if (!session || !list.length) throw new Error("tracks is invalid");
  await withdrawHuddleSfuTracks(env, { projectId, roomId, userId });
  const now = new Date().toISOString();
  for (const track of list) {
    const trackName = asTrimmedString(track.trackName, MAX_NAME);
    const kind = track.kind === "video" ? "video" : "audio";
    if (!trackName) continue;
    await env.DB.prepare(
      `INSERT INTO huddle_sfu_tracks (id, project_id, room_id, user_id, session_id, track_name, kind, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(`hst_${generateId()}`, projectId, roomId, userId, session, trackName, kind, now)
      .run();
  }
}

export async function listHuddleSfuTracks(env, { projectId, roomId, userId }) {
  const rows = await env.DB.prepare(
    `SELECT project_id, room_id, user_id, session_id, track_name, kind
     FROM huddle_sfu_tracks
     WHERE project_id = ? AND room_id = ? AND user_id != ?
     ORDER BY created_at ASC`,
  )
    .bind(projectId, roomId, userId)
    .all();
  return rows.results || [];
}
