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
    const row = {
      id: "wf_1", project_id: "p1", name: "Auto-reply", description: null, status: "draft",
      trigger_type: "message", trigger_config: null, actions: "[]", conditions: null,
      error_handling: "stop", max_retries: 3, timeout_seconds: 30, run_count: 0,
      last_run_at: null, last_error: null, created_by: null, created_at: "t", updated_at: "t",
      started_at: new Date().toISOString(),
    };
    const db = mockDB([row]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { startExecution } = await import("../lib/workflow-automation.js");
    const result = await startExecution(env, { workflowId: "wf_1", projectId: "p1" });
    expect(result.id).toMatch(/^wfe_/);
    expect(result.matchedConditions).toBe(true);
  });

  it("skips actions when conditions fail", async () => {
    const row = {
      id: "wf_1", project_id: "p1", name: "VIP", description: null, status: "active",
      trigger_type: "message_received", trigger_config: null,
      actions: JSON.stringify([{ type: "send_message", params: { text: "hi" } }]),
      conditions: JSON.stringify([{ field: "role", operator: "eq", value: "vip" }]),
      error_handling: "stop", max_retries: 3, timeout_seconds: 30, run_count: 0,
      last_run_at: null, last_error: null, created_by: null, created_at: "t", updated_at: "t",
      started_at: new Date().toISOString(),
    };
    const db = mockDB([row]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { startExecution } = await import("../lib/workflow-automation.js");
    const result = await startExecution(env, {
      workflowId: "wf_1", projectId: "p1", triggerData: { role: "guest" },
    });
    expect(result.skipped).toBe(true);
    expect(result.matchedConditions).toBe(false);
  });

  it("stores user-scoped workflow state", async () => {
    const db = mockDB();
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { setWorkflowState, getWorkflowState } = await import("../lib/workflow-automation.js");
    const set = await setWorkflowState(env, {
      projectId: "p1", scope: "user", scopeId: "u1", key: "step", value: { n: 2 },
    });
    expect(set.ok).toBe(true);
    db.first.mockResolvedValueOnce({ value_json: JSON.stringify({ n: 2 }), expires_at: null });
    const got = await getWorkflowState(env, { projectId: "p1", scope: "user", scopeId: "u1", key: "step" });
    expect(got.value).toEqual({ n: 2 });
  });

  it("rejects unknown state scopes", async () => {
    const { setWorkflowState } = await import("../lib/workflow-automation.js");
    const out = await setWorkflowState({ DB: mockDB() }, {
      projectId: "p1", scope: "global", scopeId: "x", key: "k", value: 1,
    });
    expect(out.ok).toBe(false);
  });

  it("does not fetch webhook URLs", async () => {
    const { runWorkflowActions } = await import("../lib/workflow-automation.js");
    const results = await runWorkflowActions({ DB: {} }, {
      projectId: "p1",
      actions: [{ type: "send_webhook", params: { url: "https://example.com/hook" } }],
    });
    expect(results[0].note).toBe("webhook_not_fetched");
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

  it("stops a waiting execution", async () => {
    const db = mockDB([{
      id: "wfe_1", workflow_id: "wf_1", project_id: "p1", status: "waiting",
      trigger_data: "{}", context: "{}", started_at: new Date().toISOString(),
      completed_at: null, duration_ms: null, error: null, retry_count: 0, created_at: "t",
    }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { stopExecution } = await import("../lib/workflow-automation.js");
    const out = await stopExecution(env, { executionId: "wfe_1", projectId: "p1" });
    expect(out.status).toBe("cancelled");
  });

  it("matches webhook path and method", async () => {
    const { matchWebhookTrigger } = await import("../lib/workflow-automation.js");
    const wf = {
      status: "active",
      triggerType: "webhook",
      triggerConfig: { path: "hookpath1", method: "POST" },
    };
    expect(matchWebhookTrigger(wf, "hookpath1", "POST")).toBe(true);
    expect(matchWebhookTrigger(wf, "hookpath1", "GET")).toBe(false);
  });

  it("pauses on wait_webhook and resumes with token", async () => {
    const row = {
      id: "wf_1", project_id: "p1", name: "Wait", description: null, status: "active",
      trigger_type: "webhook", trigger_config: null,
      actions: JSON.stringify([{ type: "wait_webhook" }, { type: "send_message" }]),
      conditions: null, error_handling: "stop", max_retries: 3, timeout_seconds: 30,
      run_count: 0, last_run_at: null, last_error: null, created_by: null,
      created_at: "t", updated_at: "t", started_at: new Date().toISOString(),
    };
    const db = mockDB([row]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { startExecution, resumeWaitingExecution } = await import("../lib/workflow-automation.js");
    const started = await startExecution(env, { workflowId: "wf_1", projectId: "p1" });
    expect(started.waiting).toBe(true);
    expect(started.waitToken).toMatch(/^wt_/);
    db.first.mockResolvedValueOnce({
      id: started.id, workflow_id: "wf_1", project_id: "p1", status: "waiting",
      trigger_data: "{}", context: JSON.stringify({ waitToken: started.waitToken, remainingActions: [{ type: "send_message" }] }),
      started_at: row.started_at, completed_at: null, duration_ms: null, error: null, retry_count: 0, created_at: "t",
    });
    const resumed = await resumeWaitingExecution(env, { executionId: started.id, token: started.waitToken });
    expect(resumed.ok).toBe(true);
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
