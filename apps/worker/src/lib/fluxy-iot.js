/**
 * D1-backed FluxyIoT devices, readings, rules, shadows (ROADMAP 5.2).
 */

import { fanoutServerEvent } from "./message-realtime-fanout.js";
import { hashDeviceSecret } from "./device-secret.js";
import { checkAndConsumeRateLimit } from "./rate-limit.js";

export const IOT_READINGS_PER_DAY = 5000;
/** ThingsBoard inactivity timeout analogue (10 min). */
export const IOT_ONLINE_TIMEOUT_MS = 10 * 60 * 1000;

export function isIoTLastSeenOnline(lastSeen, now = Date.now()) {
  if (!lastSeen) return false;
  const t = Date.parse(lastSeen);
  if (!Number.isFinite(t)) return false;
  return now - t <= IOT_ONLINE_TIMEOUT_MS;
}

export function compareIoTCondition(left, operator, right) {
  switch (operator) {
    case ">":
      return left > right;
    case "<":
      return left < right;
    case ">=":
      return left >= right;
    case "<=":
      return left <= right;
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    default:
      return false;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function rowToDevice(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    fleetId: row.fleet_id,
    roomId: row.room_id || undefined,
    status: row.status,
    firmwareVersion: row.firmware_version,
    lastSeen: row.last_seen || undefined,
    metadata: parseJson(row.metadata_json, {}),
    location: row.location_json ? parseJson(row.location_json, undefined) : undefined,
  };
}

export async function authenticateIoTDevice(env, apiKey) {
  const key = String(apiKey || "").trim();
  if (!key.startsWith("iot_")) return null;
  const hash = await hashDeviceSecret(key);
  const row = await env.DB.prepare(
    `SELECT id, project_id, room_id FROM iot_devices WHERE api_key_hash = ? LIMIT 1`,
  )
    .bind(hash)
    .first();
  if (!row) return null;
  return { id: row.id, projectId: row.project_id, roomId: row.room_id };
}

async function consumeIoTReadingQuota(env, projectId) {
  return checkAndConsumeRateLimit(env, {
    key: `iot-read:${projectId}`,
    limit: IOT_READINGS_PER_DAY,
    windowSeconds: 86400,
  });
}

export async function registerIoTDevice(env, auth, input) {
  const name = String(input.name ?? "").trim().slice(0, 100);
  if (!name) return { ok: false, error: "name_required" };

  const id = `dev_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const apiKey = `iot_${crypto.randomUUID().replace(/-/g, "")}`;
  const now = nowIso();
  const effectiveRoomId = input.roomId?.trim() || `iot:${auth.projectId}`;

  await env.DB.prepare(
    `INSERT INTO iot_devices
     (id, project_id, room_id, fleet_id, name, type, status, firmware_version, api_key_hash, metadata_json, location_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'offline', ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      auth.projectId,
      effectiveRoomId,
      String(input.fleetId ?? "default").slice(0, 64),
      name,
      String(input.type ?? "sensor").slice(0, 32),
      String(input.firmwareVersion ?? "1.0.0").slice(0, 32),
      await hashDeviceSecret(apiKey),
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.location ? JSON.stringify(input.location) : null,
      now,
      now,
    )
    .run();

  await env.DB.prepare(
    `INSERT INTO iot_device_shadows (device_id, project_id, reported_json, desired_json, updated_at)
     VALUES (?, ?, '{}', '{}', ?)`,
  )
    .bind(id, auth.projectId, now)
    .run();

  return { ok: true, device: rowToDevice({ id, name, type: input.type ?? "sensor", fleet_id: input.fleetId ?? "default", room_id: effectiveRoomId, status: "offline", firmware_version: input.firmwareVersion ?? "1.0.0", last_seen: null, metadata_json: input.metadata ? JSON.stringify(input.metadata) : null, location_json: input.location ? JSON.stringify(input.location) : null }), apiKey };
}

export async function listIoTDevices(env, auth, filter = {}) {
  let sql = `SELECT * FROM iot_devices WHERE project_id = ?`;
  const params = [auth.projectId];
  if (filter.fleetId) {
    sql += ` AND fleet_id = ?`;
    params.push(filter.fleetId);
  }
  sql += ` ORDER BY updated_at DESC LIMIT ?`;
  params.push(Math.min(Number(filter.limit) || 50, 100));

  const rows = await env.DB.prepare(sql).bind(...params).all();
  const now = Date.now();
  const devices = [];
  for (const row of rows.results || []) {
    if (row.status === "online" && !isIoTLastSeenOnline(row.last_seen, now)) {
      await env.DB.prepare(
        `UPDATE iot_devices SET status = 'offline' WHERE id = ? AND project_id = ?`,
      ).bind(row.id, auth.projectId).run();
      devices.push(rowToDevice({ ...row, status: "offline" }));
      continue;
    }
    devices.push(rowToDevice(row));
  }
  return { ok: true, devices };
}

export async function ingestIoTReading(env, auth, deviceId, input) {
  const quota = await consumeIoTReadingQuota(env, auth.projectId);
  if (!quota.allowed) {
    return { ok: false, error: "quota_exceeded", retryAfterSeconds: quota.retryAfterSeconds };
  }

  const device = await env.DB.prepare(
    `SELECT id, room_id FROM iot_devices WHERE project_id = ? AND id = ?`,
  )
    .bind(auth.projectId, deviceId)
    .first();
  if (!device) return { ok: false, error: "not_found" };

  const sensor = String(input.sensor ?? "value").slice(0, 64);
  const value = Number(input.value);
  if (!Number.isFinite(value)) return { ok: false, error: "invalid_value" };

  const id = `rd_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = nowIso();

  await env.DB.prepare(
    `INSERT INTO iot_readings (id, project_id, device_id, sensor, value, unit, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, auth.projectId, deviceId, sensor, value, String(input.unit ?? ""), now)
    .run();

  await env.DB.prepare(
    `UPDATE iot_devices SET status = 'online', last_seen = ?, updated_at = ? WHERE id = ? AND project_id = ?`,
  )
    .bind(now, now, deviceId, auth.projectId)
    .run();

  const shadowRow = await env.DB.prepare(
    `SELECT reported_json FROM iot_device_shadows WHERE device_id = ? AND project_id = ?`,
  )
    .bind(deviceId, auth.projectId)
    .first();
  const reported = {
    ...parseJson(shadowRow?.reported_json, {}),
    [sensor]: value,
    lastReadingAt: now,
  };
  await env.DB.prepare(
    `UPDATE iot_device_shadows SET reported_json = ?, updated_at = ? WHERE device_id = ? AND project_id = ?`,
  )
    .bind(JSON.stringify(reported), now, deviceId, auth.projectId)
    .run();

  if (device.room_id) {
    await fanoutServerEvent(env, {
      projectId: auth.projectId,
      roomId: device.room_id,
      name: "iot.reading",
      userId: deviceId,
      data: { deviceId, sensor, value, unit: input.unit ?? "", recordedAt: now },
    }).catch(() => {});

    const auto = await env.DB.prepare(
      "SELECT iot_auto_agent_id FROM project_publish_config WHERE project_id = ? LIMIT 1",
    )
      .bind(auth.projectId)
      .first()
      .catch(() => null);
    const agentId = typeof auto?.iot_auto_agent_id === "string" ? auto.iot_auto_agent_id.trim() : "";
    if (agentId) {
      const { invokeMentionedAgents } = await import("./agent-runtime.js");
      await invokeMentionedAgents(
        env,
        auth.projectId,
        device.room_id,
        deviceId,
        `@${agentId} iot.reading ${sensor}=${value}`,
        [agentId],
        `iot_${id}`,
      ).catch(() => {});
    }
  }

  const alarms = await fireIoTRules(env, auth.projectId, deviceId, sensor, value);
  return { ok: true, reading: { id, deviceId, sensor, value, unit: input.unit ?? "", timestamp: now }, alarms };
}

export async function createIoTRule(env, auth, input) {
  const name = String(input.name ?? "").trim().slice(0, 100);
  if (!name || !input.condition || !input.action) {
    return { ok: false, error: "invalid_rule" };
  }

  const id = `rule_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = nowIso();

  await env.DB.prepare(
    `INSERT INTO iot_rules (id, project_id, device_id, fleet_id, name, enabled, condition_json, action_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      auth.projectId,
      input.deviceId || null,
      input.fleetId || null,
      name,
      JSON.stringify(input.condition),
      JSON.stringify(input.action),
      now,
      now,
    )
    .run();

  return { ok: true, rule: { id, name, deviceId: input.deviceId, fleetId: input.fleetId, condition: input.condition, action: input.action } };
}

export async function getIoTShadow(env, auth, deviceId) {
  const row = await env.DB.prepare(
    `SELECT * FROM iot_device_shadows WHERE project_id = ? AND device_id = ?`,
  )
    .bind(auth.projectId, deviceId)
    .first();
  if (!row) return { ok: false, error: "not_found" };
  return {
    ok: true,
    shadow: {
      deviceId,
      reported: parseJson(row.reported_json, {}),
      desired: parseJson(row.desired_json, {}),
      updatedAt: row.updated_at,
    },
  };
}

export function scoreIoTReadings(values) {
  const nums = values.filter((n) => Number.isFinite(n));
  if (!nums.length) {
    return { ok: true, sampleSize: 0, mean: null, slope: null, health: 100, alerts: [] };
  }
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
  const stdev = Math.sqrt(variance);
  const n = nums.length;
  const xMean = (n - 1) / 2;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (nums[i] - mean);
    den += (i - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const last = nums[n - 1];
  const alerts = [];
  if (stdev > 0 && Math.abs(last - mean) > 2 * stdev) alerts.push("spike");
  if (Math.abs(slope) > Math.abs(mean) * 0.05 + 0.01) alerts.push("trend");
  const health = Math.max(0, Math.min(100, Math.round(100 - alerts.length * 18 - Math.min(40, stdev * 2))));
  return { ok: true, sampleSize: n, mean, slope, stdev, last, health, alerts };
}

export async function listIoTReadings(env, auth, deviceId, filter = {}) {
  const device = await env.DB.prepare(
    `SELECT id FROM iot_devices WHERE project_id = ? AND id = ?`,
  )
    .bind(auth.projectId, deviceId)
    .first();
  if (!device) return { ok: false, error: "not_found" };

  let sql = `SELECT id, device_id, sensor, value, unit, recorded_at
             FROM iot_readings WHERE project_id = ? AND device_id = ?`;
  const params = [auth.projectId, deviceId];
  if (filter.sensor) {
    sql += ` AND sensor = ?`;
    params.push(String(filter.sensor).slice(0, 64));
  }
  if (filter.from) {
    sql += ` AND recorded_at >= ?`;
    params.push(String(filter.from));
  }
  if (filter.to) {
    sql += ` AND recorded_at <= ?`;
    params.push(String(filter.to));
  }
  const cap = Math.min(Number(filter.limit) || 100, 500);
  sql += ` ORDER BY recorded_at DESC LIMIT ?`;
  params.push(cap);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return {
    ok: true,
    readings: (rows.results || []).map((r) => ({
      id: r.id,
      deviceId: r.device_id,
      sensor: r.sensor,
      value: r.value,
      unit: r.unit,
      timestamp: r.recorded_at,
    })),
  };
}

export async function getIoTDeviceHealth(env, auth, deviceId, sensor) {
  const device = await env.DB.prepare(
    `SELECT id FROM iot_devices WHERE project_id = ? AND id = ?`,
  )
    .bind(auth.projectId, deviceId)
    .first();
  if (!device) return { ok: false, error: "not_found" };

  let sql = `SELECT value FROM iot_readings WHERE project_id = ? AND device_id = ?`;
  const params = [auth.projectId, deviceId];
  if (sensor) {
    sql += ` AND sensor = ?`;
    params.push(String(sensor).slice(0, 64));
  }
  sql += ` ORDER BY recorded_at DESC LIMIT 50`;
  const rows = await env.DB.prepare(sql).bind(...params).all();
  const values = (rows.results || []).map((r) => Number(r.value)).reverse();
  return { ok: true, deviceId, sensor: sensor || null, ...scoreIoTReadings(values) };
}

export async function updateIoTDesiredShadow(env, auth, deviceId, desired) {
  const now = nowIso();
  const result = await env.DB.prepare(
    `UPDATE iot_device_shadows SET desired_json = ?, updated_at = ? WHERE project_id = ? AND device_id = ?`,
  )
    .bind(JSON.stringify(desired ?? {}), now, auth.projectId, deviceId)
    .run();
  if (!result.meta?.changes) return { ok: false, error: "not_found" };
  return getIoTShadow(env, auth, deviceId);
}

export async function mergeIoTReported(env, auth, deviceId, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return { ok: false, error: "reported_object_required" };
  }
  const row = await env.DB.prepare(
    `SELECT reported_json FROM iot_device_shadows WHERE project_id = ? AND device_id = ?`,
  )
    .bind(auth.projectId, deviceId)
    .first();
  if (!row) return { ok: false, error: "not_found" };
  const reported = { ...parseJson(row.reported_json, {}), ...patch, lastReadingAt: nowIso() };
  await env.DB.prepare(
    `UPDATE iot_device_shadows SET reported_json = ?, updated_at = ? WHERE project_id = ? AND device_id = ?`,
  )
    .bind(JSON.stringify(reported), nowIso(), auth.projectId, deviceId)
    .run();
  return getIoTShadow(env, auth, deviceId);
}

export async function listIoTReadingKeys(env, auth, deviceId) {
  const device = await env.DB.prepare(
    `SELECT id FROM iot_devices WHERE project_id = ? AND id = ?`,
  )
    .bind(auth.projectId, deviceId)
    .first();
  if (!device) return { ok: false, error: "not_found" };
  const rows = await env.DB.prepare(
    `SELECT DISTINCT sensor FROM iot_readings WHERE project_id = ? AND device_id = ? ORDER BY sensor ASC`,
  )
    .bind(auth.projectId, deviceId)
    .all();
  return { ok: true, keys: (rows.results || []).map((r) => r.sensor) };
}

export async function listIoTRules(env, auth) {
  const rows = await env.DB.prepare(
    `SELECT id, name, device_id, fleet_id, enabled, condition_json, action_json, created_at
     FROM iot_rules WHERE project_id = ? ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(auth.projectId)
    .all();
  return {
    ok: true,
    rules: (rows.results || []).map((r) => ({
      id: r.id,
      name: r.name,
      deviceId: r.device_id,
      fleetId: r.fleet_id,
      enabled: r.enabled === 1,
      condition: parseJson(r.condition_json, {}),
      action: parseJson(r.action_json, {}),
      createdAt: r.created_at,
    })),
  };
}

export async function fireIoTRules(env, projectId, deviceId, sensor, value) {
  let rows;
  try {
    rows = await env.DB.prepare(
      `SELECT id, name, device_id, condition_json, action_json, enabled
       FROM iot_rules WHERE project_id = ? AND enabled = 1`,
    )
      .bind(projectId)
      .all();
  } catch {
    return [];
  }
  const alarms = [];
  for (const rule of rows.results || []) {
    if (rule.device_id && rule.device_id !== deviceId) continue;
    const condition = parseJson(rule.condition_json, {});
    const wantSensor = condition.sensor || "value";
    if (wantSensor !== sensor) continue;
    if (!compareIoTCondition(Number(value), condition.operator, Number(condition.value))) continue;
    const id = `alm_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const message = `${rule.name}: ${sensor} ${condition.operator} ${condition.value} (got ${value})`;
    await env.DB.prepare(
      `INSERT INTO iot_alarms (id, project_id, device_id, rule_id, severity, status, message, created_at)
       VALUES (?, ?, ?, ?, 'warning', 'active', ?, ?)`,
    )
      .bind(id, projectId, deviceId, rule.id, message, nowIso())
      .run();
    alarms.push({ id, ruleId: rule.id, deviceId, message, status: "active" });
  }
  return alarms;
}

export async function listIoTAlarms(env, auth, filter = {}) {
  const rows = await env.DB.prepare(
    filter.deviceId
      ? `SELECT id, device_id, rule_id, severity, status, message, created_at, acked_at, assignee_id, cleared_at
         FROM iot_alarms WHERE project_id = ? AND device_id = ? ORDER BY created_at DESC LIMIT 100`
      : `SELECT id, device_id, rule_id, severity, status, message, created_at, acked_at, assignee_id, cleared_at
         FROM iot_alarms WHERE project_id = ? ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(...(filter.deviceId ? [auth.projectId, filter.deviceId] : [auth.projectId]))
    .all();
  return {
    ok: true,
    alarms: (rows.results || []).map((r) => ({
      id: r.id,
      deviceId: r.device_id,
      ruleId: r.rule_id,
      severity: r.severity,
      status: r.status,
      message: r.message,
      createdAt: r.created_at,
      ackedAt: r.acked_at,
      assigneeId: r.assignee_id ?? null,
      clearedAt: r.cleared_at ?? null,
    })),
  };
}

export async function getIoTDevice(env, auth, deviceId) {
  const row = await env.DB.prepare(
    `SELECT * FROM iot_devices WHERE project_id = ? AND id = ?`,
  )
    .bind(auth.projectId, deviceId)
    .first();
  if (!row) return { ok: false, error: "not_found" };
  return { ok: true, device: rowToDevice(row) };
}

export async function deleteIoTDevice(env, auth, deviceId) {
  const existing = await env.DB.prepare(
    `SELECT id FROM iot_devices WHERE project_id = ? AND id = ?`,
  )
    .bind(auth.projectId, deviceId)
    .first();
  if (!existing) return { ok: false, error: "not_found", status: 404 };
  await env.DB.prepare(`DELETE FROM iot_rpc WHERE project_id = ? AND device_id = ?`).bind(auth.projectId, deviceId).run();
  await env.DB.prepare(`DELETE FROM iot_alarms WHERE project_id = ? AND device_id = ?`).bind(auth.projectId, deviceId).run();
  await env.DB.prepare(`DELETE FROM iot_device_shadows WHERE project_id = ? AND device_id = ?`).bind(auth.projectId, deviceId).run();
  await env.DB.prepare(`DELETE FROM iot_readings WHERE project_id = ? AND device_id = ?`).bind(auth.projectId, deviceId).run();
  await env.DB.prepare(`DELETE FROM iot_devices WHERE project_id = ? AND id = ?`).bind(auth.projectId, deviceId).run();
  return { ok: true };
}

export async function deleteIoTReadings(env, auth, deviceId, filter = {}) {
  const device = await env.DB.prepare(
    `SELECT id FROM iot_devices WHERE project_id = ? AND id = ?`,
  )
    .bind(auth.projectId, deviceId)
    .first();
  if (!device) return { ok: false, error: "not_found" };
  let sql = `DELETE FROM iot_readings WHERE project_id = ? AND device_id = ?`;
  const params = [auth.projectId, deviceId];
  if (filter.sensor) {
    sql += ` AND sensor = ?`;
    params.push(String(filter.sensor).slice(0, 64));
  }
  if (filter.from) {
    sql += ` AND recorded_at >= ?`;
    params.push(String(filter.from));
  }
  if (filter.to) {
    sql += ` AND recorded_at <= ?`;
    params.push(String(filter.to));
  }
  await env.DB.prepare(sql).bind(...params).run();
  return { ok: true };
}

export async function listPersistentIoTRpc(env, auth, deviceId) {
  const rows = await env.DB.prepare(
    `SELECT id, device_id, method, params_json, status, result_json, created_at, replied_at
     FROM iot_rpc WHERE project_id = ? AND device_id = ? ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(auth.projectId, deviceId)
    .all();
  return {
    ok: true,
    rpcs: (rows.results || []).map((r) => ({
      id: r.id,
      deviceId: r.device_id,
      method: r.method,
      params: parseJson(r.params_json, {}),
      status: r.status,
      result: parseJson(r.result_json, null),
      createdAt: r.created_at,
      repliedAt: r.replied_at,
    })),
  };
}

export async function deleteIoTRpc(env, auth, deviceId, rpcId) {
  const info = await env.DB.prepare(
    `DELETE FROM iot_rpc WHERE id = ? AND project_id = ? AND device_id = ?`,
  )
    .bind(rpcId, auth.projectId, deviceId)
    .run();
  if (info?.meta?.changes === 0) return { ok: false, error: "not_found", status: 404 };
  return { ok: true };
}

export async function clearIoTAlarm(env, auth, alarmId) {
  const result = await env.DB.prepare(
    `UPDATE iot_alarms SET status = 'cleared', cleared_at = ? WHERE id = ? AND project_id = ? AND status IN ('active', 'acked')`,
  )
    .bind(nowIso(), alarmId, auth.projectId)
    .run();
  if (result?.meta?.changes === 0) return { ok: false, error: "not_found", status: 404 };
  return { ok: true, id: alarmId, status: "cleared" };
}

export async function assignIoTAlarm(env, auth, alarmId, assigneeId) {
  const id = String(assigneeId ?? "").trim().slice(0, 128);
  if (!id) return { ok: false, error: "assigneeId_required" };
  const result = await env.DB.prepare(
    `UPDATE iot_alarms SET assignee_id = ? WHERE id = ? AND project_id = ?`,
  )
    .bind(id, alarmId, auth.projectId)
    .run();
  if (result?.meta?.changes === 0) return { ok: false, error: "not_found", status: 404 };
  return { ok: true, id: alarmId, assigneeId: id };
}

export async function unassignIoTAlarm(env, auth, alarmId) {
  const result = await env.DB.prepare(
    `UPDATE iot_alarms SET assignee_id = NULL WHERE id = ? AND project_id = ?`,
  )
    .bind(alarmId, auth.projectId)
    .run();
  if (result?.meta?.changes === 0) return { ok: false, error: "not_found", status: 404 };
  return { ok: true, id: alarmId, assigneeId: null };
}

export async function ackIoTAlarm(env, auth, alarmId) {
  const result = await env.DB.prepare(
    `UPDATE iot_alarms SET status = 'acked', acked_at = ? WHERE id = ? AND project_id = ? AND status = 'active'`,
  )
    .bind(nowIso(), alarmId, auth.projectId)
    .run();
  if (result?.meta?.changes === 0) return { ok: false, error: "not_found", status: 404 };
  return { ok: true, id: alarmId, status: "acked" };
}

export async function createIoTRpc(env, auth, deviceId, input) {
  const method = String(input?.method ?? "").trim().slice(0, 64);
  if (!method) return { ok: false, error: "method_required" };
  const device = await env.DB.prepare(
    `SELECT id FROM iot_devices WHERE project_id = ? AND id = ?`,
  )
    .bind(auth.projectId, deviceId)
    .first();
  if (!device) return { ok: false, error: "not_found" };
  const id = `rpc_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await env.DB.prepare(
    `INSERT INTO iot_rpc (id, project_id, device_id, method, params_json, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
  )
    .bind(id, auth.projectId, deviceId, method, JSON.stringify(input.params ?? {}), nowIso())
    .run();
  return { ok: true, rpc: { id, deviceId, method, params: input.params ?? {}, status: "pending" } };
}

export async function pullIoTRpc(env, auth, deviceId) {
  const row = await env.DB.prepare(
    `SELECT id, method, params_json FROM iot_rpc
     WHERE project_id = ? AND device_id = ? AND status = 'pending'
     ORDER BY created_at ASC LIMIT 1`,
  )
    .bind(auth.projectId, deviceId)
    .first();
  if (!row) return { ok: true, rpc: null };
  return { ok: true, rpc: { id: row.id, method: row.method, params: parseJson(row.params_json, {}) } };
}

export async function replyIoTRpc(env, auth, deviceId, rpcId, result) {
  const info = await env.DB.prepare(
    `UPDATE iot_rpc SET status = 'replied', result_json = ?, replied_at = ?
     WHERE id = ? AND project_id = ? AND device_id = ? AND status = 'pending'`,
  )
    .bind(JSON.stringify(result ?? {}), nowIso(), rpcId, auth.projectId, deviceId)
    .run();
  if (info?.meta?.changes === 0) return { ok: false, error: "not_found", status: 404 };
  return { ok: true, id: rpcId, status: "replied" };
}
