import { describe, expect, it, vi } from "vitest";
import { processHitlApprovalExpiry, tickHitlApprovalEscalations } from "./hitl-approval-tick.js";

vi.mock("./room-shard.js", () => ({
  fanoutRoomInternal: vi.fn(async () => {}),
}));

vi.mock("./room-timeline-events.js", () => ({
  appendRoomTimelineEvent: vi.fn(async () => ({})),
}));

function makeEnv(rows, updates = []) {
  return {
    DB: {
      prepare(sql) {
        return {
          bind(...binds) {
            return {
              async all() {
                if (sql.includes("expires_at <")) {
                  const now = binds[0];
                  const pending = rows.filter(
                    (r) =>
                      r.status === "pending" &&
                      r.expires_at &&
                      r.expires_at < now,
                  );
                  return { results: pending.slice(0, binds[binds.length - 1]) };
                }
                return { results: [] };
              },
              async run() {
                updates.push({ sql, binds });
                if (sql.includes("SET status = 'expired'")) {
                  const id = binds[1];
                  const row = rows.find((r) => r.id === id);
                  if (row) row.status = "expired";
                }
                if (sql.includes("current_step_index = ?")) {
                  const stepIndex = binds[0];
                  const id = binds[binds.length - 1];
                  const row = rows.find((r) => r.id === id);
                  if (row) {
                    row.current_step_index = stepIndex;
                    if (sql.includes("current_approver_id = NULL")) {
                      row.current_approver_id = null;
                      row.expires_at = null;
                    } else if (sql.includes("current_approver_id = ?")) {
                      row.current_approver_id = binds[1];
                      row.expires_at = binds[2];
                    }
                  }
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

describe("hitl-approval-tick", () => {
  it("escalates to next approver on step timeout", async () => {
    const rows = [
      {
        id: "req-1",
        project_id: "p1",
        room_id: "r1",
        tool_name: "delete_user",
        status: "pending",
        current_step_index: 0,
        current_approver_id: "user_a",
        expires_at: "2020-01-01T00:00:00.000Z",
        approval_chain_snapshot_json: JSON.stringify({
          defaultTimeoutSeconds: 180,
          steps: [{ approverId: "user_a" }, { approverId: "user_b" }],
        }),
      },
    ];
    const updates = [];
    const env = makeEnv(rows, updates);

    const result = await processHitlApprovalExpiry(env, rows[0]);
    expect(result.action).toBe("escalated");
    expect(result.approverId).toBe("user_b");
    expect(rows[0].current_step_index).toBe(1);
  });

  it("fires notify_channel fallback", async () => {
    const { fanoutRoomInternal } = await import("./room-shard.js");
    const rows = [
      {
        id: "req-2",
        project_id: "p1",
        room_id: "r1",
        tool_name: "refund",
        status: "pending",
        current_step_index: 0,
        current_approver_id: "user_a",
        expires_at: "2020-01-01T00:00:00.000Z",
        approval_chain_snapshot_json: JSON.stringify({
          steps: [{ approverId: "user_a" }, { fallback: "notify_channel" }],
        }),
      },
    ];
    const env = makeEnv(rows, []);

    const result = await processHitlApprovalExpiry(env, rows[0]);
    expect(result.action).toBe("notify_channel");
    expect(fanoutRoomInternal).toHaveBeenCalled();
    expect(rows[0].current_step_index).toBe(1);
  });

  it("expires when chain is exhausted", async () => {
    const rows = [
      {
        id: "req-3",
        project_id: "p1",
        room_id: "r1",
        tool_name: "purge",
        status: "pending",
        current_step_index: 0,
        current_approver_id: "user_a",
        expires_at: "2020-01-01T00:00:00.000Z",
        approval_chain_snapshot_json: JSON.stringify({
          steps: [{ approverId: "user_a" }],
        }),
      },
    ];
    const env = makeEnv(rows, []);

    const result = await processHitlApprovalExpiry(env, rows[0]);
    expect(result.action).toBe("expired");
    expect(rows[0].status).toBe("expired");
  });

  it("tick processes due pending rows", async () => {
    const rows = [
      {
        id: "req-4",
        project_id: "p1",
        room_id: "r1",
        tool_name: "x",
        status: "pending",
        current_step_index: 0,
        current_approver_id: "a",
        expires_at: "2020-01-01T00:00:00.000Z",
        approval_chain_snapshot_json: JSON.stringify({
          steps: [{ approverId: "a" }, { approverId: "b" }],
        }),
      },
    ];
    const env = makeEnv(rows, []);
    const tick = await tickHitlApprovalEscalations(env);
    expect(tick.processed).toBe(1);
    expect(tick.results[0].action).toBe("escalated");
  });
});
