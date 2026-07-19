export type KeyStatus = "active" | "rotating" | "retired" | "compromised" | "revoked";
export type EncryptionAlgorithm = "AES-256-GCM" | "AES-256-CBC" | "ChaCha20-Poly1305";

export interface CmkKey {
  keyId: string;
  algorithm: EncryptionAlgorithm;
  status: KeyStatus;
  createdAt: string;
  rotatedAt?: string;
  revokedAt?: string;
  tenantId: string;
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
  createKey(tenantId: string, algorithm?: EncryptionAlgorithm): CmkKey;
  rotateKey(keyId: string, performedBy: string): CmkKey;
  revokeKey(keyId: string, performedBy: string): CmkKey;
  getKey(keyId: string): CmkKey | null;
  listKeys(tenantId?: string): CmkKey[];
  encrypt(tenantId: string, plaintext: string, performedBy: string): EncryptionResult;
  decrypt(result: EncryptionResult, performedBy: string): string;
  getAuditLog(tenantId?: string): AuditEvent[];
}

function generateKeyId(): string {
  return `cmk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function generateIv(): string {
  return Array.from({ length: 12 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("");
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

  function addAudit(action: AuditEvent["action"], keyId: string, tenantId: string, performedBy: string): void {
    auditLog.push({ eventId: `audit-${auditLog.length + 1}`, action, keyId, tenantId, performedBy, timestamp: new Date().toISOString() });
  }

  return {
    createKey(tenantId: string, algorithm: EncryptionAlgorithm = "AES-256-GCM"): CmkKey {
      if (!defaultPolicy.allowedAlgorithms.includes(algorithm)) throw new Error(`Algorithm ${algorithm} not allowed.`);
      const key: CmkKey = {
        keyId: generateKeyId(),
        algorithm,
        status: "active",
        createdAt: new Date().toISOString(),
        tenantId,
        keyMaterial: `mk-${Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join("")}`,
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
      key.keyMaterial = `mk-${Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join("")}`;
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

    getKey(keyId: string) { return keys.get(keyId) ?? null; },

    listKeys(tenantId?: string) {
      const all = [...keys.values()];
      return tenantId ? all.filter((k) => k.tenantId === tenantId) : all;
    },

    encrypt(tenantId: string, plaintext: string, performedBy: string): EncryptionResult {
      const tenantKeys = [...keys.values()].filter((k) => k.tenantId === tenantId && k.status === "active");
      if (tenantKeys.length === 0) throw new Error(`No active keys for tenant ${tenantId}.`);
      const key = tenantKeys[0];
      const result: EncryptionResult = {
        keyId: key.keyId,
        ciphertext: btoa(plaintext),
        iv: generateIv(),
        algorithm: key.algorithm,
        tenantId,
      };
      addAudit("encrypt", key.keyId, tenantId, performedBy);
      return result;
    },

    decrypt(result: EncryptionResult, performedBy: string): string {
      const key = keys.get(result.keyId);
      if (!key) throw new Error(`Key ${result.keyId} not found.`);
      if (key.status === "revoked" || key.status === "compromised") throw new Error(`Key ${result.keyId} is ${key.status}.`);
      addAudit("decrypt", result.keyId, result.tenantId, performedBy);
      return atob(result.ciphertext);
    },

    getAuditLog(tenantId?: string) {
      return tenantId ? auditLog.filter((e) => e.tenantId === tenantId) : [...auditLog];
    },
  };
}
