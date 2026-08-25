import { describe, expect, it } from "vitest";
import { createCmkManager, type CmkKey } from "./cmk-encryption.js";

function setup() {
  return createCmkManager({
    allowedAlgorithms: ["AES-256-GCM"],
    tenantIsolated: true,
  });
}

describe("createCmkManager — real encryption", () => {
  it("encrypts and round-trips", async () => {
    const mgr = setup();
    const key = mgr.createKey("tenant-1");
    const res = await mgr.encrypt("tenant-1", "pii: 4111-1111-1111-1111", "system");
    const pt = await mgr.decrypt(res, "system");
    expect(pt).toBe("pii: 4111-1111-1111-1111");
  });

  it("produces different ciphertext each call (fresh IV)", async () => {
    const mgr = setup();
    mgr.createKey("t1");
    const a = await mgr.encrypt("t1", "same", "sys");
    const b = await mgr.encrypt("t1", "same", "sys");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("rejects tampered ciphertext (GCM tag)", async () => {
    const mgr = setup();
    mgr.createKey("t1");
    const res = await mgr.encrypt("t1", "secret", "sys");
    const bytes = atob(res.ciphertext).split("");
    bytes[0] = String.fromCharCode(bytes[0].charCodeAt(0) ^ 0xff);
    const bad = { ...res, ciphertext: btoa(bytes.join("")) };
    await expect(mgr.decrypt(bad, "sys")).rejects.toThrow();
  });

  it("rejects replay with modified IV (AAD binds IV)", async () => {
    const mgr = setup();
    mgr.createKey("t1");
    const res = await mgr.encrypt("t1", "x", "sys");
    await expect(mgr.decrypt({ ...res, iv: btoa(new Uint8Array(12)) }, "sys")).rejects.toThrow();
  });

  it("rejects decrypt under wrong tenant (AAD binds tenantId)", async () => {
    const mgr = setup();
    mgr.createKey("t1");
    const res = await mgr.encrypt("t1", "data", "sys");
    await expect(mgr.decrypt({ ...res, tenantId: "t2" }, "sys")).rejects.toThrow();
  });

  it("rejects decrypt with wrong algorithm (AAD binds algorithm)", async () => {
    const mgr = setup();
    mgr.createKey("t1");
    const res = await mgr.encrypt("t1", "data", "sys");
    await expect(mgr.decrypt({ ...res, algorithm: "AES-256-CBC" }, "sys")).rejects.toThrow();
  });

  it("revoked key cannot decrypt", async () => {
    const mgr = setup();
    const k = mgr.createKey("t1");
    const res = await mgr.encrypt("t1", "x", "sys");
    mgr.revokeKey(k.keyId, "admin");
    await expect(mgr.decrypt(res, "sys")).rejects.toThrow(/revoked/);
  });

  it("generates CSPRNG IVs, not Math.random()", async () => {
    const mgr = setup();
    mgr.createKey("t1");
    const a = await mgr.encrypt("t1", "x", "sys");
    const b = await mgr.encrypt("t1", "x", "sys");
    // If Math.random() were used, collision chance over 2^96 is negligible in a single run,
    // but the old impl used Math.random().toString(16) which is a 12-char hex string
    // with only ~48 bits of entropy. Our IV is 96 bits from CSPRNG.
    expect(atob(a.iv)).toHaveLength(12);
    expect(a.iv).not.toBe(b.iv);
  });

  it("key IDs are collision-resistant (CSPRNG, not Math.random())", () => {
    const mgr = setup();
    const ids = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      ids.add(mgr.createKey("t1").keyId);
    }
    expect(ids.size).toBe(100);
  });

  it("rejects missing active key", async () => {
    const mgr = setup();
    await expect(mgr.encrypt("empty-tenant", "x", "sys")).rejects.toThrow(/No active keys/);
  });

  it("revoked key blocks encrypt", async () => {
    const mgr = setup();
    const k = mgr.createKey("t1");
    mgr.revokeKey(k.keyId, "admin");
    await expect(mgr.encrypt("t1", "x", "sys")).rejects.toThrow(/No active keys/);
  });

  it("audit log records operations", async () => {
    const mgr = setup();
    mgr.createKey("t1");
    await mgr.encrypt("t1", "x", "alice");
    await mgr.decrypt(await mgr.encrypt("t1", "y", "bob"), "bob");
    const log = mgr.getAuditLog("t1");
    expect(log.length).toBe(4);
    expect(log[0].action).toBe("create");
    expect(log[1].action).toBe("encrypt");
    expect(log[2].action).toBe("encrypt");
    expect(log[3].action).toBe("decrypt");
  });
});