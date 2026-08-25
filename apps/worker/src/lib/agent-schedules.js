/**
 * Room-local agent schedules (CF-A-020).
 *
 * Cloudflare Agents persist `schedule()` next to the object. We do the same
 * in the Room DO: cron + delay rows, idempotent upsert, atomic claim on wake.
 * D1 is not the source of truth — hibernation must not lose the next fire.
 */

export const AGENT_SCHEDULES_STORAGE_KEY = "agent-schedules:v1";
export const AGENT_SCHEDULE_ALARM_JOB = "agent-schedules";
export const MAX_AGENT_SCHEDULES_PER_ROOM = 50;
export const MAX_DELAY_MS = 30 * 24 * 60 * 60 * 1000;
export const MIN_CRON_INTERVAL_MS = 60_000;
export const STUCK_CLAIM_MS = 5 * 60 * 1000;

export const AGENT_SCHEDULES_DDL = `CREATE TABLE IF NOT EXISTS agent_schedules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  prompt TEXT NOT NULL,
  idempotency_key TEXT,
  cron_expression TEXT,
  delay_ms INTEGER,
  next_run_at INTEGER NOT NULL,
  last_run_id TEXT,
  fail_count INTEGER NOT NULL DEFAULT 0,
  claimed_at INTEGER,
  created_at INTEGER NOT NULL,
  created_by TEXT
)`;

