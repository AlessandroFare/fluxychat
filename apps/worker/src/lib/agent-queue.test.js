import { describe, expect, it } from "vitest";
import {
  canAccessAgentQueue,
  claimAgentTask,
  computeSlaDueAt,
  createAgentTask,
  listAgentTasks,
  mapAgentTaskRow,
  releaseAgentTask,
  resolveAgentQueueSlaMinutes,
  resolveAgentTask,
} from "./agent-queue.js";

describe("agent-queue", () => {
  it("canAccessAgentQueue allows operator roles", () => {
    expect(canAccessAgentQueue(["member"])).toBe(false);
    expect(canAccessAgentQueue(["moderator"])).toBe(true);
    expect(canAccessAgentQueue(["admin", "member"])).toBe(true);
  });

  it("resolveAgentQueueSlaMinutes clamps and reads env", () => {
    expect(resolveAgentQueueSlaMinutes({ AGENT_QUEUE_SLA_MINUTES: "30" })).toBe(30);
    expect(resolveAgentQueueSlaMinutes({}, 5)).toBe(5);
  });

  it("mapAgentTaskRow flags SLA breach", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const mapped = mapAgentTaskRow(
      {
        id: "t1",
        room_id: "room_1",
        status: "open",
        priority: 0,
        sla_due_at: past,
        trigger_source: "manual",
        created_at: past,
        updated_at: past,
      },
      new Date().toISOString(),
    );
    expect(mapped.slaBreached).toBe(true);
    expect(mapped.secondsToSla).toBeLessThan(0);
  });

  it("create → claim → resolve lifecycle", async () => {
    const env = createAgentQueueEnv();
    const created = await createAgentTask(env, {
      projectId: "proj_1",
      roomId: "room_1",
      createdByUserId: "admin_1",
      note: "Customer waiting",
    });
    expect(created.ok).toBe(true);
    expect(created.task.status).toBe("open");

    const duplicate = await createAgentTask(env, {
      projectId: "proj_1",
      roomId: "room_1",
    });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.error).toBe("room_already_queued");

    const claim = await claimAgentTask(env, {
      projectId: "proj_1",
      taskId: created.task.id,
      userId: "agent_1",
    });
    expect(claim.ok).toBe(true);

    const list = await listAgentTasks(env, {
      projectId: "proj_1",
      userId: "agent_1",
      assignee: "me",
    });
    expect(list.tasks).toHaveLength(1);
    expect(list.tasks[0].status).toBe("claimed");

    const resolved = await resolveAgentTask(env, {
      projectId: "proj_1",
      taskId: created.task.id,
      userId: "agent_1",
      status: "resolved",
      disposition: "answered",
    });
    expect(resolved.ok).toBe(true);

    const active = await listAgentTasks(env, {
      projectId: "proj_1",
      userId: "agent_1",
    });
    expect(active.tasks).toHaveLength(0);
  });

  it("resolve requires a valid disposition code", async () => {
    const env = createAgentQueueEnv();
    const created = await createAgentTask(env, {
      projectId: "proj_1",
      roomId: "room_9",
    });
    const bad = await resolveAgentTask(env, {
      projectId: "proj_1",
      taskId: created.task.id,
      userId: "agent_1",
      status: "resolved",
      disposition: "not_a_code",
    });
    expect(bad.ok).toBe(false);
    expect(bad.error).toBe("invalid_disposition");
  });

  it("release returns task to open queue", async () => {
    const env = createAgentQueueEnv();
    const created = await createAgentTask(env, {
      projectId: "proj_1",
      roomId: "room_2",
    });
    await claimAgentTask(env, {
      projectId: "proj_1",
      taskId: created.task.id,
      userId: "agent_2",
    });
    const released = await releaseAgentTask(env, {
      projectId: "proj_1",
      taskId: created.task.id,
      userId: "agent_2",
      roles: ["moderator"],
    });
    expect(released.ok).toBe(true);
    const list = await listAgentTasks(env, { projectId: "proj_1", userId: "agent_2" });
    expect(list.tasks[0].status).toBe("open");
    expect(list.tasks[0].assigneeUserId).toBeNull();
  });
});

