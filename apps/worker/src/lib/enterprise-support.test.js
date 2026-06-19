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

describe("enterprise-support", () => {
  it("creates ticket with auto-increment", async () => {
    const db = mockDB([{ ticket_number: 5 }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createTicket } = await import("../lib/enterprise-support.js");
    const result = await createTicket(env, { projectId: "p1", subject: "Login issue", reportedBy: "u1" });
    expect(result.id).toMatch(/^st_/);
    expect(result.ticketNumber).toBe(6);
  });

  it("creates ticket with first number", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createTicket } = await import("../lib/enterprise-support.js");
    const result = await createTicket(env, { projectId: "p1", subject: "Bug report", reportedBy: "u1" });
    expect(result.ticketNumber).toBe(1);
  });

  it("updates ticket", async () => {
    const db = mockDB();
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { updateTicket } = await import("../lib/enterprise-support.js");
    const result = await updateTicket(env, { ticketId: "st_1", status: "in_progress", assignedTo: "agent1" });
    expect(result.updated).toBe(true);
  });

  it("adds ticket message", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { addTicketMessage } = await import("../lib/enterprise-support.js");
    const result = await addTicketMessage(env, { ticketId: "st_1", senderType: "agent", senderId: "a1", content: "Looking into it" });
    expect(result.id).toMatch(/^stm_/);
  });

  it("creates SLA policy", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createSLAPolicy } = await import("../lib/enterprise-support.js");
    const result = await createSLAPolicy(env, { projectId: "p1", name: "Premium SLA", priority: "urgent", responseTimeHours: 1, resolveTimeHours: 4 });
    expect(result.id).toMatch(/^ssp_/);
  });

  it("creates escalation rule", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createEscalationRule } = await import("../lib/enterprise-support.js");
    const result = await createEscalationRule(env, { projectId: "p1", name: "Auto-escalate blockers", conditions: { severity: "blocker" }, actions: { assignGroup: "senior" } });
    expect(result.id).toMatch(/^ser_/);
  });

  it("creates KB article", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createKBArticle } = await import("../lib/enterprise-support.js");
    const result = await createKBArticle(env, { projectId: "p1", title: "How to reset password", content: "Go to settings...", category: "authentication" });
    expect(result.id).toMatch(/^skb_/);
  });

  it("creates satisfaction survey", async () => {
    const db = mockDB([{ id: "st_1" }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createSatisfactionSurvey } = await import("../lib/enterprise-support.js");
    const result = await createSatisfactionSurvey(env, { projectId: "p1", ticketId: "st_1" });
    expect(result.id).toMatch(/^sss_/);
  });

  it("gets support stats", async () => {
    const db = mockDB([{ status: "open", count: 10 }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { getSupportStats } = await import("../lib/enterprise-support.js");
    const result = await getSupportStats(env, { projectId: "p1" });
    expect(result).toHaveProperty("byStatus");
    expect(result).toHaveProperty("byPriority");
    expect(result).toHaveProperty("avgSatisfaction");
    expect(result).toHaveProperty("avgFirstResponseHours");
    expect(result).toHaveProperty("openTickets");
    expect(result).toHaveProperty("kbArticles");
  });
});
