/**
 * Group content encryption for FluxyChat rooms.
 *
 * WHAT THIS REPLACES
 * ------------------
* The previous `mls-encryption.ts` exported `createMlsManager` from the public SDK
  * under the banner "E2EE groups (MLS)", declared an MLS cipher suite, and then
  * implemented `encryptMessage` as `btoa(plaintext)` and `decryptMessage` as
  * `atob(...)`. The `signature` field was a template string, `ratchetTree` was
  * always empty, and `crypto.subtle` was never called. Any application that
  * enabled it shipped plaintext-in-base64 while believing its messages were
  * end-to-end encrypted.
 *
 * WHAT THIS IS
 * ------------
 * Real authenticated encryption, and nothing more than it can honestly claim:
 *
 *   - AES-256-GCM, a fresh random 96-bit IV per message.
 *   - Per-epoch keys derived with HKDF-SHA256 from a caller-supplied base key, so
 *     rotating the epoch retires the old key material.
 *   - Additional authenticated data binds groupId, epoch and senderId into the
 *     tag, so a ciphertext cannot be replayed into another group, another epoch,
 *     or attributed to a different sender.
 *   - GCM's own tag is the integrity proof. There is no separate "signature"
 *     field, because a shared group key cannot prove which member sent a message.
 *
 * WHAT THIS IS NOT
 * ----------------
 * This is NOT MLS (RFC 9420). There is no ratchet tree, no asymmetric group
 * agreement, and no per-sender authentication. Do not describe it as MLS.
 *
 * It is end-to-end encrypted only if the base key never reaches the server. This
 * module never generates, fetches, or transmits key material: the caller supplies
 * it and is responsible for distributing it out of band. If you obtain the key
 * from a FluxyChat endpoint, the server can decrypt, and the correct description
 * is "content encryption with server-managed keys" — not E2EE.
 */

export type GroupCipherSuite = "AES-256-GCM/HKDF-SHA256";

export const GROUP_CIPHER_SUITE: GroupCipherSuite = "AES-256-GCM/HKDF-SHA256";

/** Required length of the caller-supplied base key. */
export const GROUP_BASE_KEY_BYTES = 32;
const IV_BYTES = 12;

export interface GroupDevice {
  deviceId: string;
  /** Optional transport-level public key. Not used by this cipher. */
  publicKey?: string;
  credentialType?: "basic" | "x509";
}

export interface GroupConfig {
  cipherSuite: GroupCipherSuite;
  maxDevices: number;
  autoKeyRotation: boolean;
  rotationIntervalMs: number;
}

export interface GroupEnvelope {
  groupId: string;
  epoch: number;
  sender: string;
  /** base64 AES-GCM ciphertext including the 128-bit tag. */
  ciphertext: string;
  /** base64 96-bit IV, unique per message. */
  iv: string;
  suite: GroupCipherSuite;
  contentType: "application";
}

export interface GroupState {
  groupId: string;
  epoch: number;
  devices: Map<string, GroupDevice>;
  config: GroupConfig;
}

export interface GroupCipher {
  createGroup(input: { groupId?: string; config?: Partial<GroupConfig> }): GroupState;
  importGroup(input: {
    groupId: string;
    epoch: number;
    config?: Partial<GroupConfig>;
    devices: GroupDevice[];
  }): GroupState;
  addDevice(groupId: string, device: GroupDevice): void;
  removeDevice(groupId: string, deviceId: string): void;
  encrypt(groupId: string, senderId: string, plaintext: string): Promise<GroupEnvelope>;
  decrypt(groupId: string, envelope: GroupEnvelope): Promise<string>;
  rotateEpoch(groupId: string): number;
  getGroup(groupId: string): GroupState | null;
  listGroups(): GroupState[];
  getEpoch(groupId: string): number;
}

