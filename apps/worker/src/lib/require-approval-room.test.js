import { describe, expect, it, vi } from "vitest";

vi.mock("./hitl-approval-d1.js", () => ({
  createD1ApprovalStore: () => ({
    create: async () => ({ id: "apr_test" }),
  }),
}));

import { requireApprovalRoom } from "./require-approval-room.js";

describe("requireApprovalRoom", () => {
  it("inserts a group room then returns the HITL id", async () => {
    const runs = [];
    const env = {
      DB: {
        prepare(sql) {
          return {
            bind: (...args) => ({
              run: async () => {
                runs.push({ sql, args });
                return { meta: { changes: 1 } };
              },
            }),
          };
        },
        batch: async (list) => {
          runs.push({ sql: "batch", n: list.length });
        },
      },
    };
    const result = await requireApprovalRoom(env, {
      projectId: "p1",
      requesterUserId: "u1",
      toolName: "deleteFile",
      toolInput: { path: "/tmp" },
      approverIds: ["u2"],
    });
    expect(result.ok).toBe(true);
    expect(result.approvalId).toBe("apr_test");
    expect(result.roomId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(runs.some((r) => String(r.sql).includes("INSERT INTO rooms"))).toBe(true);
    expect(runs.some((r) => r.sql === "batch" && r.n === 2)).toBe(true);
  });

  it("never adds the requester as their own approver (audit F-26)", async () => {
    const members = [];
    const env = {
      DB: {
        prepare(sql) {
          return {
            bind: (...args) => ({
              run: async () => {
                if (String(sql).includes("INSERT INTO room_members")) members.push(args[1]);
                return { meta: { changes: 1 } };
              },
            }),
          };
        },
        batch: async (list) => {
          for (const stmt of list) await stmt.run();
        },
      },
    };
    const result = await requireApprovalRoom(env, {
      projectId: "p1",
      requesterUserId: "u1",
      toolName: "deleteFile",
      approverIds: ["u1", "u2"],
    });
    expect(result.ok).toBe(true);
    expect(members).toEqual(["u1", "u2"]);
  });
});