function createAgentQueueEnv() {
  const rooms = [{ id: "room_1", name: "Support", type: "group", project_id: "proj_1" }];
  const tasks = [];

  return {
    AGENT_QUEUE_SLA_MINUTES: "15",
    DB: {
      prepare(sql) {
        return {
          bind(...binds) {
            return {
              first: async () => {
                if (sql.includes("FROM rooms")) {
                  const id = binds[1];
                  return rooms.find((r) => r.id === id) || null;
                }
                if (sql.includes("FROM agent_tasks WHERE id")) {
                  const id = binds[0];
                  return tasks.find((t) => t.id === id) || null;
                }
                return null;
              },
              all: async () => {
                if (sql.includes("FROM agent_tasks t")) {
                  const projectId = binds[0];
                  let filtered = tasks.filter((t) => t.project_id === projectId);
                  if (sql.includes("status IN ('open', 'claimed')")) {
                    filtered = filtered.filter((t) =>
                      ["open", "claimed"].includes(t.status),
                    );
                  }
                  if (sql.includes("assignee_user_id = ?")) {
                    const userId = binds[binds.length - 2];
                    filtered = filtered.filter((t) => t.assignee_user_id === userId);
                  }
                  return {
                    results: filtered.map((t) => {
                      const room = rooms.find((r) => r.id === t.room_id);
                      return {
                        ...t,
                        room_name: room?.name ?? t.room_id,
                        room_type: room?.type ?? null,
                      };
                    }),
                  };
                }
                if (sql.includes("FROM rooms WHERE project_id")) {
                  return { results: rooms };
                }
                return { results: [] };
              },
              run: async () => {
                if (sql.includes("INSERT INTO agent_tasks")) {
                  const [
                    id,
                    project_id,
                    room_id,
                    ,
                    priority,
                    ,
                    ,
                    sla_due_at,
                    ,
                    ,
                    note,
                    trigger_source,
                    created_by_user_id,
                    created_at,
                    updated_at,
                  ] = binds;
                  const active = tasks.find(
                    (t) =>
                      t.project_id === project_id &&
                      t.room_id === room_id &&
                      ["open", "claimed"].includes(t.status),
                  );
                  if (active) {
                    const err = new Error("UNIQUE constraint failed");
                    throw err;
                  }
                  tasks.push({
                    id,
                    project_id,
                    room_id,
                    status: "open",
                    priority,
                    assignee_user_id: null,
                    claimed_at: null,
                    sla_due_at,
                    resolved_at: null,
                    disposition: null,
                    note,
                    trigger_source,
                    created_by_user_id,
                    created_at,
                    updated_at,
                  });
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("SET status = 'claimed'")) {
                  const [userId, claimedAt, updatedAt, taskId, projectId] = binds;
                  const task = tasks.find(
                    (t) => t.id === taskId && t.project_id === projectId,
                  );
                  if (!task || task.status !== "open") return { meta: { changes: 0 } };
                  task.status = "claimed";
                  task.assignee_user_id = userId;
                  task.claimed_at = claimedAt;
                  task.updated_at = updatedAt;
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("SET status = 'open', assignee_user_id = NULL")) {
                  const [updatedAt, taskId, projectId] = binds;
                  const task = tasks.find(
                    (t) => t.id === taskId && t.project_id === projectId,
                  );
                  if (!task || task.status !== "claimed") return { meta: { changes: 0 } };
                  task.status = "open";
                  task.assignee_user_id = null;
                  task.claimed_at = null;
                  task.updated_at = updatedAt;
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("SET status = ?, resolved_at")) {
                  const [status, resolvedAt, disposition, updatedAt, taskId, projectId] =
                    binds;
                  const task = tasks.find(
                    (t) => t.id === taskId && t.project_id === projectId,
                  );
                  if (!task || !["open", "claimed"].includes(task.status)) {
                    return { meta: { changes: 0 } };
                  }
                  task.status = status;
                  task.resolved_at = resolvedAt;
                  task.disposition = disposition;
                  task.updated_at = updatedAt;
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              },
            };
          },
        };
      },
    },
  };
}
