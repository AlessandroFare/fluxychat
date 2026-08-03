/**
 * Room MLS group registry — D1 coordination for group epoch + device roster (#30).
 * Cryptographic operations remain client-side (SDK createMlsManager).
 */

const DEFAULT_CIPHER = "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519";
const DEFAULT_MAX_DEVICES = 64;

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function rowToGroup(row) {
  return {
    roomId: row.room_id,
    groupId: row.group_id,
    epoch: Number(row.epoch),
    cipherSuite: row.cipher_suite,
    maxDevices: Number(row.max_devices),
    devices: parseJson(row.devices_json, []),
    updatedAt: row.updated_at,
  };
}

export async function getRoomMlsGroup(env, auth, roomId) {
  const row = await env.DB.prepare(
    "SELECT * FROM room_mls_groups WHERE project_id = ? AND room_id = ?",
  ).bind(auth.projectId, roomId).first();
  if (!row) return { ok: true, group: null };
  return { ok: true, group: rowToGroup(row) };
}

export async function upsertRoomMlsGroup(env, auth, roomId, input = {}) {
  const existing = await getRoomMlsGroup(env, auth, roomId);
  const now = new Date().toISOString();
  const groupId = String(input.groupId ?? existing.group?.groupId ?? `mls_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`);
  const cipherSuite = String(input.cipherSuite ?? existing.group?.cipherSuite ?? DEFAULT_CIPHER).slice(0, 128);
  const maxDevices = Math.min(Math.max(Number(input.maxDevices ?? existing.group?.maxDevices ?? DEFAULT_MAX_DEVICES), 2), 256);
  const devices = Array.isArray(input.devices) ? input.devices : (existing.group?.devices ?? []);
  const epoch = Number(input.epoch ?? existing.group?.epoch ?? 0);

  await env.DB.prepare(
    `INSERT INTO room_mls_groups (project_id, room_id, group_id, epoch, cipher_suite, max_devices, devices_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, room_id) DO UPDATE SET
       group_id = excluded.group_id,
       epoch = excluded.epoch,
       cipher_suite = excluded.cipher_suite,
       max_devices = excluded.max_devices,
       devices_json = excluded.devices_json,
       updated_at = excluded.updated_at`,
  )
    .bind(auth.projectId, roomId, groupId, epoch, cipherSuite, maxDevices, JSON.stringify(devices), now)
    .run();

  return getRoomMlsGroup(env, auth, roomId);
}

export async function addRoomMlsDevice(env, auth, roomId, device) {
  const current = await getRoomMlsGroup(env, auth, roomId);
  if (!current.group) {
    await upsertRoomMlsGroup(env, auth, roomId, { devices: [] });
  }
  const group = (await getRoomMlsGroup(env, auth, roomId)).group;
  if (!group) return { ok: false, error: "group_not_found" };

  const deviceId = String(device.deviceId ?? "").trim();
  if (!deviceId) return { ok: false, error: "device_id_required" };

  const devices = [...group.devices.filter((d) => d.deviceId !== deviceId), {
    deviceId,
    publicKey: String(device.publicKey ?? "").slice(0, 512),
    signatureKey: String(device.signatureKey ?? "").slice(0, 512),
    credentialType: device.credentialType === "x509" ? "x509" : "basic",
  }];

  if (devices.length > group.maxDevices) {
    return { ok: false, error: "max_devices_exceeded", maxDevices: group.maxDevices };
  }

  return upsertRoomMlsGroup(env, auth, roomId, { ...group, devices });
}

export async function removeRoomMlsDevice(env, auth, roomId, deviceId) {
  const current = await getRoomMlsGroup(env, auth, roomId);
  if (!current.group) return { ok: false, error: "not_found" };
  const devices = current.group.devices.filter((d) => d.deviceId !== deviceId);
  return upsertRoomMlsGroup(env, auth, roomId, { ...current.group, devices });
}

export async function rotateRoomMlsEpoch(env, auth, roomId) {
  const current = await getRoomMlsGroup(env, auth, roomId);
  if (!current.group) return { ok: false, error: "not_found" };
  return upsertRoomMlsGroup(env, auth, roomId, {
    ...current.group,
    epoch: Number(current.group.epoch) + 1,
  });
}
