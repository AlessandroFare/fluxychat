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

describe("customer-data", () => {
  it("creates customer", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { upsertCustomer } = await import("../lib/customer-data.js");
    const result = await upsertCustomer(env, { projectId: "p1", externalId: "user_123", email: "a@b.com", name: "Test" });
    expect(result.id).toMatch(/^cp_/);
    expect(result.created).toBe(true);
  });

  it("updates existing customer", async () => {
    const db = mockDB([{ id: "cp_existing" }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { upsertCustomer } = await import("../lib/customer-data.js");
    const result = await upsertCustomer(env, { projectId: "p1", externalId: "user_123", name: "Updated" });
    expect(result.id).toBe("cp_existing");
    expect(result.updated).toBe(true);
  });

  it("tracks event", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { trackEvent } = await import("../lib/customer-data.js");
    const result = await trackEvent(env, { projectId: "p1", customerId: "cp_1", eventType: "behavior", eventName: "page_view" });
    expect(result.id).toMatch(/^ce_/);
  });

  it("creates segment", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createSegment } = await import("../lib/customer-data.js");
    const result = await createSegment(env, { projectId: "p1", name: "High Value", rules: { score: { gte: 100 } } });
    expect(result.id).toMatch(/^csg_/);
  });

  it("adds segment member", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { addSegmentMember } = await import("../lib/customer-data.js");
    const result = await addSegmentMember(env, { segmentId: "csg_1", customerId: "cp_1" });
    expect(result.id).toMatch(/^csm_/);
  });

  it("creates broadcast", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createBroadcast } = await import("../lib/customer-data.js");
    const result = await createBroadcast(env, { projectId: "p1", name: "Welcome", content: "Hello!" });
    expect(result.id).toMatch(/^cb_/);
  });

  it("defines property", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { defineProperty } = await import("../lib/customer-data.js");
    const result = await defineProperty(env, { projectId: "p1", propertyName: "company", propertyType: "string" });
    expect(result.id).toMatch(/^cpr_/);
  });

  it("gets customer stats", async () => {
    const db = mockDB([{ count: 100 }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { getCustomerStats } = await import("../lib/customer-data.js");
    const result = await getCustomerStats(env, { projectId: "p1" });
    expect(result).toHaveProperty("totalCustomers");
    expect(result).toHaveProperty("byLifecycle");
    expect(result).toHaveProperty("recentEvents");
    expect(result).toHaveProperty("activeSegments");
    expect(result).toHaveProperty("broadcasts");
  });
});
