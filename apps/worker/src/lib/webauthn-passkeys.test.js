import { describe, expect, it } from "vitest";
import { getWebAuthnConfig } from "./webauthn-passkeys.js";

describe("getWebAuthnConfig", () => {
  it("derives rpID from origin in development", () => {
    const cfg = getWebAuthnConfig({ NODE_ENV: "development" }, "https://app.example.com");
    expect(cfg.configured).toBe(true);
    expect(cfg.rpID).toBe("app.example.com");
    expect(cfg.rpName).toBe("FluxyChat");
    expect(cfg.origin).toBe("https://app.example.com");
  });

  it("supports comma-separated origins from env", () => {
    const cfg = getWebAuthnConfig(
      { WEBAUTHN_RP_ID: "example.com", WEBAUTHN_ORIGIN: "https://a.com, https://b.com" },
      null,
    );
    expect(cfg.configured).toBe(true);
    expect(cfg.rpID).toBe("example.com");
    expect(cfg.origin).toEqual(["https://a.com", "https://b.com"]);
  });

  it("fails closed in production without a configured trust anchor (audit F-33)", () => {
    const cfg = getWebAuthnConfig(
      { NODE_ENV: "production" },
      "https://evil.example",
    );
    expect(cfg.configured).toBe(false);

    const optedIn = getWebAuthnConfig(
      { NODE_ENV: "production", WEBAUTHN_TRUST_REQUEST_ORIGIN: "true" },
      "https://app.example.com",
    );
    expect(optedIn.configured).toBe(true);
    expect(optedIn.rpID).toBe("app.example.com");
  });

  it("accepts an env-only rpID in production", () => {
    const cfg = getWebAuthnConfig(
      { NODE_ENV: "production", WEBAUTHN_RP_ID: "app.example.com" },
      null,
    );
    expect(cfg.configured).toBe(true);
    expect(cfg.rpID).toBe("app.example.com");
    expect(cfg.origin).toBe("https://app.example.com");
  });
});
