import { describe, it, expect } from "vitest";
import {
  createAgentEvalDataset,
  runAgentEvalDataset,
  scoreEvalCaseAgainstRun,
  captureFailedAgentRunAsEvalCase,
  maybeAutoCaptureFailedAgentRun,
} from "./agent-eval.js";

function createEnv() {
  const datasets = new Map();
  const evalRuns = [];
  const agentRuns = [
    {
      id: "run-1",
      agent_id: "bot-1",
      room_id: "lobby",
      status: "completed",
      latency_ms: 1200,
      error: null,
      tool_calls_json: null,
      created_at: "2026-08-01T00:00:00Z",
    },
    {
      id: "run-fail-1",
      agent_id: "bot-1",
      room_id: "lobby",
      status: "failed",
      latency_ms: 8000,
      error: "tool_timeout",
      tool_calls_json: JSON.stringify([{ name: "web_search" }]),
      created_at: "2026-08-02T00:00:00Z",
    },
  ];

  return {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("FROM agent_runs") && sql.includes("AND id = ?")) {
                  return agentRuns.find((r) => r.id === args[1]) ?? null;
                }
                if (sql.includes("FROM agent_eval_datasets") && sql.includes("AND name = ?")) {
                  for (const row of datasets.values()) {
                    if (row.project_id === args[0] && row.name === args[1]) return row;
                  }
                  return null;
                }
                if (sql.includes("FROM agent_eval_datasets") && sql.includes("AND id")) {
                  return datasets.get(args[1]) ?? null;
                }
                return null;
              },
              async all() {
                if (sql.includes("FROM agent_runs")) return { results: agentRuns };
                if (sql.includes("FROM agent_eval_datasets") && !sql.includes("AND id")) {
                  return { results: [...datasets.values()] };
                }
                return { results: [] };
              },
              async run() {
                if (sql.includes("INSERT INTO agent_eval_datasets")) {
                  datasets.set(args[0], {
                    id: args[0],
                    project_id: args[1],
                    name: args[2],
                    description: args[3],
                    cases_json: args[4],
                    created_at: args[5],
                    updated_at: args[6],
                  });
                }
                if (sql.includes("UPDATE agent_eval_datasets")) {
                  const row = datasets.get(args[3]);
                  if (row) {
                    row.cases_json = args[0];
                    row.updated_at = args[1];
                  }
                }
                if (sql.includes("INSERT INTO agent_eval_runs")) {
                  evalRuns.push({ id: args[0], status: args[3] });
                }
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
  };
}

describe("agent-eval", () => {
  it("creates dataset with cases", async () => {
    const env = createEnv();
    const result = await createAgentEvalDataset(env, {
      projectId: "p1",
      name: "Smoke",
      cases: [{ tag: "happy", expectedStatus: "completed", maxLatencyMs: 5000 }],
    });
    expect(result.ok).toBe(true);
    expect(result.dataset.cases).toHaveLength(1);
  });

  it("runs eval against agent runs", async () => {
    const env = createEnv();
    const created = await createAgentEvalDataset(env, {
      projectId: "p1",
      name: "Smoke",
      cases: [{ tag: "happy", expectedStatus: "completed", maxLatencyMs: 5000, agentId: "bot-1" }],
    });
    const result = await runAgentEvalDataset(env, {
      projectId: "p1",
      datasetId: created.dataset.id,
    });
    expect(result.ok).toBe(true);
    expect(result.passCount).toBe(1);
  });

  it("scoreEvalCaseAgainstRun checks required tools", () => {
    const result = scoreEvalCaseAgainstRun(
      {
        id: "run-1",
        status: "completed",
        latency_ms: 500,
        error: null,
        tool_calls_json: JSON.stringify([{ name: "web_search" }]),
      },
      { tag: "tools", expectedStatus: "completed", requiredTools: ["web_search"] },
    );
    expect(result.passed).toBe(true);

    const fail = scoreEvalCaseAgainstRun(
      {
        id: "run-1",
        status: "completed",
        latency_ms: 500,
        error: null,
        tool_calls_json: "[]",
      },
      { tag: "tools", requiredTools: ["web_search"] },
    );
    expect(fail.passed).toBe(false);
    expect(fail.reason).toContain("missing_tool");
  });

  it("scoreEvalCaseAgainstRun checks expected output snippet", () => {
    const pass = scoreEvalCaseAgainstRun(
      { id: "run-1", status: "completed", latency_ms: 500, error: null },
      { tag: "output", expectedOutputContains: "refund" },
      "Agent replied: refund approved for order 42",
    );
    expect(pass.passed).toBe(true);

    const fail = scoreEvalCaseAgainstRun(
      { id: "run-1", status: "completed", latency_ms: 500, error: null },
      { tag: "output", expectedOutputContains: "refund" },
      "no match here",
    );
    expect(fail.passed).toBe(false);
    expect(fail.reason).toBe("output_missing_expected");
  });

  it("captureFailedAgentRunAsEvalCase appends to prod failures dataset", async () => {
    const env = createEnv();
    const result = await captureFailedAgentRunAsEvalCase(env, {
      projectId: "p1",
      runId: "run-fail-1",
    });
    expect(result.ok).toBe(true);
    expect(result.evalCase.sourceRunId).toBe("run-fail-1");
    expect(result.evalCase.requiredTools).toContain("web_search");
    expect(result.caseCount).toBe(1);

    const dup = await captureFailedAgentRunAsEvalCase(env, {
      projectId: "p1",
      runId: "run-fail-1",
    });
    expect(dup.duplicate).toBe(true);
  });

  it("captureFailedAgentRunAsEvalCase rejects non-failed runs", async () => {
    const env = createEnv();
    const result = await captureFailedAgentRunAsEvalCase(env, {
      projectId: "p1",
      runId: "run-1",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("run_not_failed");
  });

  it("maybeAutoCaptureFailedAgentRun respects env flag", async () => {
    const env = createEnv();
    const off = await maybeAutoCaptureFailedAgentRun(env, { projectId: "p1", runId: "run-fail-1" });
    expect(off.skipped).toBe(true);

    env.AGENT_EVAL_AUTO_CAPTURE_FAILED = "true";
    const on = await maybeAutoCaptureFailedAgentRun(env, { projectId: "p1", runId: "run-fail-1" });
    expect(on.ok).toBe(true);
  });
});
