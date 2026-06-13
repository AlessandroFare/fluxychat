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

describe("hipaa-compliance", () => {
  it("creates BAA", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createBAA } = await import("../lib/hipaa-compliance.js");
    const result = await createBAA(env, { projectId: "p1", entityName: "Hospital ABC", entityType: "covered_entity" });
    expect(result.id).toMatch(/^hba_/);
  });

  it("logs PHI access", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { logPHIAccess } = await import("../lib/hipaa-compliance.js");
    const result = await logPHIAccess(env, { projectId: "p1", userId: "u1", phiType: "medical", resourceType: "patient_record", action: "view", purpose: "treatment" });
    expect(result.id).toMatch(/^hpa_/);
  });

  it("logs PHI detection", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { logPHIDetection } = await import("../lib/hipaa-compliance.js");
    const result = await logPHIDetection(env, { projectId: "p1", roomId: "r1", detectedType: "ssn", confidence: 0.95, actionTaken: "masked" });
    expect(result.id).toMatch(/^hpd_/);
  });

  it("creates breach", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createBreach } = await import("../lib/hipaa-compliance.js");
    const result = await createBreach(env, { projectId: "p1", title: "Unauthorized access", phiTypesAffected: "medical,demographic", individualsAffected: 100, severity: "high" });
    expect(result.id).toMatch(/^hb_/);
  });

  it("assigns training", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { assignTraining } = await import("../lib/hipaa-compliance.js");
    const result = await assignTraining(env, { projectId: "p1", userId: "u1", trainingType: "annual" });
    expect(result.id).toMatch(/^ht_/);
  });

  it("configures encryption", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { configureEncryption } = await import("../lib/hipaa-compliance.js");
    const result = await configureEncryption(env, { projectId: "p1", dataType: "at_rest", algorithm: "AES-256" });
    expect(result.id).toMatch(/^he_/);
  });

  it("logs audit event", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { logAuditEvent } = await import("../lib/hipaa-compliance.js");
    const result = await logAuditEvent(env, { projectId: "p1", eventType: "phi_access", userId: "u1" });
    expect(result.id).toMatch(/^hal_/);
  });

  it("gets HIPAA dashboard", async () => {
    const db = mockDB([{ status: "active", count: 3 }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { getHIPAADashboard } = await import("../lib/hipaa-compliance.js");
    const result = await getHIPAADashboard(env, { projectId: "p1" });
    expect(result).toHaveProperty("baaStatus");
    expect(result).toHaveProperty("phiAccess");
    expect(result).toHaveProperty("phiDetections");
    expect(result).toHaveProperty("breaches");
    expect(result).toHaveProperty("training");
  });
});