function generateId() {
  return `asch_${Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * @param {string} field
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
export function cronFieldMatches(field, value, min, max) {
  const raw = String(field || "").trim();
  if (!raw) return false;
  if (raw === "*") return true;
  for (const part of raw.split(",")) {
    const token = part.trim();
    if (!token) continue;
    const stepMatch = token.match(/^\*(?:\/(\d+))?$/);
    if (stepMatch) {
      const step = Number(stepMatch[1] || 1);
      if (!Number.isInteger(step) || step < 1) return false;
      return (value - min) % step === 0;
    }
    const rangeStep = token.match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
    if (rangeStep) {
      const a = Number(rangeStep[1]);
      const b = Number(rangeStep[2]);
      const step = Number(rangeStep[3] || 1);
      if (a < min || b > max || a > b || step < 1) continue;
      if (value >= a && value <= b && (value - a) % step === 0) return true;
      continue;
    }
    if (/^\d+$/.test(token)) {
      const n = Number(token);
      if (n === value && n >= min && n <= max) return true;
    }
  }
  return false;
}

/**
 * @param {string} expr
 * @returns {{ ok: true, fields: string[] } | { ok: false, reason: string }}
 */
export function parseCronExpression(expr) {
  const fields = String(expr || "")
    .trim()
    .split(/\s+/);
  if (fields.length !== 5) return { ok: false, reason: "cron_must_be_5_fields" };
  const bounds = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 6],
  ];
  for (let i = 0; i < 5; i++) {
    const probe = i === 2 ? 1 : 0;
    if (!cronFieldMatches(fields[i], probe < bounds[i][0] ? bounds[i][0] : probe, bounds[i][0], bounds[i][1])
      && fields[i] !== "*"
      && !/^[\d,/*-]+$/.test(fields[i])) {
      return { ok: false, reason: `invalid_cron_field:${i}` };
    }
    if (!/^[\d,/*-]+$/.test(fields[i]) && fields[i] !== "*") {
      return { ok: false, reason: `invalid_cron_field:${i}` };
    }
  }
  return { ok: true, fields };
}

/**
 * Next UTC minute (inclusive of `afterMs + 60s`) that matches a 5-field cron.
 * @param {string} expr
 * @param {number} afterMs
 * @returns {number | null}
 */
export function nextCronOccurrence(expr, afterMs = Date.now()) {
  const parsed = parseCronExpression(expr);
  if (!parsed.ok) return null;
  const [minute, hour, day, month, weekday] = parsed.fields;
  const start = Math.floor(Number(afterMs) / 60_000) * 60_000 + 60_000;
  const max = 366 * 24 * 60;
  for (let i = 0; i < max; i++) {
    const t = start + i * 60_000;
    const d = new Date(t);
    if (!cronFieldMatches(minute, d.getUTCMinutes(), 0, 59)) continue;
    if (!cronFieldMatches(hour, d.getUTCHours(), 0, 23)) continue;
    if (!cronFieldMatches(day, d.getUTCDate(), 1, 31)) continue;
    if (!cronFieldMatches(month, d.getUTCMonth() + 1, 1, 12)) continue;
    if (!cronFieldMatches(weekday, d.getUTCDay(), 0, 6)) continue;
    return t;
  }
  return null;
}

/**
 * @param {Record<string, unknown>} input
 * @param {number} [now]
 */
export function validateAgentScheduleInput(input, now = Date.now()) {
  const agentId = String(input?.agentId || "").trim();
  const prompt = String(input?.prompt || "Scheduled agent wake.").trim().slice(0, 4000);
  const kind = String(input?.kind || "").trim();
  const idempotencyKey = input?.idempotencyKey != null
    ? String(input.idempotencyKey).trim().slice(0, 128)
    : "";
  if (!agentId) return { ok: false, reason: "agent_id_required" };
  if (kind !== "delay" && kind !== "cron") return { ok: false, reason: "kind_must_be_delay_or_cron" };

  if (kind === "delay") {
    const delayMs = Number(input.delayMs);
    if (!Number.isFinite(delayMs) || delayMs < 1_000) return { ok: false, reason: "delay_ms_min_1000" };
    if (delayMs > MAX_DELAY_MS) return { ok: false, reason: "delay_ms_too_large" };
    return {
      ok: true,
      value: {
        kind,
        agentId,
        prompt,
        idempotencyKey: idempotencyKey || null,
        delayMs,
        cronExpression: null,
        nextRunAt: now + delayMs,
      },
    };
  }

  const cronExpression = String(input.cron || input.cronExpression || "").trim();
  const parsed = parseCronExpression(cronExpression);
  if (!parsed.ok) return parsed;
  const nextRunAt = nextCronOccurrence(cronExpression, now);
  if (!nextRunAt) return { ok: false, reason: "cron_no_next_occurrence" };
  if (nextRunAt - now < MIN_CRON_INTERVAL_MS) {
    const later = nextCronOccurrence(cronExpression, now + MIN_CRON_INTERVAL_MS - 1);
    if (!later) return { ok: false, reason: "cron_no_next_occurrence" };
    return {
      ok: true,
      value: {
        kind,
        agentId,
        prompt,
        idempotencyKey: idempotencyKey || null,
        delayMs: null,
        cronExpression,
        nextRunAt: later,
      },
    };
  }
  return {
    ok: true,
    value: {
      kind,
      agentId,
      prompt,
      idempotencyKey: idempotencyKey || null,
      delayMs: null,
      cronExpression,
      nextRunAt,
    },
  };
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {object} input
 */
export function upsertAgentSchedule(rows, input, now = Date.now()) {
  const validated = validateAgentScheduleInput(input, now);
  if (!validated.ok) return validated;
  const list = Array.isArray(rows) ? rows : [];
  const key = validated.value.idempotencyKey;
  if (key) {
    const existing = list.find(
      (r) => r.idempotencyKey === key && r.status !== "cancelled" && r.status !== "done",
    );
    if (existing) return { ok: true, created: false, schedule: existing };
  }
  const active = list.filter((r) => r.status === "pending" || r.status === "running");
  if (active.length >= MAX_AGENT_SCHEDULES_PER_ROOM) {
    return { ok: false, reason: "too_many_schedules" };
  }
  const schedule = {
    id: generateId(),
    projectId: String(input.projectId || ""),
    roomId: String(input.roomId || ""),
    agentId: validated.value.agentId,
    kind: validated.value.kind,
    status: "pending",
    prompt: validated.value.prompt,
    idempotencyKey: key,
    cronExpression: validated.value.cronExpression,
    delayMs: validated.value.delayMs,
    nextRunAt: validated.value.nextRunAt,
    lastRunId: null,
    failCount: 0,
    claimedAt: null,
    createdAt: now,
    createdBy: input.createdBy ? String(input.createdBy) : null,
  };
  list.push(schedule);
  return { ok: true, created: true, schedule, rows: list };
}

export function cancelAgentSchedule(rows, scheduleId) {
  const list = Array.isArray(rows) ? rows : [];
  const row = list.find((r) => r.id === scheduleId);
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status === "done" || row.status === "cancelled") {
    return { ok: true, schedule: row };
  }
  row.status = "cancelled";
  row.claimedAt = null;
  return { ok: true, schedule: row };
}

/**
 * Claim every pending (or stuck running) row due at `now`.
 * Re-entrant: a second claim on the same generation is a no-op.
 */
export function claimDueAgentSchedules(rows, now = Date.now()) {
  const due = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row.status === "cancelled" || row.status === "done" || row.status === "failed") continue;
    const next = Number(row.nextRunAt);
    if (!Number.isFinite(next) || next > now) continue;
    if (row.status === "running") {
      const claimedAt = Number(row.claimedAt) || 0;
      if (now - claimedAt < STUCK_CLAIM_MS) continue;
    }
    row.status = "running";
    row.claimedAt = now;
    due.push(row);
  }
  return due;
}

export function completeAgentScheduleFire(row, {
  ok,
  now = Date.now(),
  runId = null,
  error = null,
  retry = true,
  delayMs = null,
} = {}) {
  if (!row) return row;
  row.lastRunId = runId;
  row.lastError = error || null;
  if (row.kind === "cron" && row.cronExpression) {
    const next = nextCronOccurrence(row.cronExpression, now);
    row.status = "pending";
    row.claimedAt = null;
    row.nextRunAt = next || now + 60 * 60 * 1000;
    if (!ok) row.failCount = Number(row.failCount || 0) + 1;
    else row.failCount = 0;
    return row;
  }
  if (ok) {
    row.status = "done";
    row.claimedAt = null;
    return row;
  }
  const fails = Number(row.failCount || 0) + 1;
  row.failCount = fails;
  row.claimedAt = null;
  if (retry === false) {
    row.status = "failed";
    return row;
  }
  row.status = "pending";
  const wait = Number(delayMs);
  row.nextRunAt = now + (Number.isFinite(wait) && wait > 0
    ? wait
    : Math.min(30 * 60 * 1000, 5_000 * 2 ** Math.min(fails, 6)));
  return row;
}

export function earliestAgentScheduleDueAt(rows) {
  let min = null;
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row.status !== "pending" && row.status !== "running") continue;
    const next = Number(row.nextRunAt);
    if (!Number.isFinite(next)) continue;
    if (min == null || next < min) min = next;
  }
  return min;
}

export function serializeSchedule(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    roomId: row.roomId,
    agentId: row.agentId,
    kind: row.kind,
    status: row.status,
    prompt: row.prompt,
    idempotencyKey: row.idempotencyKey,
    cron: row.cronExpression,
    delayMs: row.delayMs,
    nextRunAt: row.nextRunAt,
    lastRunId: row.lastRunId,
    failCount: row.failCount,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
  };
}

function mapSqlRow(row) {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    roomId: String(row.room_id),
    agentId: String(row.agent_id),
    kind: String(row.kind),
    status: String(row.status),
    prompt: String(row.prompt || ""),
    idempotencyKey: row.idempotency_key ? String(row.idempotency_key) : null,
    cronExpression: row.cron_expression ? String(row.cron_expression) : null,
    delayMs: row.delay_ms != null ? Number(row.delay_ms) : null,
    nextRunAt: Number(row.next_run_at),
    lastRunId: row.last_run_id ? String(row.last_run_id) : null,
    failCount: Number(row.fail_count) || 0,
    claimedAt: row.claimed_at != null ? Number(row.claimed_at) : null,
    createdAt: Number(row.created_at),
    createdBy: row.created_by ? String(row.created_by) : null,
  };
}

export function ensureAgentSchedulesSql(sql) {
  if (!sql || typeof sql.exec !== "function") return false;
  sql.exec(AGENT_SCHEDULES_DDL);
  return true;
}

export function readAgentSchedulesFromSql(sql) {
  if (!ensureAgentSchedulesSql(sql)) return null;
  const rows = [];
  for (const row of sql.exec("SELECT * FROM agent_schedules")) {
    rows.push(mapSqlRow(row));
  }
  return rows;
}

export function writeAgentSchedulesToSql(sql, rows) {
  if (!ensureAgentSchedulesSql(sql)) return false;
  sql.exec("DELETE FROM agent_schedules");
  for (const row of rows) {
    sql.exec(
      `INSERT INTO agent_schedules (
        id, project_id, room_id, agent_id, kind, status, prompt, idempotency_key,
        cron_expression, delay_ms, next_run_at, last_run_id, fail_count, claimed_at, created_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.projectId,
      row.roomId,
      row.agentId,
      row.kind,
      row.status,
      row.prompt,
      row.idempotencyKey,
      row.cronExpression,
      row.delayMs,
      row.nextRunAt,
      row.lastRunId,
      row.failCount || 0,
      row.claimedAt,
      row.createdAt,
      row.createdBy,
    );
  }
  return true;
}

