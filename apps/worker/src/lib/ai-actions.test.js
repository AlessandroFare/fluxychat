import { describe, expect, it } from "vitest";
import {
  createAction,
  listActions,
  getAction,
  updateAction,
  deleteAction,
  executeAction,
  listExecutions,
} from "./ai-actions.js";

function createActionsEnv(overrides = {}) {
  const actions = [];
  const executions = [];

  return {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("SELECT") && sql.includes("FROM ai_actions") && sql.includes("WHERE id = ?")) {
                  return actions.find((a) => a.id === args[0] && a.project_id === args[1]) || null;
                }
                return null;
              },
              async all() {
                if (sql.includes("FROM ai_actions")) {
                  const pid = args[0];
                  return { results: actions.filter((a) => a.project_id === pid) };
                }
                if (sql.includes("FROM ai_action_executions")) {
                  const pid = args[0];
                  return { results: executions.filter((e) => e.project_id === pid) };
                }
                return { results: [] };
              },
              async run() {
                if (sql.includes("INSERT INTO ai_actions")) {
                  actions.push({
                    id: args[0],
                    project_id: args[1],
                    name: args[2],
                    description: args[3],
                    kind: args[4],
                    config: args[5],
                    enabled: args[6],
                    created_at: args[7],
                    updated_at: args[8],
                  });
                }
                if (sql.includes("UPDATE ai_actions")) {
                  // args: [name, description, kind, config, enabled, now, actionId, projectId]
                  const idx = actions.findIndex((a) => a.id === args[6] && a.project_id === args[7]);
                  if (idx >= 0) {
                    actions[idx].name = args[0];
                    actions[idx].description = args[1];
                    actions[idx].kind = args[2];
                    actions[idx].config = args[3];
                    actions[idx].enabled = args[4];
                    actions[idx].updated_at = args[5];
                  }
                }
                if (sql.includes("DELETE FROM ai_actions")) {
                  const idx = actions.findIndex((a) => a.id === args[0] && a.project_id === args[1]);
                  if (idx >= 0) actions.splice(idx, 1);
                }
                if (sql.includes("INSERT INTO ai_action_executions")) {
                  executions.push({
                    id: args[0],
                    project_id: args[1],
                    action_id: args[2],
                    room_id: args[3],
                    user_id: args[4],
                    input: args[5],
                    output: args[6],
                    status: args[7],
                    error: args[8],
                    created_at: args[9],
                  });
                }
                return { success: true };
              },
            };
          },
        };
      },
    },
    ...overrides,
  };
}

describe("createAction", () => {
  it("creates a webhook action", async () => {
    const env = createActionsEnv();
    const action = await createAction(env, {
      projectId: "proj_1",
      name: "notify-slack",
      description: "Send notification to Slack",
      kind: "webhook",
      config: { url: "https://hooks.slack.com/xxx" },
    });
    expect(action.id).toBeTruthy();
    expect(action.name).toBe("notify-slack");
    expect(action.kind).toBe("webhook");
    expect(action.enabled).toBe(true);
  });

  it("creates a ticket action", async () => {
    const env = createActionsEnv();
    const action = await createAction(env, {
      projectId: "proj_1",
      name: "create-ticket",
      kind: "ticket",
      config: {},
    });
    expect(action.kind).toBe("ticket");
  });
});

describe("listActions", () => {
  it("lists actions for a project", async () => {
    const env = createActionsEnv();
    await createAction(env, { projectId: "proj_1", name: "a1", kind: "webhook", config: {} });
    await createAction(env, { projectId: "proj_1", name: "a2", kind: "email", config: {} });
    const actions = await listActions(env, { projectId: "proj_1" });
    expect(actions).toHaveLength(2);
  });

  it("returns empty for unknown project", async () => {
    const env = createActionsEnv();
    const actions = await listActions(env, { projectId: "unknown" });
    expect(actions).toHaveLength(0);
  });
});

describe("getAction", () => {
  it("returns action by id", async () => {
    const env = createActionsEnv();
    const created = await createAction(env, { projectId: "proj_1", name: "test", kind: "webhook", config: {} });
    const found = await getAction(env, { projectId: "proj_1", actionId: created.id });
    expect(found).toBeTruthy();
    expect(found.name).toBe("test");
  });

  it("returns null for unknown action", async () => {
    const env = createActionsEnv();
    const found = await getAction(env, { projectId: "proj_1", actionId: "nonexistent" });
    expect(found).toBeNull();
  });
});

describe("updateAction", () => {
  it("updates action fields", async () => {
    const env = createActionsEnv();
    const created = await createAction(env, { projectId: "proj_1", name: "old", kind: "webhook", config: {} });
    const updated = await updateAction(env, {
      projectId: "proj_1",
      actionId: created.id,
      name: "new",
      enabled: false,
    });
    expect(updated.name).toBe("new");
    expect(updated.enabled).toBe(false);
  });

  it("returns null for unknown action", async () => {
    const env = createActionsEnv();
    const result = await updateAction(env, { projectId: "proj_1", actionId: "x", name: "y" });
    expect(result).toBeNull();
  });
});

describe("deleteAction", () => {
  it("deletes an action", async () => {
    const env = createActionsEnv();
    const created = await createAction(env, { projectId: "proj_1", name: "del", kind: "webhook", config: {} });
    const result = await deleteAction(env, { projectId: "proj_1", actionId: created.id });
    expect(result.ok).toBe(true);
    const found = await getAction(env, { projectId: "proj_1", actionId: created.id });
    expect(found).toBeNull();
  });
});

describe("executeAction", () => {
  it("returns error for unknown action", async () => {
    const env = createActionsEnv();
    const result = await executeAction(env, { projectId: "proj_1", actionId: "x", input: {} });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("action_not_found");
  });

  it("returns error for disabled action", async () => {
    const env = createActionsEnv();
    const created = await createAction(env, { projectId: "proj_1", name: "d", kind: "webhook", config: {} });
    await updateAction(env, { projectId: "proj_1", actionId: created.id, enabled: false });
    const result = await executeAction(env, { projectId: "proj_1", actionId: created.id, input: {} });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("action_disabled");
  });
});

describe("listExecutions", () => {
  it("returns empty when no executions", async () => {
    const env = createActionsEnv();
    const execs = await listExecutions(env, { projectId: "proj_1" });
    expect(execs).toHaveLength(0);
  });
});
