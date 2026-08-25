/**
 * Customer-Managed Keys — real AES-256-GCM encryption with HKDF key derivation.
 *
 * WHAT THIS REPLACES
 * ------------------
 * The previous implementation stored plaintext-in-base64 (btoa/atob) while
 * claiming AES-256-GCM, generated IVs and key IDs with Math.random(), and
 * kept key material as an unauthenticated string. That is not encryption; it
 * is base64 with audit theatre.
 *
 * WHAT THIS IS
 * ------------
 * - AES-256-GCM with a fresh 96-bit IV per message.
 * - Per-key derived encryption keys via HKDF-SHA256, so the stored key
 *   material is a 32-byte base secret, not raw key bytes.
 * - Additional authenticated data binds the keyId, algorithm and tenantId
 *   into the tag, so a ciphertext cannot be replayed under a different key
 *   or tenant.
 * - IV generated with crypto.getRandomValues (CSPRNG), not Math.random().
 * - Key IDs use crypto.getRandomValues for collision resistance.
 *
 * The API shape is kept identical so callers do not change.
 */

export type KeyStatus =
  | "active"
  | "rotating"
  | "retired"
  | "compromised"
  | "revoked";

export type EncryptionAlgorithm = "AES-256-GCM";

export interface CmkKey {
  keyId: string;
  algorithm: EncryptionAlgorithm;
  status: KeyStatus;
  createdAt: string;
  rotatedAt?: string;
  revokedAt?: string;
  tenantId: string;
  /** Base64-encoded 32-byte base secret. Never raw key bytes. */
  keyMaterial: string;
}

export interface CmkPolicy {
  policyId: string;
  rotationIntervalDays: number;
  allowedAlgorithms: EncryptionAlgorithm[];
  requireAudit: boolean;
  tenantIsolated: boolean;
}

export interface EncryptionResult {
  keyId: string;
  ciphertext: string;
  iv: string;
  algorithm: EncryptionAlgorithm;
  tenantId: string;
}

export interface AuditEvent {
  eventId: string;
  action: "encrypt" | "decrypt" | "rotate" | "revoke" | "create";
  keyId: string;
  tenantId: string;
  performedBy: string;
  timestamp: string;
}

export interface CmkManager {
  createKey(
    tenantId: string,
    algorithm?: EncryptionAlgorithm,
  ): CmkKey;
  rotateKey(keyId: string, performedBy: string): CmkKey;
  revokeKey(keyId: string, performedBy: string): CmkKey;
  getKey(keyId: string): CmkKey | null;
  listKeys(tenantId?: string): CmkKey[];
  encrypt(
    tenantId: string,
    plaintext: string,
    performedBy: string,
  ): Promise<EncryptionResult>;
  decrypt(result: EncryptionResult, performedBy: string): Promise<string>;
  getAuditLog(tenantId?: string): AuditEvent[];
}

const KEY_BYTES = 32;
const IV_BYTES = 12;

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

