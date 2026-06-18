import { describe, expect, it } from "vitest";
import {
  assertSafeOutboundUrl,
  isPrivateUrl,
  safeOutboundFetch,
} from "./url-ssrf.js";

describe("url-ssrf (P1 ENG-05)", () => {
  it("blocks localhost and loopback", () => {
    expect(isPrivateUrl("http://127.0.0.1/admin")).toBe(true);
    expect(isPrivateUrl("http://localhost/")).toBe(true);
    expect(isPrivateUrl("https://[::1]/")).toBe(true);
  });

  it("blocks RFC1918 and link-local ranges", () => {
    expect(isPrivateUrl("http://10.0.0.1/")).toBe(true);
    expect(isPrivateUrl("http://192.168.1.1/")).toBe(true);
    expect(isPrivateUrl("http://169.254.169.254/latest/meta-data")).toBe(true);
  });

  it("blocks decimal IP encoding (127.0.0.1)", () => {
    expect(isPrivateUrl("http://2130706433/")).toBe(true);
  });

  it("blocks IPv4-mapped IPv6 loopback", () => {
    expect(isPrivateUrl("http://[::ffff:127.0.0.1]/")).toBe(true);
    expect(isPrivateUrl("http://::ffff:127.0.0.1/")).toBe(true);
  });

  it("blocks malformed IPv6 bracket hostnames", () => {
    expect(isPrivateUrl("http://[::1/run")).toBe(true);
  });

  it("allows public HTTPS targets", () => {
    expect(isPrivateUrl("https://example.com/webhook")).toBe(false);
    expect(isPrivateUrl("https://hooks.stripe.com/")).toBe(false);
  });

  it("assertSafeOutboundUrl throws ssrf_blocked", () => {
    expect(() => assertSafeOutboundUrl("http://127.0.0.1/")).toThrow("ssrf_blocked");
    expect(assertSafeOutboundUrl("https://example.com/").href).toBe("https://example.com/");
  });

  it("safeOutboundFetch rejects private URLs before fetch", async () => {
    await expect(safeOutboundFetch("http://127.0.0.1/")).rejects.toThrow("ssrf_blocked");
  });

  it("blocks well-known DNS-based SSRF vectors (audit S-15)", () => {
    expect(isPrivateUrl("http://1.2.3.4.nip.io/")).toBe(true);
    expect(isPrivateUrl("http://127.0.0.1.sslip.io/")).toBe(true);
    expect(isPrivateUrl("http://127.0.0.1.localtest.me/")).toBe(true);
    expect(isPrivateUrl("http://lvh.me/")).toBe(true);
  });

  it("honours ALLOWED_SSRF_HOSTS operator allowlist", () => {
    const env = { ALLOWED_SSRF_HOSTS: "internal.acme.com,*.staging.acme.com" };
    expect(isPrivateUrl("https://internal.acme.com/hook", env)).toBe(false);
    expect(isPrivateUrl("https://chat.staging.acme.com/hook", env)).toBe(false);
    // Does not leak the allowlist to other private hosts.
    expect(isPrivateUrl("http://10.0.0.5/", env)).toBe(true);
    expect(isPrivateUrl("http://localhost/", env)).toBe(true);
  });

  // Audit A-1: explicit per-rule coverage called out in the audit
  // report so a future regression in any one rule is loud.
  it("explicit per-rule coverage: 127.0.0.1, 10.x, 192.168.x, link-local, file://", () => {
    expect(isPrivateUrl("http://127.0.0.1/")).toBe(true);
    expect(isPrivateUrl("http://10.0.0.1/")).toBe(true);
    expect(isPrivateUrl("http://192.168.1.1/")).toBe(true);
    expect(isPrivateUrl("http://169.254.169.254/")).toBe(true);
    expect(isPrivateUrl("file:///etc/passwd")).toBe(true);
    // Valid https must pass.
    expect(isPrivateUrl("https://example.com/")).toBe(false);
  });
});
