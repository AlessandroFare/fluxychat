import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildRehearsalAgentSystemPrompt,
  createRehearsalRoom,
  deleteRehearsalRoom,
  REHEARSAL_DISCLAIMER,
} from "./rehearsal-rooms.js";

function createMockEnv() {
  const rooms = [];
  const members = [];
  const messages = [];
  const rehearsals = [];

  const env = {
    DB: {
      prepare(sql) {
        return {
          bind: (...args) => ({
            first: async () => {
              if (sql.includes("FROM rooms WHERE project_id = ? AND id = ?")) {
                return rooms.find((r) => r.project_id === args[0] && r.id === args[1]) || null;
              }
              if (sql.includes("FROM bots WHERE")) {
                return args[1] === "agent-1" ? { id: "agent-1" } : null;
              }
              if (sql.includes("FROM rehearsal_rooms WHERE project_id = ? AND rehearsal_id = ?")) {
                return rehearsals.find(
                  (r) => r.project_id === args[0] && r.rehearsal_id === args[1],
                ) || null;
              }
              return null;
            },
            all: async () => {
              if (sql.includes("FROM messages") && sql.includes("source room snapshot")) {
                return {
                  results: [
                    { id: 1, user_id: "u1", content: "Hello", created_at: "2026-01-01T00:00:00Z", parent_id: null },
                  ],
                };
              }
              if (sql.includes("FROM messages") && sql.includes("ORDER BY created_at DESC")) {
                return {
                  results: [
                    { id: 1, user_id: "u1", content: "Hello", created_at: "2026-01-01T00:00:00Z", parent_id: null },
                  ],
                };
              }
              return { results: [] };
            },
            run: async () => ({ meta: { changes: 1 } }),
          }),
        };
      },
    },
  };

  env.DB.prepare = vi.fn((sql) => {
    const stmt = {
      bind: (...args) => ({
        first: async () => {
          if (sql.includes("FROM rooms WHERE project_id = ? AND id = ?")) {
            return rooms.find((r) => r.project_id === args[0] && r.id === args[1]) || null;
          }
          if (sql.includes("FROM bots WHERE")) {
            return args[1] === "agent-1" ? { id: "agent-1" } : null;
          }
          if (sql.includes("FROM rehearsal_rooms WHERE project_id = ? AND rehearsal_id = ?")) {
            return (
              rehearsals.find((r) => r.project_id === args[0] && r.rehearsal_id === args[1]) || null
            );
          }
          return null;
        },
        all: async () => {
          if (sql.includes("FROM messages") && sql.includes("deleted_at IS NULL")) {
            return {
              results: [
                {
                  id: 1,
                  user_id: "u1",
                  content: "Hello",
                  created_at: "2026-01-01T00:00:00Z",
                  parent_id: null,
                },
              ],
            };
          }
          return { results: [] };
        },
        run: async () => {
          if (sql.includes("INSERT INTO rooms")) {
            rooms.push({
              id: args[0],
              project_id: args[1],
              type: args[2],
              name: args[3],
              created_at: args[4],
            });
          }
          if (sql.includes("INSERT INTO room_members")) {
            members.push({
              room_id: args[0],
              project_id: args[1],
              user_id: args[2],
              role: args[3],
            });
          }
          if (sql.includes("INSERT INTO messages")) {
            messages.push({ room_id: args[1], content: args[3], kind: args[5] || "text" });
          }
          if (sql.includes("INSERT INTO rehearsal_rooms")) {
            rehearsals.push({
              rehearsal_id: args[0],
              project_id: args[1],
              source_room_id: args[2],
              rehearsal_room_id: args[3],
              owner_user_id: args[4],
              agent_id: args[5],
              snapshot_ts: args[6],
              stated_goal: args[7],
              counterparty_role: args[8],
              snapshot_message_count: args[9],
              ttl_seconds: args[10],
              expires_at: args[11],
              persist_after_session: args[12],
              status: args[13],
              created_at: args[14],
            });
          }
          if (sql.includes("UPDATE rehearsal_rooms SET status = 'expired'")) {
            const row = rehearsals.find(
              (r) => r.project_id === args[0] && r.rehearsal_id === args[1],
            );
            if (row) row.status = "expired";
          }
          if (sql.includes("DELETE FROM messages")) messages.length = 0;
          if (sql.includes("DELETE FROM room_members")) members.length = 0;
          if (sql.includes("DELETE FROM rooms")) {
            const idx = rooms.findIndex((r) => r.id === args[1]);
            if (idx >= 0) rooms.splice(idx, 1);
          }
          return { meta: { changes: 1 } };
        },
      }),
    };
    return stmt;
  });

  return { env, rooms, members, messages, rehearsals };
}

vi.mock("./room-access.js", () => ({
  canAccessRoom: vi.fn(async () => true),
}));

describe("rehearsal-rooms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds counterparty system prompt with disclaimer", () => {
    const prompt = buildRehearsalAgentSystemPrompt({
      counterpartyRole: "Skeptical buyer",
      statedGoal: "Close the enterprise deal",
    });
    expect(prompt).toContain(REHEARSAL_DISCLAIMER);
    expect(prompt).toContain("Skeptical buyer");
  });

  it("creates rehearsal room with snapshot messages", async () => {
    const { env, rooms, rehearsals } = createMockEnv();
    rooms.push({ id: "room-src", project_id: "p1", name: "Sales", type: "group" });

    const result = await createRehearsalRoom(
      env,
      { projectId: "p1", userId: "user-1", roles: ["member"] },
      {
        sourceRoomId: "room-src",
        statedGoal: "Negotiate pricing",
        counterpartyRole: "Procurement lead",
        agentId: "agent-1",
      },
    );

    expect(result.ok).toBe(true);
    expect(result.rehearsal?.rehearsalRoomId).toMatch(/^rehearsal_reh_/);
    expect(rehearsals).toHaveLength(1);
    expect(rehearsals[0].snapshot_message_count).toBe(1);
  });

  it("deletes rehearsal room and marks expired", async () => {
    const { env, rehearsals } = createMockEnv();
    rehearsals.push({
      rehearsal_id: "reh_abc",
      project_id: "p1",
      source_room_id: "room-src",
      rehearsal_room_id: "rehearsal_reh_abc",
      owner_user_id: "user-1",
      agent_id: null,
      snapshot_ts: "2026-01-01T00:00:00Z",
      stated_goal: null,
      counterparty_role: null,
      snapshot_message_count: 0,
      ttl_seconds: 3600,
      expires_at: "2026-01-01T01:00:00Z",
      persist_after_session: 0,
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
    });

    const result = await deleteRehearsalRoom(env, "p1", "reh_abc");
    expect(result.ok).toBe(true);
    expect(rehearsals[0].status).toBe("expired");
  });
});
