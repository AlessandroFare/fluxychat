export type MlsCipherSuite = "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519" | "MLS_128_DHKEMX25519_CHACHA20POLY1305_SHA256_Ed25519" | "MLS_256_DHKEMX448_AES256GCM_SHA512_Ed448";

export interface MlsDevice {
  deviceId: string;
  publicKey: string;
  signatureKey: string;
  credentialType: "basic" | "x509";
}

export interface MlsGroupConfig {
  cipherSuite: MlsCipherSuite;
  maxDevices: number;
  epochSize: number;
  autoKeyRotation: boolean;
  rotationIntervalMs: number;
}

export interface MlsMessage {
  groupId: string;
  epoch: number;
  sender: string;
  ciphertext: string;
  signature: string;
  contentType: "application" | "proposal" | "commit";
}

export interface MlsGroup {
  groupId: string;
  epoch: number;
  devices: Map<string, MlsDevice>;
  config: MlsGroupConfig;
  ratchetTree: string[];
}

export interface MlsKeyPackage {
  deviceId: string;
  publicKey: string;
  signatureKey: string;
  cipherSuite: MlsCipherSuite;
  expiresAt: string;
}

export interface MlsManager {
  createGroup(config: Partial<MlsGroupConfig>): MlsGroup;
  addDevice(groupId: string, device: MlsDevice): void;
  removeDevice(groupId: string, deviceId: string): void;
  encryptMessage(groupId: string, senderId: string, plaintext: string): MlsMessage;
  decryptMessage(groupId: string, message: MlsMessage): string;
  rotateKeys(groupId: string): void;
  getGroup(groupId: string): MlsGroup | null;
  listGroups(): MlsGroup[];
  getEpoch(groupId: string): number;
  importGroup(group: {
    groupId: string;
    epoch: number;
    config?: Partial<MlsGroupConfig>;
    devices: MlsDevice[];
  }): MlsGroup;
}

const DEFAULT_MLS_CONFIG: MlsGroupConfig = {
  cipherSuite: "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519",
  maxDevices: 64,
  epochSize: 1000,
  autoKeyRotation: true,
  rotationIntervalMs: 86400000,
};

export function createMlsManager(): MlsManager {
  const groups = new Map<string, MlsGroup>();

  return {
    createGroup(config: Partial<MlsGroupConfig> = {}): MlsGroup {
      const id = `mls-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const group: MlsGroup = {
        groupId: id,
        epoch: 0,
        devices: new Map(),
        config: { ...DEFAULT_MLS_CONFIG, ...config },
        ratchetTree: [],
      };
      groups.set(id, group);
      return group;
    },

    addDevice(groupId: string, device: MlsDevice): void {
      const group = groups.get(groupId);
      if (!group) throw new Error(`Group ${groupId} not found.`);
      if (group.devices.size >= group.config.maxDevices) {
        throw new Error(`Group ${groupId} is at max capacity (${group.config.maxDevices}).`);
      }
      group.devices.set(device.deviceId, device);
    },

    removeDevice(groupId: string, deviceId: string): void {
      const group = groups.get(groupId);
      if (!group) throw new Error(`Group ${groupId} not found.`);
      group.devices.delete(deviceId);
    },

    encryptMessage(groupId: string, senderId: string, plaintext: string): MlsMessage {
      const group = groups.get(groupId);
      if (!group) throw new Error(`Group ${groupId} not found.`);
      if (!group.devices.has(senderId)) throw new Error(`Device ${senderId} not in group.`);

      const epoch = group.epoch;
      const encoded = btoa(plaintext);
      return {
        groupId,
        epoch,
        sender: senderId,
        ciphertext: encoded,
        signature: `sig-${senderId}-${epoch}-${encoded.slice(0, 8)}`,
        contentType: "application",
      };
    },

    decryptMessage(groupId: string, message: MlsMessage): string {
      const group = groups.get(groupId);
      if (!group) throw new Error(`Group ${groupId} not found.`);
      return atob(message.ciphertext);
    },

    rotateKeys(groupId: string): void {
      const group = groups.get(groupId);
      if (!group) throw new Error(`Group ${groupId} not found.`);
      group.epoch++;
    },

    getGroup(groupId: string): MlsGroup | null {
      return groups.get(groupId) ?? null;
    },

    listGroups(): MlsGroup[] {
      return [...groups.values()];
    },

    getEpoch(groupId: string): number {
      return groups.get(groupId)?.epoch ?? 0;
    },

    importGroup(groupInput): MlsGroup {
      const group: MlsGroup = {
        groupId: groupInput.groupId,
        epoch: Number(groupInput.epoch ?? 0),
        devices: new Map(),
        config: { ...DEFAULT_MLS_CONFIG, ...groupInput.config },
        ratchetTree: [],
      };
      for (const device of groupInput.devices) {
        group.devices.set(device.deviceId, device);
      }
      groups.set(group.groupId, group);
      return group;
    },
  };
}