const DEFAULT_CONFIG: GroupConfig = {
  cipherSuite: GROUP_CIPHER_SUITE,
  maxDevices: 64,
  autoKeyRotation: true,
  rotationIntervalMs: 86_400_000,
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * Copy a view into a standalone `ArrayBuffer`.
 *
 * WebCrypto's `BufferSource` requires an `ArrayBuffer`-backed view, while
 * `TextEncoder.encode` and `Uint8Array` are typed over `ArrayBufferLike` (which
 * includes `SharedArrayBuffer`). Copying is also the safer choice: it detaches the
 * bytes from any caller-held view that could be mutated mid-operation.
 */
function ab(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

function utf8(text: string): ArrayBuffer {
  return ab(new TextEncoder().encode(text));
}

/**
 * Derive the AES key for one epoch.
 *
 * The epoch and group id go into HKDF `info`, so the same base key yields an
 * independent key per group and per epoch. Rotating the epoch therefore makes
 * ciphertext from earlier epochs undecryptable with the new key.
 */
async function deriveEpochKey(
  baseKey: Uint8Array,
  groupId: string,
  epoch: number,
): Promise<CryptoKey> {
  const hkdfKey = await crypto.subtle.importKey("raw", ab(baseKey), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      // A fixed, non-secret salt is acceptable here: the base key is already a
      // uniformly random 256-bit secret, and the domain separation we need comes
      // from `info`.
      salt: utf8("fluxychat/group-cipher/v1"),
      info: utf8(`${groupId}|epoch:${epoch}`),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** AAD binds the envelope to its group, epoch and sender. */
function additionalData(groupId: string, epoch: number, senderId: string): ArrayBuffer {
  return utf8(`${groupId}|${epoch}|${senderId}`);
}

/**
 * Create a group cipher.
 *
 * @param options.keyMaterial base64-encoded 32-byte secret, shared by the group
 *   members and distributed by the application. Never send it to the server if
 *   you intend the result to be end-to-end encrypted.
 */
export function createGroupCipher(options: { keyMaterial: string }): GroupCipher {
  const baseKey = base64ToBytes(String(options?.keyMaterial ?? ""));
  if (baseKey.length !== GROUP_BASE_KEY_BYTES) {
    throw new Error(
      `group cipher requires ${GROUP_BASE_KEY_BYTES} bytes of base64 key material, received ${baseKey.length}`,
    );
  }

  const groups = new Map<string, GroupState>();
  /** Cache derived keys so a hot room does not re-run HKDF per message. */
  const epochKeys = new Map<string, Promise<CryptoKey>>();

  function keyFor(groupId: string, epoch: number): Promise<CryptoKey> {
    const cacheKey = `${groupId}|${epoch}`;
    let derived = epochKeys.get(cacheKey);
    if (!derived) {
      derived = deriveEpochKey(baseKey, groupId, epoch);
      epochKeys.set(cacheKey, derived);
    }
    return derived;
  }

  function requireGroup(groupId: string): GroupState {
    const group = groups.get(groupId);
    if (!group) throw new Error(`Group ${groupId} not found.`);
    return group;
  }

  return {
    createGroup({ groupId, config = {} } = {}) {
      const id = groupId || `grp-${bytesToBase64(crypto.getRandomValues(new Uint8Array(9)))}`;
      const group: GroupState = {
        groupId: id,
        epoch: 0,
        devices: new Map(),
        config: { ...DEFAULT_CONFIG, ...config, cipherSuite: GROUP_CIPHER_SUITE },
      };
      groups.set(id, group);
      return group;
    },

    importGroup(input) {
      const group: GroupState = {
        groupId: input.groupId,
        epoch: Number(input.epoch ?? 0),
        devices: new Map(),
        config: { ...DEFAULT_CONFIG, ...input.config, cipherSuite: GROUP_CIPHER_SUITE },
      };
      for (const device of input.devices ?? []) group.devices.set(device.deviceId, device);
      groups.set(group.groupId, group);
      return group;
    },

    addDevice(groupId, device) {
      const group = requireGroup(groupId);
      if (group.devices.size >= group.config.maxDevices) {
        throw new Error(`Group ${groupId} is at max capacity (${group.config.maxDevices}).`);
      }
      group.devices.set(device.deviceId, device);
    },

    removeDevice(groupId, deviceId) {
      requireGroup(groupId).devices.delete(deviceId);
    },

    async encrypt(groupId, senderId, plaintext) {
      const group = requireGroup(groupId);
      if (!group.devices.has(senderId)) throw new Error(`Device ${senderId} not in group.`);
      const key = await keyFor(groupId, group.epoch);
      const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
      const ct = await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: ab(iv),
          additionalData: additionalData(groupId, group.epoch, senderId),
        },
        key,
        utf8(plaintext),
      );
      return {
        groupId,
        epoch: group.epoch,
        sender: senderId,
        ciphertext: bytesToBase64(new Uint8Array(ct)),
        iv: bytesToBase64(iv),
        suite: GROUP_CIPHER_SUITE,
        contentType: "application",
      };
    },

    async decrypt(groupId, envelope) {
      requireGroup(groupId);
      if (envelope.groupId !== groupId) {
        throw new Error("envelope does not belong to this group");
      }
      if (envelope.suite && envelope.suite !== GROUP_CIPHER_SUITE) {
        throw new Error(`unsupported cipher suite: ${envelope.suite}`);
      }
      const key = await keyFor(groupId, Number(envelope.epoch));
      const plaintext = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: ab(base64ToBytes(envelope.iv)),
          additionalData: additionalData(groupId, Number(envelope.epoch), envelope.sender),
        },
        key,
        ab(base64ToBytes(envelope.ciphertext)),
      );
      return new TextDecoder().decode(plaintext);
    },

    rotateEpoch(groupId) {
      const group = requireGroup(groupId);
      group.epoch += 1;
      return group.epoch;
    },

    getGroup(groupId) {
      return groups.get(groupId) ?? null;
    },

    listGroups() {
      return [...groups.values()];
    },

    getEpoch(groupId) {
      return groups.get(groupId)?.epoch ?? 0;
    },
  };
}
