import { describe, expect, it } from "vitest";
import {
  createGroupCipher,
  GROUP_CIPHER_SUITE,
  GROUP_BASE_KEY_BYTES,
} from "./group-cipher.js";

function keyMaterial(seed = 7): string {
  const bytes = new Uint8Array(GROUP_BASE_KEY_BYTES);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = (i * 31 + seed) % 256;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function setup(seed?: number) {
  const cipher = createGroupCipher({ keyMaterial: keyMaterial(seed) });
  const group = cipher.createGroup({ groupId: "g1" });
  cipher.addDevice("g1", { deviceId: "alice" });
  cipher.addDevice("g1", { deviceId: "bob" });
  return { cipher, group };
}

describe("createGroupCipher — key material", () => {
  it("refuses a key of the wrong length instead of silently weakening", () => {
    expect(() => createGroupCipher({ keyMaterial: btoa("short") })).toThrow(
      /requires 32 bytes/,
    );
  });

  it("refuses missing key material", () => {
    // @ts-expect-error exercising the runtime guard
    expect(() => createGroupCipher({})).toThrow(/requires 32 bytes/);
  });
});

describe("createGroupCipher — real encryption", () => {
  it("produces ciphertext that is not the plaintext (the old impl returned base64)", async () => {
    const { cipher } = setup();
    const plaintext = "transfer 5000 to account 12345";

    const env = await cipher.encrypt("g1", "alice", plaintext);

    expect(env.ciphertext).not.toBe(btoa(plaintext));
    expect(atob(env.ciphertext)).not.toContain("transfer");
    expect(env.suite).toBe(GROUP_CIPHER_SUITE);
  });

  it("round-trips", async () => {
    const { cipher } = setup();
    const env = await cipher.encrypt("g1", "alice", "hello \u00e9\u00fc \ud83d\ude80");
    await expect(cipher.decrypt("g1", env)).resolves.toBe("hello \u00e9\u00fc \ud83d\ude80");
  });

  it("uses a fresh IV per message, so identical plaintext yields different ciphertext", async () => {
    const { cipher } = setup();
    const a = await cipher.encrypt("g1", "alice", "same");
    const b = await cipher.encrypt("g1", "alice", "same");

    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    await expect(cipher.decrypt("g1", a)).resolves.toBe("same");
    await expect(cipher.decrypt("g1", b)).resolves.toBe("same");
  });

  it("emits a 12-byte IV", async () => {
    const { cipher } = setup();
    const env = await cipher.encrypt("g1", "alice", "x");
    expect(atob(env.iv)).toHaveLength(12);
  });
});

describe("createGroupCipher — tamper resistance", () => {
  it("rejects a modified ciphertext (GCM tag)", async () => {
    const { cipher } = setup();
    const env = await cipher.encrypt("g1", "alice", "original");
    const bytes = atob(env.ciphertext).split("");
    bytes[0] = String.fromCharCode(bytes[0].charCodeAt(0) ^ 0xff);
    const tampered = { ...env, ciphertext: btoa(bytes.join("")) };

    await expect(cipher.decrypt("g1", tampered)).rejects.toThrow();
  });

  it("rejects a re-attributed sender (AAD binds senderId)", async () => {
    const { cipher } = setup();
    const env = await cipher.encrypt("g1", "alice", "alice said this");

    await expect(cipher.decrypt("g1", { ...env, sender: "bob" })).rejects.toThrow();
  });

  it("rejects a replay into another epoch (AAD binds epoch)", async () => {
    const { cipher } = setup();
    const env = await cipher.encrypt("g1", "alice", "epoch 0 message");
    cipher.rotateEpoch("g1");

    await expect(cipher.decrypt("g1", { ...env, epoch: 1 })).rejects.toThrow();
  });

  it("rejects a replay into another group (AAD binds groupId)", async () => {
    const { cipher } = setup();
    const env = await cipher.encrypt("g1", "alice", "for g1 only");
    cipher.createGroup({ groupId: "g2" });
    cipher.addDevice("g2", { deviceId: "alice" });

    await expect(cipher.decrypt("g2", { ...env, groupId: "g2" })).rejects.toThrow();
  });

  it("rejects an unknown cipher suite instead of guessing", async () => {
    const { cipher } = setup();
    const env = await cipher.encrypt("g1", "alice", "x");

    await expect(
      // @ts-expect-error deliberately invalid suite
      cipher.decrypt("g1", { ...env, suite: "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519" }),
    ).rejects.toThrow(/unsupported cipher suite/);
  });
});

describe("createGroupCipher — key separation", () => {
  it("a different base key cannot decrypt", async () => {
    const { cipher } = setup(7);
    const env = await cipher.encrypt("g1", "alice", "secret");

    const other = createGroupCipher({ keyMaterial: keyMaterial(9) });
    other.importGroup({ groupId: "g1", epoch: 0, devices: [{ deviceId: "alice" }] });

    await expect(other.decrypt("g1", env)).rejects.toThrow();
  });

  it("rotating the epoch retires the previous key for new messages", async () => {
    const { cipher } = setup();
    const before = await cipher.encrypt("g1", "alice", "old epoch");
    expect(cipher.rotateEpoch("g1")).toBe(1);
    const after = await cipher.encrypt("g1", "alice", "new epoch");

    expect(before.epoch).toBe(0);
    expect(after.epoch).toBe(1);
    // Historical ciphertext still decrypts under its own epoch key.
    await expect(cipher.decrypt("g1", before)).resolves.toBe("old epoch");
    await expect(cipher.decrypt("g1", after)).resolves.toBe("new epoch");
  });
});

describe("createGroupCipher — membership", () => {
  it("refuses to encrypt for a device outside the group", async () => {
    const { cipher } = setup();
    await expect(cipher.encrypt("g1", "mallory", "x")).rejects.toThrow(/not in group/);
  });

  it("enforces maxDevices", () => {
    const cipher = createGroupCipher({ keyMaterial: keyMaterial() });
    cipher.createGroup({ groupId: "small", config: { maxDevices: 1 } });
    cipher.addDevice("small", { deviceId: "a" });
    expect(() => cipher.addDevice("small", { deviceId: "b" })).toThrow(/max capacity/);
  });

  it("throws on unknown groups rather than returning empty results", async () => {
    const cipher = createGroupCipher({ keyMaterial: keyMaterial() });
    await expect(cipher.encrypt("nope", "a", "x")).rejects.toThrow(/not found/);
    expect(cipher.getGroup("nope")).toBeNull();
  });

  it("importGroup restores epoch and devices", () => {
    const cipher = createGroupCipher({ keyMaterial: keyMaterial() });
    cipher.importGroup({
      groupId: "g9",
      epoch: 4,
      devices: [{ deviceId: "a" }, { deviceId: "b" }],
    });
    expect(cipher.getEpoch("g9")).toBe(4);
    expect(cipher.getGroup("g9")?.devices.size).toBe(2);
    expect(cipher.listGroups()).toHaveLength(1);
  });

  it("always reports the honest cipher suite, never an MLS suite string", () => {
    const cipher = createGroupCipher({ keyMaterial: keyMaterial() });
    const g = cipher.createGroup({
      groupId: "g",
      // @ts-expect-error callers must not be able to claim MLS
      config: { cipherSuite: "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519" },
    });
    expect(g.config.cipherSuite).toBe(GROUP_CIPHER_SUITE);
  });
});
