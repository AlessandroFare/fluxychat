import { describe, expect, it, vi, beforeEach } from "vitest";
import { submitAutonomousTask, updateAutonomousTask } from "./agent-task-bus.js";

function mockDb() {
  const rows = new Map();
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              if (sql.includes("idempotency_key")) {
                const key = params[1];
                for (const row of rows.values()) {
                  if (row.idempotency_key === key) return row;
                }
                return null;
              }
              if (sql.includes("WHERE id = ?")) {
                return rows.get(params[0]) ?? null;
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO agent_autonomous_tasks")) {
                const row = {
                  id: params[0],
                  project_id: params[1],
                  room_id: params[2],
                  from_agent_id: params[3],
                  to_agent_id: params[4],
                  status: "submitted",
                  input: params[5],
                  idempotency_key: params[6],
                  task_offset: 0,
                  depth: params[7],
                  parent_task_id: params[8],
                  artifacts_json: "[]",
                  metadata_json: params[9],
                  resume_at: params[10],
                  created_at: params[11],
                  updated_at: params[12],
                  error: null,
                };
                rows.set(params[0], row);
              }
              if (sql.includes("UPDATE agent_autonomous_tasks")) {
                const row = rows.get(params[6]);
                if (row) {
                  row.status = params[0];
                  row.artifacts_json = params[1];
                  row.error = params[2];
                  row.task_offset = params[4];
                  row.updated_at = params[5];
                }
              }
            },
          };
        },
      };
    },
  };
}

describe("agent-task-bus", () => {
  it("dedupes by idempotency key", async () => {
    const env = { DB: mockDb() };
    const auth = { projectId: "proj1", userId: "alice" };
    const input = {
      roomId: "room1",
      fromAgentId: "agent-a",
      toAgentId: "agent-b",
      taskInput: "originate loan",
      idempotencyKey: "idem-1",
    };
    const first = await submitAutonomousTask(env, input, auth);
    const second = await submitAutonomousTask(env, input, auth);
    expect(first.ok).toBe(true);
    expect(second.deduplicated).toBe(true);
    expect(first.task.id).toBe(second.task.id);
  });

  it("updates task status and increments offset", async () => {
    const env = { DB: mockDb() };
    const auth = { projectId: "proj1", userId: "alice" };
    const created = await submitAutonomousTask(
      env,
      {
        roomId: "room1",
        fromAgentId: "a",
        toAgentId: "b",
        taskInput: "follow up",
        idempotencyKey: "idem-2",
      },
      auth,
    );
    const updated = await updateAutonomousTask(
      env,
      { taskId: created.task.id, status: "working" },
      auth,
    );
    expect(updated.ok).toBe(true);
    expect(updated.task.status).toBe("working");
    expect(updated.task.offset).toBe(1);
  });
});
