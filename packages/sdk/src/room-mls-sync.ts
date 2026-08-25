import type { GroupCipher, GroupDevice, GroupState } from "./group-cipher.js";

/**
 * Server-side registry row for a room's encryption group (coordination slice #30).
 *
 * `publicKey` / `signatureKey` are registry metadata for device discovery. The group
 * cipher does not consume them: it uses a symmetric group key that the application
 * distributes. They are carried here so the server can list devices without being
 * able to read message content.
 */
export interface RoomMlsRegistryGroup {
  roomId: string;
  groupId: string;
  epoch: number;
  cipherSuite: string;
  maxDevices: number;
  devices: Array<{
    deviceId: string;
    publicKey: string;
    signatureKey: string;
    credentialType?: string;
  }>;
}

/** Hydrate a local group cipher from the server-side D1 registry. */
export function hydrateMlsManagerFromRegistry(
  cipher: GroupCipher,
  registry: RoomMlsRegistryGroup,
): GroupState {
  const existing = cipher.getGroup(registry.groupId);
  if (existing) {
    while (cipher.getEpoch(registry.groupId) < registry.epoch) {
      cipher.rotateEpoch(registry.groupId);
    }
    for (const device of registry.devices) {
      const member: GroupDevice = {
        deviceId: device.deviceId,
        publicKey: device.publicKey,
        credentialType: device.credentialType === "x509" ? "x509" : "basic",
      };
      try {
        cipher.addDevice(registry.groupId, member);
      } catch {
        /* already present, or at capacity */
      }
    }
    return cipher.getGroup(registry.groupId)!;
  }

  return cipher.importGroup({
    groupId: registry.groupId,
    epoch: registry.epoch,
    // `cipherSuite` from the registry is deliberately NOT forwarded: the cipher pins
    // its own suite so a stale or attacker-influenced registry row cannot downgrade
    // the algorithm or re-assert the old MLS suite string.
    config: { maxDevices: registry.maxDevices },
    devices: registry.devices.map((device) => ({
      deviceId: device.deviceId,
      publicKey: device.publicKey,
      credentialType: device.credentialType === "x509" ? "x509" : "basic",
    })),
  });
}

export function buildMlsRegistryUpsertFromManager(
  cipher: GroupCipher,
  groupId: string,
  roomId: string,
): Partial<RoomMlsRegistryGroup> | null {
  const group = cipher.getGroup(groupId);
  if (!group) return null;
  return {
    roomId,
    groupId: group.groupId,
    epoch: cipher.getEpoch(groupId),
    cipherSuite: group.config.cipherSuite,
    maxDevices: group.config.maxDevices,
    devices: [...group.devices.values()].map((device) => ({
      deviceId: device.deviceId,
      publicKey: device.publicKey ?? "",
      signatureKey: "",
      credentialType: device.credentialType ?? "basic",
    })),
  };
}
