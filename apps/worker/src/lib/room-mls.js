/**
 * Room encryption group registry.
 *
 * This is a pure coordination layer: it stores groupId, epoch and device roster
 * in D1 so that clients can hydrate their local `group-cipher` (client-side
 * AES-256-GCM/HKDF). No cryptographic operations happen here.
 *
 * The previous version (`room-mls.js`) declared an MLS cipher suite constant,
 * pretended to do crypto, and was used to justify the fake `mls-encryption.ts`
 * export. All that is removed.
 */

export const DEFAULT_CIPHER = "AES-256-GCM/HKDF-SHA256";

export async function getRoomMlsGroup(env, auth, roomId) {
  const row = await env.DB.prepare(
    "SELECT * FROM room_mls_groups WHERE project_id = ? AND room_id = ?",
  )
    .bind(auth.projectId, roomId)
    .first();
  if (!row) return null;
  return {
    groupId: row.group_id,
    epoch: row.epoch,
    cipherSuite: row.cipher_suite,
    maxDevices: row.max_devices,
    devices: JSON.parse(row.devices_json || "[]"),
    updatedAt: row.updated_at,
  };
}

export async function upsertRoomMlsGroup(env, auth, roomId, input = {}) {
  const existing = await getRoomMlsGroup(env, auth, roomId);
  const groupId = String(
    input.groupId ??
      existing?.groupId ??
      `grp_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
  );
  const epoch = input.epoch ?? existing?.epoch ?? 0;
  const maxDevices = input.maxDevices ?? existing?.maxDevices ?? 64;
  const devices = input.devices ?? existing?.devices ?? [];
  const cipherSuite = DEFAULT_CIPHER;

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
    .bind(
      auth.projectId,
      roomId,
      groupId,
      epoch,
      cipherSuite,
      maxDevices,
      JSON.stringify(devices),
      new Date().toISOString(),
    )
    .run();
  return getRoomMlsGroup(env, auth, roomId);
}

export async function addRoomMlsDevice(env, auth, roomId, device) {
  const current = await getRoomMlsGroup(env, auth, roomId);
  if (!current) await upsertRoomMlsGroup(env, auth, roomId, { devices: [] });
  const group = await getRoomMlsGroup(env, auth, roomId);
  const exists = group.devices.some((d) => d.deviceId === device.deviceId);
  if (!exists) {
    if (group.devices.length >= group.maxDevices) {
      return group;
    }
    const nextDevices = [...group.devices, device];
    await upsertRoomMlsGroup(env, auth, roomId, { ...group, devices: nextDevices });
  }
  return getRoomMlsGroup(env, auth, roomId);
}

export async function removeRoomMlsDevice(env, auth, roomId, deviceId) {
  const current = await getRoomMlsGroup(env, auth, roomId);
  if (!current) return null;
  const filtered = current.devices.filter((d) => d.deviceId !== deviceId);
  await upsertRoomMlsGroup(env, auth, roomId, { ...current, devices: filtered });
  return getRoomMlsGroup(env, auth, roomId);
}

export async function rotateRoomMlsEpoch(env, auth, roomId) {
  const current = await getRoomMlsGroup(env, auth, roomId);
  if (!current) return null;
  await upsertRoomMlsGroup(env, auth, roomId, { ...current, epoch: current.epoch + 1 });
  return getRoomMlsGroup(env, auth, roomId);
}