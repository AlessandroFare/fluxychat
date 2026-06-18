import { describe, it, expect } from "vitest";
import { clientIpFromRequest } from "./client-ip.js";

function req(headers) {
  return new Request("https://example.com/", { headers });
}

describe("clientIpFromRequest", () => {
  it("always trusts CF-Connecting-IP", () => {
    const r = req({
      "CF-Connecting-IP": "203.0.113.7",
      "X-Forwarded-For": "1.2.3.4",
    });
    expect(clientIpFromRequest(r, {})).toBe("203.0.113.7");
  });

  it("ignores X-Forwarded-For by default (anti-spoof)", () => {
    const r = req({ "X-Forwarded-For": "1.2.3.4" });
    // No CF header and XFF not trusted -> shared fallback, NOT the spoofed IP.
    expect(clientIpFromRequest(r, {})).toBe("unknown");
    expect(clientIpFromRequest(r)).toBe("unknown");
  });

  it("uses the right-most XFF entry when TRUST_FORWARDED_FOR is true", () => {
    const r = req({ "X-Forwarded-For": "1.2.3.4, 198.51.100.9" });
    // Left-most (1.2.3.4) is attacker-controlled; we take the proxy-appended last hop.
    expect(
      clientIpFromRequest(r, { TRUST_FORWARDED_FOR: "true" }),
    ).toBe("198.51.100.9");
  });

  it("falls back to unknown when no headers are present", () => {
    expect(clientIpFromRequest(req({}), { TRUST_FORWARDED_FOR: "true" })).toBe(
      "unknown",
    );
  });
});
