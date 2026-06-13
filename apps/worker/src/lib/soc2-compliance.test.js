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

describe("soc2-compliance", () => {
  it("creates control", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createControl } = await import("../lib/soc2-compliance.js");
    const result = await createControl(env, { projectId: "p1", controlId: "CC6.1", name: "Access Control", trustService: "security" });
    expect(result.id).toMatch(/^sc_/);
  });

  it("lists controls with filter", async () => {
    const db = mockDB([{ trust_service: "security", status: "implemented" }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { listControls } = await import("../lib/soc2-compliance.js");
    const result = await listControls(env, { projectId: "p1", trustService: "security" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("adds evidence", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { addEvidence } = await import("../lib/soc2-compliance.js");
    const result = await addEvidence(env, { projectId: "p1", controlId: "CC6.1", evidenceType: "document", title: "Access Policy" });
    expect(result.id).toMatch(/^se_/);
  });

  it("creates risk assessment", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createRiskAssessment } = await import("../lib/soc2-compliance.js");
    const result = await createRiskAssessment(env, { projectId: "p1", title: "Unauthorized access", riskLevel: "high", likelihood: "possible", impact: "major" });
    expect(result.id).toMatch(/^sr_/);
  });

  it("lists risks with filter", async () => {
    const db = mockDB([{ risk_level: "high" }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { listRiskAssessments } = await import("../lib/soc2-compliance.js");
    const result = await listRiskAssessments(env, { projectId: "p1", riskLevel: "high" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("creates policy", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createPolicy } = await import("../lib/soc2-compliance.js");
    const result = await createPolicy(env, { projectId: "p1", name: "Acceptable Use Policy", policyType: "acceptable_use" });
    expect(result.id).toMatch(/^sp_/);
  });

  it("acknowledges policy", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { acknowledgePolicy } = await import("../lib/soc2-compliance.js");
    const result = await acknowledgePolicy(env, { projectId: "p1", policyId: "sp_1", userId: "u1" });
    expect(result.id).toMatch(/^sa_/);
  });

  it("creates incident", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createIncident } = await import("../lib/soc2-compliance.js");
    const result = await createIncident(env, { projectId: "p1", title: "Data breach attempt", severity: "high" });
    expect(result.id).toMatch(/^si_/);
  });

  it("creates report", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createReport } = await import("../lib/soc2-compliance.js");
    const result = await createReport(env, { projectId: "p1", reportType: "compliance", title: "Q1 SOC 2 Report" });
    expect(result.id).toMatch(/^srpt_/);
  });

  it("gets compliance dashboard", async () => {
    const db = mockDB([{ status: "implemented", count: 10 }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { getComplianceDashboard } = await import("../lib/soc2-compliance.js");
    const result = await getComplianceDashboard(env, { projectId: "p1" });
    expect(result).toHaveProperty("controls");
    expect(result).toHaveProperty("risks");
    expect(result).toHaveProperty("incidents");
    expect(result).toHaveProperty("policies");
  });
});
