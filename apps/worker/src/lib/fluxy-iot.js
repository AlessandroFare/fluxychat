/**
 * D1-backed FluxyIoT devices, readings, rules, shadows (ROADMAP 5.2).
 */

import { fanoutServerEvent } from "./message-realtime-fanout.js";

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

async function hashApiKey(key) {
  const data = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
      await hashApiKey(apiKey),
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
  return { ok: true, devices: (rows.results || []).map(rowToDevice) };
}

export async function ingestIoTReading(env, auth, deviceId, input) {
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

  await env.DB.prepare(
    `UPDATE iot_device_shadows SET reported_json = ?, updated_at = ? WHERE device_id = ? AND project_id = ?`,
  )
    .bind(JSON.stringify({ [sensor]: value, lastReadingAt: now }), now, deviceId, auth.projectId)
    .run();

  if (device.room_id) {
    await fanoutServerEvent(env, {
      projectId: auth.projectId,
      roomId: device.room_id,
      name: "iot.reading",
      userId: deviceId,
      data: { deviceId, sensor, value, unit: input.unit ?? "", recordedAt: now },
    }).catch(() => {});
  }

  return { ok: true, reading: { id, deviceId, sensor, value, unit: input.unit ?? "", timestamp: now } };
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
