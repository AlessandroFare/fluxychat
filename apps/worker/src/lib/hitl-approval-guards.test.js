import { describe, expect, it } from "vitest";
import { createApprovalStore, createApprovalGate } from "./hitl-approval.js";
import { createD1ApprovalStore } from "./hitl-approval-d1.js";

function pendingRow(overrides = {}) {
  // Relative timestamps: a fixed expiry would make this fixture start failing
  // the moment the wall clock passes it.
  const startedAt = new Date(Date.now() - 60_000).toISOString();
  const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
  return {
    id: "apr_1",
    project_id: "p1",
    room_id: "r1",
    tool_call_id: "tc_1",
    tool_name: "refund_order",
    tool_input_json: "{}",
    run_id: "run_1",
    agent_id: "bot_1",
    requester_user_id: "u1",
    status: "pending",
    approval_chain_snapshot_json: JSON.stringify({ steps: [{ approverId: "u1" }] }),
    current_step_index: 0,
    current_approver_id: "u1",
    started_at: startedAt,
    expires_at: expiresAt,
    created_at: startedAt,
    decided_at: null,
    decided_by: null,
    decision_note: null,
    ...overrides,
  };
}

function d1Env(rowInput, envOverrides = {}) {
  const row = { ...rowInput };
  return {
    ...envOverrides,
    DB: {
      prepare(sql) {
        const text = String(sql);
        return {
          bind(...args) {
            return {
              async first() {
                if (text.includes("FROM hitl_approval_requests")) return row;
                return null;
              },
              async run() {
                if (text.includes("UPDATE hitl_approval_requests")) row.status = args[0];
                return { meta: { changes: 1 } };
              },
              async all() {
                return { results: [] };
              },
            };
          },
        };
      },
    },
  };
}

describe("HITL four-eyes default (audit F-41/F-42)", () => {
  it("refuses a requester decision without an explicit opt-in", async () => {
    const store = createD1ApprovalStore(d1Env(pendingRow()));
    await expect(store.approve("apr_1", "u1")).rejects.toThrow("requester_cannot_approve");
  });

  it("allows the requester when HITL_ALLOW_SELF_APPROVAL is set", async () => {
    const store = createD1ApprovalStore(d1Env(pendingRow(), { HITL_ALLOW_SELF_APPROVAL: "true" }));
    const updated = await store.approve("apr_1", "u1");
    expect(updated.status).toBe("approved");
  });

  it("never lets an agent id decide", async () => {
    const store = createD1ApprovalStore(
      d1Env(pendingRow({ current_approver_id: "agent:bot_1" })),
    );
    await expect(store.deny("apr_1", "agent:bot_1")).rejects.toThrow("agent_cannot_approve");
  });

  it("lets a different approver decide", async () => {
    const store = createD1ApprovalStore(d1Env(pendingRow({ current_approver_id: "u2" })));
    const updated = await store.approve("apr_1", "u2");
    expect(updated.status).toBe("approved");
  });
});

describe("approval gate default-deny (audit F-41)", () => {
  it("requires approval for side-effect tool names by default", async () => {
    const gate = createApprovalGate({});
    expect(await gate.needsApproval("delete_message", {}, {})).toBe(true);
    expect(await gate.needsApproval("send_email", {}, {})).toBe(true);
    expect(await gate.needsApproval("post_comment", {}, {})).toBe(true);
  });

  it("leaves read-only tools ungated", async () => {
    const gate = createApprovalGate({});
    expect(await gate.needsApproval("get_weather", {}, {})).toBe(false);
    expect(await gate.needsApproval("search_messages", {}, {})).toBe(false);
    expect(await gate.needsApproval("list_rooms", {}, {})).toBe(false);
  });

  it("honours neverRequire and custom gates", async () => {
    const gate = createApprovalGate({
      neverRequire: ["send_digest"],
      gates: { delete_note: { needsApproval: async () => false } },
    });
    expect(await gate.needsApproval("send_digest", {}, {})).toBe(false);
    expect(await gate.needsApproval("delete_note", {}, {})).toBe(false);
    expect(await gate.needsApproval("delete_other", {}, {})).toBe(true);
  });
});

describe("KV HITL store four-eyes (audit F-41/F-42)", () => {
  function kvEnv() {
    const map = new Map();
    return {
      get: async (key, opts) => {
        const value = map.get(key);
        if (value == null) return null;
        return opts?.type === "json" ? JSON.parse(value) : value;
      },
      put: async (key, value) => {
        map.set(key, value);
      },
      list: async () => ({ keys: [] }),
    };
  }

  it("refuses the requester and the agent, accepts another human", async () => {
    const store = createApprovalStore(kvEnv());
    const entry = await store.create({ userId: "u1", agentId: "bot_1", roomId: "r1" });
    await expect(store.approve(entry.id, "u1")).rejects.toThrow("requester_cannot_approve");
    await expect(store.approve(entry.id, "agent:bot_1")).rejects.toThrow("agent_cannot_approve");
    const ok = await store.approve(entry.id, "u2");
    expect(ok.status).toBe("approved");
  });
});
