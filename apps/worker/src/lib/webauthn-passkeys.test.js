import { describe, expect, it } from "vitest";
import { getWebAuthnConfig } from "./webauthn-passkeys.js";

describe("getWebAuthnConfig", () => {
  it("derives rpID from origin when env unset", () => {
    const cfg = getWebAuthnConfig({}, "https://app.example.com");
    expect(cfg.rpID).toBe("app.example.com");
    expect(cfg.rpName).toBe("FluxyChat");
    expect(cfg.origin).toBe("https://app.example.com");
  });

  it("supports comma-separated origins from env", () => {
    const cfg = getWebAuthnConfig(
      { WEBAUTHN_RP_ID: "example.com", WEBAUTHN_ORIGIN: "https://a.com, https://b.com" },
      null,
    );
    expect(cfg.rpID).toBe("example.com");
    expect(cfg.origin).toEqual(["https://a.com", "https://b.com"]);
  });
});
