import { describe, expect, it } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchHitlApprovalRoutes } from "./hitl-approval-http.js";

const APPROVAL_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function makeApproval(overrides = {}) {
  const now = new Date();
  return {
    id: APPROVAL_ID,
    project_id: "p1",
    room_id: "room_1",
    tool_call_id: APPROVAL_ID,
    tool_name: "issue_refund",
    tool_input_json: "{}",
    run_id: null,
    agent_id: null,
    requester_user_id: "user_req",
    status: "pending",
    approval_chain_snapshot_json: "{}",
    current_step_index: 0,
    current_approver_id: "user_bob",
    started_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 3600_000).toISOString(),
    created_at: now.toISOString(),
    decided_at: null,
    decided_by: null,
    decision_note: null,
    ...overrides,
  };
}

/**
 * Fake D1 with one approval row and a conditional UPDATE that reports
 * `meta.changes`; `stale(n)` makes the next n reads report a pending row,
 * simulating two callers that both read before either wrote.
 */
function createDb(row) {
  let staleReads = 0;
  const calls = [];
  return {
    calls,
    row,
    stale(n) {
      staleReads = n;
    },
    prepare(sql) {
      return {
        bind(...args) {
          calls.push({ sql, args });
          return {
            async first() {
              if (!sql.includes("FROM hitl_approval_requests")) return null;
              if (staleReads > 0) {
                staleReads -= 1;
                return { ...row, status: "pending" };
              }
              return { ...row };
            },
            async run() {
              if (sql.includes("UPDATE hitl_approval_requests")) {
                if (sql.includes("SET status = 'expired'")) {
                  if (row.status !== "pending") return { meta: { changes: 0 } };
                  row.status = "expired";
                  return { meta: { changes: 1 } };
                }
                if (row.status !== "pending") return { meta: { changes: 0 } };
                row.status = args[0];
                row.decided_at = args[1];
                row.decided_by = args[2];
                row.decision_note = args[3];
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
}

function deps(db, { userId = "user_bob", roles = ["admin"] } = {}) {
  return createAuthMatrixDeps({
    db,
    verifyJwt: async () => ({ userId, projectId: "p1", roles }),
  });
}

function post(h, body) {
  const url = `http://127.0.0.1:8787/approvals/${APPROVAL_ID}/decision`;
  return dispatchHitlApprovalRoutes(
    new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    new URL(url),
    h,
  );
}

describe("hitl approval decision routes", () => {
  it("401s without a JWT", async () => {
    const res = await post(createAuthMatrixDeps(), { decision: "approve" });
    expect(res.status).toBe(401);
  });

  it("approves for the current approver", async () => {
    const db = createDb(makeApproval());
    const res = await post(deps(db), { decision: "approve", note: "lgtm" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.approval.status).toBe("approved");
    expect(body.approval.decidedBy).toBe("user_bob");
    expect(body.approval.note).toBe("lgtm");
    expect(db.row.decided_by).toBe("user_bob");
  });

  it("409s a second decision — first decision wins", async () => {
    const db = createDb(makeApproval({ status: "approved", decided_by: "user_bob" }));
    const res = await post(deps(db), { decision: "deny" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already/);
    expect(db.row.status).toBe("approved");
    expect(db.row.decided_by).toBe("user_bob");
  });

  it("409s a concurrent loser that read a stale pending row", async () => {
    const db = createDb(makeApproval({ status: "approved", decided_by: "user_bob" }));
    db.stale(2); // route pre-check + decide re-read both still see "pending"
    const res = await post(deps(db), { decision: "deny" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("already_approved");
    expect(db.row.decided_by).toBe("user_bob");
    expect(db.calls.some((c) => c.sql.includes("decision_note = ?"))).toBe(true);
  });

  it("403s when the caller is not the current approver", async () => {
    const db = createDb(makeApproval());
    const res = await post(deps(db, { userId: "user_mallory" }), { decision: "approve" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("not_current_approver");
    expect(db.row.status).toBe("pending");
  });
});
