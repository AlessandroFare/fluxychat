import { describe, it, expect } from "vitest";
import { createMlsManager } from "./mls-encryption";

describe("mls-encryption", () => {
  it("should create a group", () => {
    const m = createMlsManager();
    const group = m.createGroup();
    expect(group.groupId).toMatch(/^mls-/);
    expect(group.epoch).toBe(0);
  });

  it("should add and remove devices", () => {
    const m = createMlsManager();
    const group = m.createGroup();
    m.addDevice(group.groupId, { deviceId: "dev-1", publicKey: "pk1", signatureKey: "sk1", credentialType: "basic" });
    expect(group.devices.size).toBe(1);
    m.removeDevice(group.groupId, "dev-1");
    expect(group.devices.size).toBe(0);
  });

  it("should encrypt and decrypt messages", () => {
    const m = createMlsManager();
    const group = m.createGroup();
    m.addDevice(group.groupId, { deviceId: "alice", publicKey: "pk-a", signatureKey: "sk-a", credentialType: "basic" });
    const msg = m.encryptMessage(group.groupId, "alice", "hello world");
    expect(msg.contentType).toBe("application");
    const decrypted = m.decryptMessage(group.groupId, msg);
    expect(decrypted).toBe("hello world");
  });

  it("should rotate keys", () => {
    const m = createMlsManager();
    const group = m.createGroup();
    expect(m.getEpoch(group.groupId)).toBe(0);
    m.rotateKeys(group.groupId);
    expect(m.getEpoch(group.groupId)).toBe(1);
  });

  it("should list groups", () => {
    const m = createMlsManager();
    m.createGroup();
    m.createGroup();
    expect(m.listGroups()).toHaveLength(2);
  });

  it("should reject encrypt from non-member", () => {
    const m = createMlsManager();
    const group = m.createGroup();
    expect(() => m.encryptMessage(group.groupId, "unknown", "test")).toThrow();
  });

  it("should enforce max devices", () => {
    const m = createMlsManager();
    const group = m.createGroup({ maxDevices: 1 });
    m.addDevice(group.groupId, { deviceId: "d1", publicKey: "pk", signatureKey: "sk", credentialType: "basic" });
    expect(() => m.addDevice(group.groupId, { deviceId: "d2", publicKey: "pk", signatureKey: "sk", credentialType: "basic" })).toThrow();
  });
});
