import { describe, expect, it } from "vitest";
import { createMlsManager } from "./mls-encryption";
import { buildMlsRegistryUpsertFromManager, hydrateMlsManagerFromRegistry } from "./room-mls-sync";

describe("room-mls-sync", () => {
  it("hydrates manager devices and epoch from registry", () => {
    const manager = createMlsManager();
    const hydrated = hydrateMlsManagerFromRegistry(manager, {
      roomId: "room-1",
      groupId: "mls_test_group",
      epoch: 2,
      cipherSuite: "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519",
      maxDevices: 8,
      devices: [
        {
          deviceId: "alice-phone",
          publicKey: "pk-alice",
          signatureKey: "sk-alice",
        },
      ],
    });

    expect(hydrated.groupId).toBe("mls_test_group");
    expect(manager.getEpoch("mls_test_group")).toBe(2);
    expect(hydrated.devices.has("alice-phone")).toBe(true);
  });

  it("builds registry payload from local manager state", () => {
    const manager = createMlsManager();
    const group = manager.createGroup({ maxDevices: 4 });
    manager.addDevice(group.groupId, {
      deviceId: "bob",
      publicKey: "pk-bob",
      signatureKey: "sk-bob",
      credentialType: "basic",
    });
    manager.rotateKeys(group.groupId);

    const payload = buildMlsRegistryUpsertFromManager(manager, group.groupId, "room-2");
    expect(payload?.epoch).toBe(1);
    expect(payload?.devices).toHaveLength(1);
    expect(payload?.roomId).toBe("room-2");
  });
});
