import { describe, expect, it } from "vitest";
import { resolveMessageExpiry } from "./message-ttl.js";

describe("resolveMessageExpiry", () => {
  const env = { MESSAGE_TTL_MAX_SECONDS: 3600 };

  it("accepts expiresInSeconds within bounds", () => {
    const result = resolveMessageExpiry({ expiresInSeconds: 120 }, env);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.expiresAt).toBeTruthy();
      expect(Date.parse(result.expiresAt)).toBeGreaterThan(Date.now());
    }
  });

  it("rejects TTL below minimum", () => {
    const result = resolveMessageExpiry({ expiresInSeconds: 10 }, env);
    expect(result.ok).toBe(false);
  });

  it("returns null when omitted", () => {
    expect(resolveMessageExpiry({}, env)).toEqual({ ok: true, expiresAt: null });
  });
});