function ab(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

function utf8(text: string): ArrayBuffer {
  return ab(new TextEncoder().encode(text));
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

async function deriveKey(
  baseSecret: Uint8Array,
  tenantId: string,
  keyId: string,
): Promise<CryptoKey> {
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    ab(baseSecret),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: utf8("fluxychat/cmk/v1"),
      info: utf8(`${tenantId}|${keyId}`),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function additionalData(tenantId: string, keyId: string, algorithm: string): ArrayBuffer {
  return utf8(`${tenantId}|${keyId}|${algorithm}`);
}

function randomKeyId(): string {
  const bytes = randomBytes(9);
  let out = "cmk-";
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    out += (b % 26 + 97).toString(16);
  }
  return out;
}

export function createCmkManager(policy?: Partial<CmkPolicy>): CmkManager {
  const keys = new Map<string, CmkKey>();
  const auditLog: AuditEvent[] = [];
  const defaultPolicy: CmkPolicy = {
    policyId: "default",
    rotationIntervalDays: 90,
    allowedAlgorithms: ["AES-256-GCM"],
    requireAudit: true,
    tenantIsolated: true,
    ...policy,
  };

  function addAudit(
    action: AuditEvent["action"],
    keyId: string,
    tenantId: string,
    performedBy: string,
  ): void {
    auditLog.push({
      eventId: `audit-${auditLog.length + 1}`,
      action,
      keyId,
      tenantId,
      performedBy,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    createKey(
      tenantId: string,
      algorithm: EncryptionAlgorithm = "AES-256-GCM",
    ): CmkKey {
      if (!defaultPolicy.allowedAlgorithms.includes(algorithm)) {
        throw new Error(`Algorithm ${algorithm} not allowed.`);
      }
      const key: CmkKey = {
        keyId: randomKeyId(),
        algorithm,
        status: "active",
        createdAt: new Date().toISOString(),
        tenantId,
        keyMaterial: bytesToBase64(randomBytes(KEY_BYTES)),
      };
      keys.set(key.keyId, key);
      addAudit("create", key.keyId, tenantId, "system");
      return key;
    },

    rotateKey(keyId: string, performedBy: string): CmkKey {
      const key = keys.get(keyId);
      if (!key) throw new Error(`Key ${keyId} not found.`);
      key.status = "rotating";
      key.rotatedAt = new Date().toISOString();
      key.keyMaterial = bytesToBase64(randomBytes(KEY_BYTES));
      key.status = "active";
      addAudit("rotate", keyId, key.tenantId, performedBy);
      return key;
    },

    revokeKey(keyId: string, performedBy: string): CmkKey {
      const key = keys.get(keyId);
      if (!key) throw new Error(`Key ${keyId} not found.`);
      key.status = "revoked";
      key.revokedAt = new Date().toISOString();
      addAudit("revoke", keyId, key.tenantId, performedBy);
      return key;
    },

    getKey(keyId: string) {
      return keys.get(keyId) ?? null;
    },

    listKeys(tenantId?: string) {
      const all = [...keys.values()];
      return tenantId ? all.filter((k) => k.tenantId === tenantId) : all;
    },

    async encrypt(
      tenantId: string,
      plaintext: string,
      performedBy: string,
    ): Promise<EncryptionResult> {
      const tenantKeys = [...keys.values()].filter(
        (k) => k.tenantId === tenantId && k.status === "active",
      );
      if (tenantKeys.length === 0) {
        throw new Error(`No active keys for tenant ${tenantId}.`);
      }
      const key = tenantKeys[0];
      const cipherKey = await deriveKey(base64ToBytes(key.keyMaterial), tenantId, key.keyId);
      const iv = randomBytes(IV_BYTES);
      const ct = await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: ab(iv),
          additionalData: additionalData(tenantId, key.keyId, key.algorithm),
        },
        cipherKey,
        utf8(plaintext),
      );
      const result: EncryptionResult = {
        keyId: key.keyId,
        ciphertext: bytesToBase64(new Uint8Array(ct)),
        iv: bytesToBase64(iv),
        algorithm: key.algorithm,
        tenantId,
      };
      addAudit("encrypt", key.keyId, tenantId, performedBy);
      return result;
    },

    async decrypt(result: EncryptionResult, performedBy: string): Promise<string> {
      const key = keys.get(result.keyId);
      if (!key) throw new Error(`Key ${result.keyId} not found.`);
      if (key.status === "revoked" || key.status === "compromised") {
        throw new Error(`Key ${result.keyId} is ${key.status}.`);
      }
      const cipherKey = await deriveKey(
        base64ToBytes(key.keyMaterial),
        result.tenantId,
        result.keyId,
      );
      const plaintext = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: ab(base64ToBytes(result.iv)),
          additionalData: additionalData(
            result.tenantId,
            result.keyId,
            result.algorithm,
          ),
        },
        cipherKey,
        ab(base64ToBytes(result.ciphertext)),
      );
      addAudit("decrypt", result.keyId, result.tenantId, performedBy);
      return new TextDecoder().decode(plaintext);
    },

    getAuditLog(tenantId?: string) {
      return tenantId
        ? auditLog.filter((e) => e.tenantId === tenantId)
        : [...auditLog];
    },
  };
}