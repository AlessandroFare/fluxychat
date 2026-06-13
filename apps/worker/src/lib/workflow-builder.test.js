import { describe, it, expect } from "vitest";
import {
  createWorkflow, updateWorkflow, getWorkflow, listWorkflows, deleteWorkflow,
  executeWorkflow, getWorkflowRuns,
  createTemplate, listTemplates, applyTemplate, getWorkflowStats,
} from "./workflow-builder.js";

function makeEnv() {
  const workflows = [];
  const runs = [];
  const templates = [];
  return {
    DB: {
      prepare: (sql) => ({
        bind: (...params) => ({
          first: async () => {
            if (sql.includes("workflow_definitions") && sql.includes("WHERE id")) {
              return workflows.find((w) => w.id === params[0] && w.project_id === params[1]) || null;
            }
            if (sql.includes("workflow_templates")) {
              return templates.find((t) => t.id === params[0] && (t.project_id === params[1] || t.is_system)) || null;
            }
            return null;
          },
          all: async () => {
            if (sql.includes("GROUP BY trigger_type")) {
              const groups = {};
              for (const w of workflows.filter((w) => w.project_id === params[0])) {
                if (!groups[w.trigger_type]) groups[w.trigger_type] = { trigger_type: w.trigger_type, count: 0, runs: 0 };
                groups[w.trigger_type].count++;
                groups[w.trigger_type].runs += w.run_count;
              }
              return { results: Object.values(groups) };
            }
            if (sql.includes("GROUP BY status")) {
              const groups = {};
              for (const r of runs.filter((r) => r.project_id === params[0])) {
                if (!groups[r.status]) groups[r.status] = { status: r.status, count: 0, avg_duration: 0, total: 0 };
                groups[r.status].count++;
                groups[r.status].total += r.duration_ms || 0;
              }
              return { results: Object.values(groups).map((g) => ({ ...g, avg_duration: g.total / g.count })) };
            }
            if (sql.includes("workflow_runs")) return { results: runs.filter((r) => r.project_id === params[0]) };
            if (sql.includes("workflow_definitions")) return { results: workflows.filter((w) => w.project_id === params[0]) };
            if (sql.includes("workflow_templates")) return { results: templates.filter((t) => t.project_id === params[0] || t.is_system) };
            return { results: [] };
          },
          run: async () => {
            if (sql.includes("INSERT INTO workflow_definitions")) {
              workflows.push({ id: params[0], project_id: params[1], name: params[2], description: params[3], trigger_type: params[4], trigger_config: params[5], steps: params[6], enabled: 1, run_count: 0, last_run_at: null, created_at: params[7], updated_at: params[8] });
            } else if (sql.includes("INSERT INTO workflow_runs")) {
              runs.push({ id: params[0], workflow_id: params[1], project_id: params[2], status: params[3], trigger_data: params[4], started_at: params[5], result: null, error: null, completed_at: null, duration_ms: null });
            } else if (sql.includes("INSERT INTO workflow_templates")) {
              templates.push({ id: params[0], project_id: params[1], name: params[2], description: params[3], category: params[4], trigger_type: params[5], trigger_config: params[6], steps: params[7], use_count: 0, is_system: params[8], created_at: params[9] });
            } else if (sql.includes("DELETE FROM workflow_definitions")) {
              const before = workflows.length;
              for (let i = workflows.length - 1; i >= 0; i--) { if (workflows[i].id === params[0] && workflows[i].project_id === params[1]) workflows.splice(i, 1); }
              return { meta: { changes: before - workflows.length } };
            } else if (sql.includes("UPDATE workflow_runs") && sql.includes("completed")) {
              const r = runs.find((r) => r.id === params[params.length - 1]);
              if (r) { r.status = params[0] !== "'running'" ? "completed" : r.status; r.completed_at = params[2]; r.duration_ms = params[3]; }
            } else if (sql.includes("UPDATE workflow_runs") && sql.includes("failed")) {
              const r = runs.find((r) => r.id === params[params.length - 1]);
              if (r) { r.status = "failed"; r.error = params[2]; }
            } else if (sql.includes("UPDATE workflow_definitions") && sql.includes("run_count")) {
              const w = workflows.find((w) => w.id === params[params.length - 1]);
              if (w) { w.run_count++; w.last_run_at = params[0]; }
            } else if (sql.includes("UPDATE workflow_definitions")) {
              const idx = workflows.findIndex((w) => w.id === params[params.length - 2] && w.project_id === params[params.length - 1]);
              if (idx >= 0 && sql.includes("enabled = ?")) workflows[idx].enabled = params[0] || params[1];
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            } else if (sql.includes("UPDATE workflow_templates")) {
              const t = templates.find((t) => t.id === params[params.length - 1]);
              if (t) t.use_count++;
            }
            return { meta: { changes: 1 } };
          },
        }),
      }),
    },
    _workflows: workflows,
    _runs: runs,
  };
}

describe("workflow-builder", () => {
  describe("createWorkflow", () => {
    it("creates a workflow", async () => {
      const env = makeEnv();
      const result = await createWorkflow(env, { projectId: "p1", name: "Auto Reply", triggerType: "message", steps: [{ action: "send_message", message: "Hello!" }] });
      expect(result.created).toBe(true);
    });

    it("requires name and triggerType", async () => {
      const env = makeEnv();
      const result = await createWorkflow(env, { projectId: "p1" });
      expect(result.error).toContain("required");
    });

    it("validates triggerType", async () => {
      const env = makeEnv();
      const result = await createWorkflow(env, { projectId: "p1", name: "x", triggerType: "invalid" });
      expect(result.error).toContain("triggerType");
    });
  });

  describe("executeWorkflow", () => {
    it("executes a workflow with steps", async () => {
      const env = makeEnv();
      const { id } = await createWorkflow(env, {
        projectId: "p1", name: "Test", triggerType: "message",
        steps: [{ action: "send_message", message: "Hi" }, { action: "add_reaction", emoji: "👍" }],
      });
      const result = await executeWorkflow(env, { workflowId: id, projectId: "p1", triggerData: { text: "hello" } });
      expect(result.status).toBe("completed");
      expect(result.results.length).toBe(2);
    });

    it("returns error for non-existent workflow", async () => {
      const env = makeEnv();
      const result = await executeWorkflow(env, { workflowId: "wf_none", projectId: "p1" });
      expect(result.error).toContain("not_found");
    });

    it("rejects disabled workflow", async () => {
      const env = makeEnv();
      const { id } = await createWorkflow(env, { projectId: "p1", name: "X", triggerType: "message" });
      await updateWorkflow(env, { id, projectId: "p1", enabled: false });
      const result = await executeWorkflow(env, { workflowId: id, projectId: "p1" });
      expect(result.error).toContain("disabled");
    });
  });

  describe("templates", () => {
    it("creates and applies a template", async () => {
      const env = makeEnv();
      const tpl = await createTemplate(env, { projectId: "p1", name: "Auto Reply", triggerType: "message", steps: [{ action: "send_message", message: "Thanks!" }] });
      expect(tpl.created).toBe(true);
      const result = await applyTemplate(env, { templateId: tpl.id, projectId: "p1" });
      expect(result.created).toBe(true);
    });
  });

  describe("getWorkflowStats", () => {
    it("returns stats", async () => {
      const env = makeEnv();
      await createWorkflow(env, { projectId: "p1", name: "A", triggerType: "message" });
      await createWorkflow(env, { projectId: "p1", name: "B", triggerType: "join" });
      const stats = await getWorkflowStats(env, { projectId: "p1" });
      expect(stats.totalWorkflows).toBe(2);
    });
  });
});
