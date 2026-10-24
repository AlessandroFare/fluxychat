/**
 * Audit F-30/F-75/F-87: at-rest sealing for single-column secrets.
 */
import { describe, expect, it } from "vitest";
import { sealSecretAtRest, openSecretAtRest } from "./secrets-crypto.js";

const KEY_ENV = {
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
};

describe("sealSecretAtRest / openSecretAtRest", () => {
  it("round-trips with a configured key and never stores the plaintext", async () => {
    const stored = await sealSecretAtRest(KEY_ENV, "JBSWY3DPEHPK3PXP");
    expect(stored.startsWith("enc:v1:")).toBe(true);
    expect(stored).not.toContain("JBSWY3DPEHPK3PXP");
    expect(await openSecretAtRest(KEY_ENV, stored)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("passes legacy plaintext through", async () => {
    expect(await openSecretAtRest(KEY_ENV, "legacy-plain")).toBe("legacy-plain");
    expect(await openSecretAtRest({}, "legacy-plain")).toBe("legacy-plain");
  });

  it("stores plaintext when no key is configured", async () => {
    const stored = await sealSecretAtRest({}, "no-key");
    expect(stored).toBe("no-key");
  });

  it("returns null when the envelope cannot be decrypted", async () => {
    const stored = await sealSecretAtRest(KEY_ENV, "secret");
    expect(await openSecretAtRest({}, stored)).toBeNull();
  });
});
