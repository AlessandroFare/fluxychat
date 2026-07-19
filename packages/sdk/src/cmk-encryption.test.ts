import { describe, it, expect } from "vitest";
import { createCmkManager } from "./cmk-encryption";

describe("cmk-encryption", () => {
  it("should create a key for a tenant", () => {
    const cmk = createCmkManager();
    const key = cmk.createKey("tenant-1");
    expect(key.keyId).toMatch(/^cmk-/);
    expect(key.status).toBe("active");
    expect(key.tenantId).toBe("tenant-1");
  });

  it("should encrypt and decrypt", () => {
    const cmk = createCmkManager();
    cmk.createKey("tenant-1");
    const encrypted = cmk.encrypt("tenant-1", "secret data", "user-1");
    expect(encrypted.ciphertext).toBeTruthy();
    const decrypted = cmk.decrypt(encrypted, "user-1");
    expect(decrypted).toBe("secret data");
  });

  it("should rotate a key", () => {
    const cmk = createCmkManager();
    const key = cmk.createKey("tenant-1");
    const oldMaterial = key.keyMaterial;
    const rotated = cmk.rotateKey(key.keyId, "admin");
    expect(rotated.rotatedAt).toBeTruthy();
    expect(rotated.keyMaterial).not.toBe(oldMaterial);
  });

  it("should revoke a key", () => {
    const cmk = createCmkManager();
    const key = cmk.createKey("tenant-1");
    cmk.revokeKey(key.keyId, "admin");
    expect(cmk.getKey(key.keyId)?.status).toBe("revoked");
  });

  it("should reject decrypt with revoked key", () => {
    const cmk = createCmkManager();
    const key = cmk.createKey("tenant-1");
    cmk.revokeKey(key.keyId, "admin");
    expect(() => cmk.decrypt({ keyId: key.keyId, ciphertext: "dGVzdA==", iv: "abc", algorithm: "AES-256-GCM", tenantId: "tenant-1" }, "user")).toThrow();
  });

  it("should list keys by tenant", () => {
    const cmk = createCmkManager();
    cmk.createKey("tenant-1");
    cmk.createKey("tenant-2");
    expect(cmk.listKeys("tenant-1")).toHaveLength(1);
  });

  it("should maintain audit log", () => {
    const cmk = createCmkManager();
    const key = cmk.createKey("tenant-1");
    cmk.encrypt("tenant-1", "data", "user-1");
    cmk.rotateKey(key.keyId, "admin");
    expect(cmk.getAuditLog().length).toBeGreaterThanOrEqual(3);
  });
});
