export const DEFAULT_MONTHLY_GB_CAP = 80;
export const DEFAULT_MAX_CONCURRENT = 2;
export const DEFAULT_MAX_SESSION_SECONDS = 20 * 60;
const AUDIO_BYTES_PER_SEC = 16_000;
const VIDEO_BYTES_PER_SEC = 120_000;
const SAFETY = 1.5;
const BYTES_PER_GB = 1e9;

export function monthUtcKey(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function envInt(env, key, fallback) {
  const n = Number(env?.[key]);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export function huddleSfuAllowVideo(env) {
  return String(env?.REALTIME_SFU_ALLOW_VIDEO || "").trim() === "true";
}

export function huddleSfuDisabled(env) {
  return String(env?.REALTIME_SFU_DISABLED || "").trim() === "true";
}

export function huddleSfuMonthlyCapBytes(env) {
  const gb = envInt(env, "REALTIME_SFU_MONTHLY_GB_CAP", DEFAULT_MONTHLY_GB_CAP);
  return Math.max(1, gb) * BYTES_PER_GB;
}

export function estimateHuddleBytes({ durationMs, hasVideo, peerCount }) {
  const seconds = Math.max(1, durationMs / 1000);
  const hops = Math.max(1, Number(peerCount) || 1);
  const rate = AUDIO_BYTES_PER_SEC + (hasVideo ? VIDEO_BYTES_PER_SEC : 0);
  return Math.ceil(seconds * rate * hops * SAFETY);
}

async function expireStaleHuddleSessions(env) {
  const maxMs = envInt(env, "REALTIME_SFU_MAX_SESSION_SECONDS", DEFAULT_MAX_SESSION_SECONDS) * 1000;
  const cutoff = Date.now() - maxMs;
  const rows = await env.DB.prepare("SELECT * FROM huddle_sfu_open").all();
  for (const row of rows.results || []) {
    const started = new Date(row.started_at).getTime();
    if (Number.isFinite(started) && started < cutoff) {
      await chargeOpenRow(env, row);
    }
  }
}

export async function huddleSfuBudgetSnapshot(env) {
  await expireStaleHuddleSessions(env);
  const month = monthUtcKey();
  const openRow = await env.DB.prepare("SELECT COUNT(*) as n FROM huddle_sfu_open").first();
  const meter = await env.DB.prepare("SELECT month_utc, bytes_used FROM huddle_sfu_meter WHERE month_utc = ?")
    .bind(month)
    .first();
  const capBytes = huddleSfuMonthlyCapBytes(env);
  const bytesUsed = Number(meter?.bytes_used || 0);
  return {
    month,
    bytesUsed,
    capBytes,
    remainingBytes: Math.max(0, capBytes - bytesUsed),
    openSessions: Number(openRow?.n || 0),
    maxConcurrent: envInt(env, "REALTIME_SFU_MAX_CONCURRENT", DEFAULT_MAX_CONCURRENT),
    maxSessionSeconds: envInt(env, "REALTIME_SFU_MAX_SESSION_SECONDS", DEFAULT_MAX_SESSION_SECONDS),
    allowVideo: huddleSfuAllowVideo(env),
    disabled: huddleSfuDisabled(env),
    monthlyGbCap: envInt(env, "REALTIME_SFU_MONTHLY_GB_CAP", DEFAULT_MONTHLY_GB_CAP),
  };
}

export async function assertHuddleSfuBudget(env, { hasVideo } = {}) {
  if (huddleSfuDisabled(env)) return { ok: false, reason: "disabled" };
  if (hasVideo && !huddleSfuAllowVideo(env)) return { ok: false, reason: "video_disabled" };
  const snap = await huddleSfuBudgetSnapshot(env);
  if (snap.openSessions >= snap.maxConcurrent) return { ok: false, reason: "concurrent", snapshot: snap };
  if (snap.bytesUsed >= snap.capBytes) return { ok: false, reason: "monthly_gb", snapshot: snap };
  return { ok: true, snapshot: snap };
}

export function assertLocalPublishAllowed(env, tracks) {
  const local = (tracks || []).filter((t) => t.location === "local");
  if (!huddleSfuAllowVideo(env) && local.length > 1) {
    return { ok: false, reason: "video_disabled" };
  }
  return { ok: true };
}

export async function beginHuddleSfuSession(env, { sessionId, projectId, roomId, userId, hasVideo }) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO huddle_sfu_open (session_id, project_id, room_id, user_id, has_video, started_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(sessionId, projectId, roomId, userId, hasVideo ? 1 : 0, now)
    .run();
}

async function addMeterBytes(env, bytes) {
  const month = monthUtcKey();
  const row = await env.DB.prepare("SELECT month_utc, bytes_used FROM huddle_sfu_meter WHERE month_utc = ?")
    .bind(month)
    .first();
  const next = Number(row?.bytes_used || 0) + bytes;
  if (row?.month_utc) {
    await env.DB.prepare("UPDATE huddle_sfu_meter SET bytes_used = ? WHERE month_utc = ?")
      .bind(next, month)
      .run();
  } else {
    await env.DB.prepare("INSERT INTO huddle_sfu_meter (month_utc, bytes_used) VALUES (?, ?)")
      .bind(month, next)
      .run();
  }
}

async function chargeOpenRow(env, row) {
  if (!row) return;
  const openRow = await env.DB.prepare("SELECT COUNT(*) as n FROM huddle_sfu_open").first();
  const durationMs = Math.max(1000, Date.now() - new Date(row.started_at).getTime());
  const bytes = estimateHuddleBytes({
    durationMs,
    hasVideo: Boolean(row.has_video),
    peerCount: Math.max(2, Number(openRow?.n || 1)),
  });
  await addMeterBytes(env, bytes);
  await env.DB.prepare("DELETE FROM huddle_sfu_open WHERE session_id = ?").bind(row.session_id).run();
}

export async function settleHuddleSfuSession(env, { sessionId, projectId, roomId, userId }) {
  if (sessionId) {
    const row = await env.DB.prepare("SELECT * FROM huddle_sfu_open WHERE session_id = ?")
      .bind(sessionId)
      .first();
    await chargeOpenRow(env, row);
    return;
  }
  const rows = await env.DB.prepare(
    "SELECT * FROM huddle_sfu_open WHERE project_id = ? AND room_id = ? AND user_id = ?",
  )
    .bind(projectId, roomId, userId)
    .all();
  for (const row of rows.results || []) {
    await chargeOpenRow(env, row);
  }
}

export async function markHuddleSfuVideo(env, { sessionId }) {
  await env.DB.prepare("UPDATE huddle_sfu_open SET has_video = 1 WHERE session_id = ?")
    .bind(sessionId)
    .run();
}
