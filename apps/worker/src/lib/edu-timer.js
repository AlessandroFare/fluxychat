import { fanoutServerEvent } from "./message-realtime-fanout.js";

export const MAX_TIMER_MS = 24 * 60 * 60 * 1000;
const MODES = new Set(["timer", "stopwatch"]);

function nowIso() {
  return new Date().toISOString();
}

function parseMode(input) {
  if (input?.stopwatch === true) return "stopwatch";
  const mode = String(input?.mode || "").trim();
  if (MODES.has(mode)) return mode;
  return "timer";
}

function parseTimeMs(value) {
  if (value == null) return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.floor(n), MAX_TIMER_MS);
}

function snapshot(row, now = Date.now()) {
  const mode = row?.mode === "stopwatch" ? "stopwatch" : "timer";
  const running = row?.running === 1;
  const startedAt = row?.started_at ? Date.parse(row.started_at) : NaN;
  const elapsed = running && Number.isFinite(startedAt) ? Math.max(0, now - startedAt) : 0;
  let timeMs;
  if (mode === "stopwatch") {
    timeMs = (row?.accumulated_ms || 0) + elapsed;
  } else {
    timeMs = Math.max(0, (row?.time_ms || 0) - elapsed);
  }
  return {
    mode,
    running,
    timeMs: Math.min(timeMs, MAX_TIMER_MS),
    startedAt: row?.started_at || null,
    updatedAt: row?.updated_at || null,
  };
}

async function loadRow(env, projectId, roomId) {
  return env.DB.prepare(
    `SELECT project_id, room_id, mode, running, time_ms, accumulated_ms, started_at, updated_at
     FROM room_edu_timers WHERE project_id = ? AND room_id = ? LIMIT 1`,
  )
    .bind(projectId, roomId)
    .first();
}

async function saveRow(env, row) {
  await env.DB.prepare(
    `INSERT INTO room_edu_timers
       (project_id, room_id, mode, running, time_ms, accumulated_ms, started_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, room_id) DO UPDATE SET
       mode = excluded.mode,
       running = excluded.running,
       time_ms = excluded.time_ms,
       accumulated_ms = excluded.accumulated_ms,
       started_at = excluded.started_at,
       updated_at = excluded.updated_at`,
  )
    .bind(
      row.project_id,
      row.room_id,
      row.mode,
      row.running,
      row.time_ms,
      row.accumulated_ms,
      row.started_at,
      row.updated_at,
    )
    .run();
}

function freeze(row, now = Date.now()) {
  const snap = snapshot(row, now);
  if (snap.mode === "stopwatch") {
    return {
      ...row,
      running: 0,
      accumulated_ms: snap.timeMs,
      time_ms: 0,
      started_at: null,
    };
  }
  return {
    ...row,
    running: 0,
    time_ms: snap.timeMs,
    accumulated_ms: 0,
    started_at: null,
  };
}

async function persistAndFanout(env, input, row) {
  const updated = { ...row, updated_at: nowIso() };
  await saveRow(env, updated);
  const timer = snapshot(updated);
  await fanoutServerEvent(env, {
    projectId: input.projectId,
    roomId: input.roomId,
    name: "edu.timer",
    userId: input.userId,
    data: timer,
  }).catch(() => {});
  return { ok: true, timer };
}

function emptyRow(projectId, roomId) {
  return {
    project_id: projectId,
    room_id: roomId,
    mode: "timer",
    running: 0,
    time_ms: 0,
    accumulated_ms: 0,
    started_at: null,
    updated_at: nowIso(),
  };
}

export async function getRoomTimer(env, input) {
  const row = await loadRow(env, input.projectId, input.roomId);
  return { ok: true, timer: snapshot(row || emptyRow(input.projectId, input.roomId)) };
}

export async function activateRoomTimer(env, input) {
  const mode = parseMode(input);
  const timeMs = parseTimeMs(input.timeMs ?? input.time);
  if (timeMs == null) return { ok: false, error: "invalid_time" };
  const running = input.running === true || input.running === 1;
  const now = nowIso();
  const row = {
    project_id: input.projectId,
    room_id: input.roomId,
    mode,
    running: running ? 1 : 0,
    time_ms: mode === "timer" ? timeMs : 0,
    accumulated_ms: mode === "stopwatch" ? timeMs : 0,
    started_at: running ? now : null,
    updated_at: now,
  };
  return persistAndFanout(env, input, row);
}

export async function startRoomTimer(env, input) {
  const row = (await loadRow(env, input.projectId, input.roomId))
    || emptyRow(input.projectId, input.roomId);
  if (row.running === 1) return { ok: true, timer: snapshot(row) };
  const now = nowIso();
  return persistAndFanout(env, input, {
    ...row,
    running: 1,
    started_at: now,
  });
}

export async function stopRoomTimer(env, input) {
  const row = await loadRow(env, input.projectId, input.roomId);
  if (!row) return { ok: true, timer: snapshot(emptyRow(input.projectId, input.roomId)) };
  if (row.running !== 1) return { ok: true, timer: snapshot(row) };
  return persistAndFanout(env, input, freeze(row));
}

export async function resetRoomTimer(env, input) {
  return persistAndFanout(env, input, {
    ...emptyRow(input.projectId, input.roomId),
    mode: (await loadRow(env, input.projectId, input.roomId))?.mode || "timer",
  });
}

export async function setRoomTimerTime(env, input) {
  const timeMs = parseTimeMs(input.timeMs ?? input.time);
  if (timeMs == null) return { ok: false, error: "invalid_time" };
  const existing = (await loadRow(env, input.projectId, input.roomId))
    || emptyRow(input.projectId, input.roomId);
  const frozen = existing.running === 1 ? freeze(existing) : existing;
  const next = {
    ...frozen,
    time_ms: frozen.mode === "timer" ? timeMs : 0,
    accumulated_ms: frozen.mode === "stopwatch" ? timeMs : 0,
  };
  return persistAndFanout(env, input, next);
}

export async function setRoomTimerMode(env, input) {
  const mode = parseMode(input);
  const existing = (await loadRow(env, input.projectId, input.roomId))
    || emptyRow(input.projectId, input.roomId);
  const frozen = existing.running === 1 ? freeze(existing) : existing;
  return persistAndFanout(env, input, {
    ...frozen,
    mode,
    time_ms: mode === "timer" ? frozen.time_ms || frozen.accumulated_ms || 0 : 0,
    accumulated_ms: mode === "stopwatch" ? frozen.accumulated_ms || frozen.time_ms || 0 : 0,
  });
}
