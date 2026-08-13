import { describe, expect, it, vi } from "vitest";
import {
  parseEscalationChain,
  pickNextOnlineInChain,
  startPresenceEscalation,
  resolvePresenceEscalation,
  markPresenceEscalationResponded,
  processPresenceEscalationWatch,
} from "./presence-escalation.js";

describe("presence-escalation", () => {
  it("parses escalation chain", () => {
    expect(parseEscalationChain(["alice", "bob"])).toEqual(["alice", "bob"]);
    expect(parseEscalationChain([])).toBe(null);
  });

  it("picks next online user in chain", () => {
    const online = new Set(["bob", "carol"]);
    const next = pickNextOnlineInChain(["alice", "bob", "carol"], online, 0, null);
    expect(next?.userId).toBe("bob");
  });

  it("starts and resolves escalation watch", async () => {
    const rows = [];
    const env = {
      DB: {
        prepare: vi.fn((sql) => ({
          bind: vi.fn((...args) => ({
            first: vi.fn(async () => {
              if (sql.includes("status = 'awaiting'")) {
                return rows.find((r) => r.status === "awaiting") || null;
              }
              return null;
            }),
            run: vi.fn(async () => {
              if (sql.includes("INSERT INTO room_presence_escalations")) {
                rows.push({
                  id: args[0],
                  project_id: args[1],
                  room_id: args[2],
                  status: "awaiting",
                  awaiting_user_id: args[4],
                  escalation_chain_json: args[5],
                  current_tier_index: 0,
                  nudge_interval_seconds: args[6],
                  awaiting_response_since: args[7],
                  last_nudge_at: null,
                  last_nudged_user_id: null,
                  resolved_at: null,
                  resolved_reason: null,
                  created_at: args[13],
                  updated_at: args[14],
                });
              }
              if (sql.includes("SET status = 'resolved'")) {
                const row = rows.find((r) => r.id === args[3]);
                if (row) {
                  row.status = "resolved";
                  row.resolved_at = args[0];
                  row.resolved_reason = args[1];
                }
              }
              return { meta: { changes: 1 } };
            }),
          })),
        })),
      },
    };

    const started = await startPresenceEscalation(env, {
      projectId: "p1",
      roomId: "room_1",
      escalationChain: ["alice", "bob"],
      nudgeIntervalSeconds: 120,
    });
    expect(started.ok).toBe(true);

    const resolved = await resolvePresenceEscalation(env, {
      projectId: "p1",
      roomId: "room_1",
      reason: "human_responded",
    });
    expect(resolved.ok).toBe(true);
  });

  it("marks responded when participant sends message", async () => {
    const row = {
      id: "w1",
      project_id: "p1",
      room_id: "room_1",
      status: "awaiting",
      awaiting_user_id: "alice",
      escalation_chain_json: JSON.stringify(["alice", "bob"]),
      current_tier_index: 0,
      nudge_interval_seconds: 300,
      awaiting_response_since: new Date().toISOString(),
      last_nudge_at: null,
      last_nudged_user_id: null,
      resolved_at: null,
      resolved_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const env = {
      DB: {
        prepare: vi.fn((sql) => ({
          bind: vi.fn(() => ({
            first: vi.fn(async () => (sql.includes("awaiting") ? row : null)),
            run: vi.fn(async () => {
              if (sql.includes("resolved")) row.status = "resolved";
              return { meta: { changes: 1 } };
            }),
          })),
        })),
      },
    };

    const result = await markPresenceEscalationResponded(env, {
      projectId: "p1",
      roomId: "room_1",
      responderUserId: "bob",
    });
    expect(result.ok).toBe(true);
  });

  it("skips nudge when interval not elapsed", async () => {
    const recent = new Date().toISOString();
    const row = {
      id: "w1",
      project_id: "p1",
      room_id: "room_1",
      status: "awaiting",
      awaiting_user_id: "alice",
      escalation_chain_json: JSON.stringify(["alice", "bob"]),
      current_tier_index: 0,
      nudge_interval_seconds: 300,
      awaiting_response_since: recent,
      last_nudge_at: null,
      last_nudged_user_id: null,
      resolved_at: null,
      resolved_reason: null,
      created_at: recent,
      updated_at: recent,
    };

    const env = { DB: { prepare: vi.fn() } };
    const result = await processPresenceEscalationWatch(env, row);
    expect(result.action).toBe("waiting");
  });
});
