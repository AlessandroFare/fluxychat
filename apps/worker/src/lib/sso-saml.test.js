import { describe, it, expect, vi } from "vitest";

vi.mock("cloudflare:test", () => ({ env: { DB: { prepare: vi.fn() } } }));

function mockDB(rows = []) {
  const chain = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
    first: vi.fn().mockResolvedValue(rows[0] || null),
    all: vi.fn().mockResolvedValue({ results: rows }),
  };
  return chain;
}

const env = {};

describe("sso-saml", () => {
  it("creates SAML configuration", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createConfiguration } = await import("../lib/sso-saml.js");
    const result = await createConfiguration(env, {
      projectId: "p1", name: "Okta SSO",
      idpEntityId: "http://okta.com", idpSsoUrl: "https://okta.com/sso",
      idpCertificate: "MIIC...", spEntityId: "fluxychat", spAcsUrl: "https://app.com/saml/acs",
    });
    expect(result.id).toMatch(/^sc_/);
  });

  it("creates SAML session", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createSession } = await import("../lib/sso-saml.js");
    const result = await createSession(env, { projectId: "p1", configurationId: "sc_1", userId: "u1", nameId: "user@okta.com" });
    expect(result.id).toMatch(/^ss_/);
  });

  it("invalidates user sessions", async () => {
    const db = mockDB();
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { invalidateUserSessions } = await import("../lib/sso-saml.js");
    const result = await invalidateUserSessions(env, { projectId: "p1", userId: "u1" });
    expect(result.invalidated).toBeGreaterThanOrEqual(0);
  });

  it("provisions JIT user", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { provisionUser } = await import("../lib/sso-saml.js");
    const result = await provisionUser(env, { projectId: "p1", configurationId: "sc_1", userId: "u1", nameId: "user@okta.com", email: "user@okta.com" });
    expect(result.id).toMatch(/^sj_/);
  });

  it("logs audit event", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { logAuditEvent } = await import("../lib/sso-saml.js");
    const result = await logAuditEvent(env, { projectId: "p1", eventType: "login_success", userId: "u1" });
    expect(result.id).toMatch(/^sa_/);
  });

  it("gets SSO stats", async () => {
    const db = mockDB([{ status: "active", count: 2 }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { getSSOStats } = await import("../lib/sso-saml.js");
    const result = await getSSOStats(env, { projectId: "p1" });
    expect(result).toHaveProperty("configurations");
    expect(result).toHaveProperty("activeSessions");
    expect(result).toHaveProperty("recentLogins");
  });
});
