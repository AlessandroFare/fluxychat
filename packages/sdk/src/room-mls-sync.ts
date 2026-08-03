import type { MlsDevice, MlsGroup, MlsManager } from "./mls-encryption";

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

/**
 * Hydrate a local MLS manager from server-side D1 registry (coordination slice #30).
 */
export function hydrateMlsManagerFromRegistry(
  manager: MlsManager,
  registry: RoomMlsRegistryGroup,
): MlsGroup {
  const existing = manager.getGroup(registry.groupId);
  if (existing) {
    while (manager.getEpoch(registry.groupId) < registry.epoch) {
      manager.rotateKeys(registry.groupId);
    }
    for (const device of registry.devices) {
      const mlsDevice: MlsDevice = {
        deviceId: device.deviceId,
        publicKey: device.publicKey,
        signatureKey: device.signatureKey,
        credentialType: device.credentialType === "x509" ? "x509" : "basic",
      };
      try {
        manager.addDevice(registry.groupId, mlsDevice);
      } catch {
        /* already present */
      }
    }
    return manager.getGroup(registry.groupId)!;
  }

  return manager.importGroup({
    groupId: registry.groupId,
    epoch: registry.epoch,
    config: {
      cipherSuite: registry.cipherSuite as MlsGroup["config"]["cipherSuite"],
      maxDevices: registry.maxDevices,
    },
    devices: registry.devices.map((device) => ({
      deviceId: device.deviceId,
      publicKey: device.publicKey,
      signatureKey: device.signatureKey,
      credentialType: device.credentialType === "x509" ? "x509" : "basic",
    })),
  });
}

export function buildMlsRegistryUpsertFromManager(
  manager: MlsManager,
  groupId: string,
  roomId: string,
): Partial<RoomMlsRegistryGroup> | null {
  const group = manager.getGroup(groupId);
  if (!group) return null;
  return {
    roomId,
    groupId: group.groupId,
    epoch: manager.getEpoch(groupId),
    cipherSuite: group.config.cipherSuite,
    maxDevices: group.config.maxDevices,
    devices: [...group.devices.values()],
  };
}
