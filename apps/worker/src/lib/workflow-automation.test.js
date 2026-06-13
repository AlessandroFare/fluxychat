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

describe("workflow-automation", () => {
  it("creates workflow", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createWorkflow } = await import("../lib/workflow-automation.js");
    const result = await createWorkflow(env, { projectId: "p1", name: "Auto-reply", triggerType: "message", actions: [{ type: "send_message" }] });
    expect(result.id).toMatch(/^wf_/);
  });

  it("starts execution", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { startExecution } = await import("../lib/workflow-automation.js");
    const result = await startExecution(env, { workflowId: "wf_1", projectId: "p1" });
    expect(result.id).toMatch(/^wfe_/);
  });

  it("starts step", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { startStep } = await import("../lib/workflow-automation.js");
    const result = await startStep(env, { executionId: "wfe_1", workflowId: "wf_1", stepIndex: 0, stepType: "send_message" });
    expect(result.id).toMatch(/^wfes_/);
  });

  it("creates template", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createTemplate } = await import("../lib/workflow-automation.js");
    const result = await createTemplate(env, { name: "Welcome message", category: "notification", triggerType: "user_join", actions: [{ type: "send_message" }] });
    expect(result.id).toMatch(/^wft_/);
  });

  it("creates schedule", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createSchedule } = await import("../lib/workflow-automation.js");
    const result = await createSchedule(env, { workflowId: "wf_1", projectId: "p1", scheduleType: "cron", cronExpression: "0 9 * * *" });
    expect(result.id).toMatch(/^wfs_/);
  });

  it("gets workflow stats", async () => {
    const db = mockDB([{ status: "active", count: 10 }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { getWorkflowStats } = await import("../lib/workflow-automation.js");
    const result = await getWorkflowStats(env, { projectId: "p1" });
    expect(result).toHaveProperty("workflows");
    expect(result).toHaveProperty("executions");
    expect(result).toHaveProperty("avgDurationMs");
  });
});
