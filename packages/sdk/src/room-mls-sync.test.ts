import { describe, expect, it } from "vitest";
import { createGroupCipher } from "./group-cipher";
import {
  buildMlsRegistryUpsertFromManager,
  hydrateMlsManagerFromRegistry,
} from "./room-mls-sync";

function keyMaterial(): string {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) bytes[i] = i;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

describe("room-mls-sync", () => {
  it("hydrates manager devices and epoch from registry", () => {
    const cipher = createGroupCipher({ keyMaterial: keyMaterial() });
    const hydrated = hydrateMlsManagerFromRegistry(cipher, {
      roomId: "room-1",
      groupId: "grp_test",
      epoch: 2,
      cipherSuite: "AES-256-GCM/HKDF-SHA256",
      maxDevices: 8,
      devices: [
        {
          deviceId: "alice-phone",
          publicKey: "pk-alice",
          credentialType: "basic",
        },
      ],
    });

    expect(hydrated.groupId).toBe("grp_test");
    expect(cipher.getEpoch("grp_test")).toBe(2);
    expect(hydrated.devices.has("alice-phone")).toBe(true);
  });

  it("builds registry payload from local manager state", () => {
    const cipher = createGroupCipher({ keyMaterial: keyMaterial() });
    const group = cipher.createGroup({ maxDevices: 4 });
    cipher.addDevice(group.groupId, {
      deviceId: "bob",
      publicKey: "pk-bob",
      credentialType: "basic",
    });
    cipher.rotateEpoch(group.groupId);

    const payload = buildMlsRegistryUpsertFromManager(cipher, group.groupId, "room-2");
    expect(payload?.epoch).toBe(1);
    expect(payload?.devices).toHaveLength(1);
    expect(payload?.roomId).toBe("room-2");
  });
});