/**
 * Load / mutate / persist schedule rows. Prefers DO SQLite; KV is the test
 * and pre-sqlite fallback. Room DO is single-threaded so the read-modify-write
 * is safe without a D1 transaction.
 *
 * @param {{ get: Function, put: Function, sql?: { exec: Function } }} storage
 * @param {(rows: object[]) => object | Promise<object>} mutator
 */
export async function withAgentScheduleRows(storage, mutator) {
  if (!storage) return mutator([]);
  const sql = storage.sql;
  let rows;
  if (sql && typeof sql.exec === "function") {
    try {
      rows = readAgentSchedulesFromSql(sql) || [];
    } catch {
      rows = Object.values((await storage.get(AGENT_SCHEDULES_STORAGE_KEY)) || {});
    }
  } else {
    rows = Object.values((await storage.get(AGENT_SCHEDULES_STORAGE_KEY)) || {});
  }
  const out = await mutator(rows);
  const nextRows = Array.isArray(out?.rows) ? out.rows : rows;
  if (sql && typeof sql.exec === "function") {
    try {
      writeAgentSchedulesToSql(sql, nextRows);
    } catch {
      await storage.put(
        AGENT_SCHEDULES_STORAGE_KEY,
        Object.fromEntries(nextRows.map((r) => [r.id, r])),
      );
    }
  } else {
    await storage.put(
      AGENT_SCHEDULES_STORAGE_KEY,
      Object.fromEntries(nextRows.map((r) => [r.id, r])),
    );
  }
  return out;
}

export async function fireAgentSchedule(env, schedule, { skipRoomAnnounce = false } = {}) {
  const { executeAgentRun } = await import("./agent-runtime.js");
  const agentRow = await env.DB.prepare(
    `SELECT id, name, handle, provider, model, config, system_prompt, context_fetch_url, tool_execute_url, tools_schema, rate_limit_rpm, allowed_tools
     FROM bots WHERE project_id = ? AND id = ?`,
  )
    .bind(schedule.projectId, schedule.agentId)
    .first();
  if (!agentRow) return { ok: false, error: "agent_not_found" };
  const result = await executeAgentRun(env, {
    agentRow,
    projectId: schedule.projectId,
    roomId: schedule.roomId,
    userMessage: schedule.prompt,
    userId: "agent-schedule",
    traceId: schedule.id,
    streamHooks: null,
    skipRoomAnnounce,
  });
  if (result.status === "failed") {
    return { ok: false, error: result.error || "agent_run_failed", runId: result.runId };
  }
  return { ok: true, runId: result.runId, status: result.status };
}
