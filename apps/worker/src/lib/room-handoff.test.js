import { describe, expect, it, vi } from "vitest";
import {
  getRoomHandoffState,
  isHumanHandoffActive,
  requestHumanHandoff,
  resolveRoomHandoff,
} from "./room-handoff.js";

vi.mock("./room-shard.js", () => ({
  fanoutRoomInternal: vi.fn(async () => {}),
}));

describe("room-handoff", () => {
  it("isHumanHandoffActive is false when no row", async () => {
    const env = createHandoffEnv();
    expect(await isHumanHandoffActive(env, "proj_1", "room_1")).toBe(false);
    expect((await getRoomHandoffState(env, "proj_1", "room_1")).status).toBe("ai_active");
  });

  it("requestHumanHandoff creates active handoff and task", async () => {
    const env = createHandoffEnv();
    const result = await requestHumanHandoff(env, {
      projectId: "proj_1",
      roomId: "room_1",
      userId: "agent_1",
      roles: ["moderator"],
      agentId: "bot_1",
    });
    expect(result.ok).toBe(true);
    expect(result.handoff.active).toBe(true);
    expect(await isHumanHandoffActive(env, "proj_1", "room_1")).toBe(true);
  });

  it("resolveRoomHandoff requires disposition", async () => {
    const env = createHandoffEnv();
    await requestHumanHandoff(env, {
      projectId: "proj_1",
      roomId: "room_1",
      userId: "agent_1",
      roles: ["admin"],
    });
    const bad = await resolveRoomHandoff(env, {
      projectId: "proj_1",
      roomId: "room_1",
      userId: "agent_1",
      roles: ["admin"],
    });
    expect(bad.ok).toBe(false);
    const good = await resolveRoomHandoff(env, {
      projectId: "proj_1",
      roomId: "room_1",
      userId: "agent_1",
      roles: ["admin"],
      disposition: "resolved",
    });
    expect(good.ok).toBe(true);
    expect(await isHumanHandoffActive(env, "proj_1", "room_1")).toBe(false);
  });
});

function createHandoffEnv() {
  const messages = [
    { user_id: "user_1", content: "Help me", created_at: "2026-01-01T10:00:00.000Z" },
    { user_id: "bot_1", content: "Sure", created_at: "2026-01-01T10:01:00.000Z" },
  ];
  const handoffs = [];
  const tasks = [];

  return {
    AGENT_QUEUE_SLA_MINUTES: "15",
    ROOM: {
      idFromName: () => "do-id",
      get: () => ({ fetch: async () => new Response("ok") }),
    },
    DB: {
      prepare(sql) {
        return {
          bind(...binds) {
            return {
              first: async () => {
                if (sql.includes("FROM room_handoffs") && sql.includes("human_active")) {
                  const projectId = binds[0];
                  const roomId = binds[1];
                  const row = handoffs.find(
                    (h) =>
                      h.project_id === projectId &&
                      h.room_id === roomId &&
                      h.status === "human_active",
                  );
                  return row ? { ok: 1 } : null;
                }
                if (sql.includes("FROM room_handoffs") && sql.includes("ORDER BY")) {
                  const projectId = binds[0];
                  const roomId = binds[1];
                  const rows = handoffs.filter(
                    (h) => h.project_id === projectId && h.room_id === roomId,
                  );
                  return rows[rows.length - 1] || null;
                }
                if (sql.includes("FROM agent_tasks WHERE id")) {
                  return tasks.find((t) => t.id === binds[0]) || null;
                }
                return null;
              },
              all: async () => {
                if (sql.includes("FROM messages")) {
                  return { results: messages };
                }
                if (sql.includes("FROM agent_tasks t")) {
                  return { results: [] };
                }
                if (sql.includes("FROM rooms WHERE project_id")) {
                  return { results: [{ id: "room_1", name: "Support", type: "group" }] };
                }
                return { results: [] };
              },
              run: async () => {
                if (sql.includes("INSERT INTO room_handoffs")) {
                  handoffs.push({
                    id: binds[0],
                    project_id: binds[1],
                    room_id: binds[2],
                    agent_id: binds[3],
                    status: "human_active",
                    agent_task_id: binds[5],
                    handed_off_by_user_id: binds[6],
                    handed_off_at: binds[7],
                    context_summary: binds[8],
                  });
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("INSERT INTO agent_tasks")) {
                  tasks.push({
                    id: binds[0],
                    project_id: binds[1],
                    room_id: binds[2],
                    status: "open",
                  });
                  return { meta: { changes: 1, last_row_id: 1 } };
                }
                if (sql.includes("SET status = 'claimed'")) {
                  const task = tasks.find((t) => t.id === binds[3]);
                  if (task) task.status = "claimed";
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("UPDATE room_handoffs") && sql.includes("resolved")) {
                  const handoff = handoffs.find((h) => h.id === binds[3] || h.status === "human_active");
                  if (handoff) {
                    handoff.status = "resolved";
                    handoff.disposition = binds[0];
                  }
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("UPDATE agent_tasks") && sql.includes("resolved")) {
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
