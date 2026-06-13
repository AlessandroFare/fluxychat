import { describe, it, expect } from "vitest";
import {
  createWorkflow, getWorkflow, listWorkflows, deleteWorkflow,
  createRequest, getRequest, listRequests, cancelRequest,
  castVote, getVotesForRequest, getApprovalStats,
} from "../lib/approval-workflows.js";

function mockDb(rows = []) {
  const run = async () => ({ meta: { changes: 1 } });
  const first = async () => rows[0] || null;
  const all = async () => ({ results: rows });
  return {
    prepare: () => ({
      bind: () => ({ run, first, all }),
    }),
  };
}

function mockDbRouter(responses) {
  let callIndex = 0;
  return {
    prepare: (sql) => ({
      bind: () => ({
        run: async () => { callIndex++; return { meta: { changes: 1 } }; },
        first: async () => responses[callIndex++]?.first ?? null,
        all: async () => ({ results: responses[callIndex++]?.all ?? [] }),
      }),
    }),
  };
}

describe("approval-workflows", () => {
  describe("createWorkflow", () => {
    it("creates a workflow", async () => {
      const env = { DB: mockDb() };
      const wf = await createWorkflow(env, {
        projectId: "p1", roomId: "r1", name: "Budget Approval",
        workflowType: "majority", requiredApprovals: 3,
      });
      expect(wf.id).toBeDefined();
      expect(wf.name).toBe("Budget Approval");
      expect(wf.workflowType).toBe("majority");
      expect(wf.requiredApprovals).toBe(3);
    });

    it("rejects invalid workflow type", async () => {
      const env = { DB: mockDb() };
      await expect(
        createWorkflow(env, { projectId: "p1", roomId: "r1", name: "x", workflowType: "invalid" })
      ).rejects.toThrow("Invalid workflow type");
    });
  });

  describe("getWorkflow", () => {
    it("returns formatted workflow", async () => {
      const env = { DB: mockDb([{
        id: "wf1", project_id: "p1", room_id: "r1", name: "Budget",
        description: "Budget approvals", workflow_type: "single",
        required_approvals: 1, required_roles: '["admin"]',
        sla_minutes: 30, auto_approve_after_sla: 0,
        notify_on_request: 1, notify_on_decision: 1, enabled: 1,
        created_at: "2026-01-01",
      }])};
      const wf = await getWorkflow(env, { projectId: "p1", workflowId: "wf1" });
      expect(wf.name).toBe("Budget");
      expect(wf.requiredRoles).toEqual(["admin"]);
      expect(wf.slaMinutes).toBe(30);
    });

    it("returns null for missing workflow", async () => {
      const env = { DB: mockDb([]) };
      const wf = await getWorkflow(env, { projectId: "p1", workflowId: "missing" });
      expect(wf).toBeNull();
    });
  });

  describe("listWorkflows", () => {
    it("lists workflows", async () => {
      const env = { DB: mockDb([
        { id: "wf1", project_id: "p1", room_id: "r1", name: "A", description: null, workflow_type: "single", required_approvals: 1, required_roles: "[]", sla_minutes: 60, auto_approve_after_sla: 0, notify_on_request: 1, notify_on_decision: 1, enabled: 1, created_at: "2026-01-01" },
        { id: "wf2", project_id: "p1", room_id: "r1", name: "B", description: null, workflow_type: "unanimous", required_approvals: 2, required_roles: "[]", sla_minutes: 60, auto_approve_after_sla: 0, notify_on_request: 1, notify_on_decision: 1, enabled: 1, created_at: "2026-01-02" },
      ])};
      const wfs = await listWorkflows(env, { projectId: "p1", roomId: "r1" });
      expect(wfs).toHaveLength(2);
    });
  });

  describe("deleteWorkflow", () => {
    it("deletes workflow", async () => {
      const env = { DB: mockDb() };
      const ok = await deleteWorkflow(env, { projectId: "p1", workflowId: "wf1" });
      expect(ok).toBe(true);
    });
  });

  describe("createRequest", () => {
    it("creates a request", async () => {
      const env = { DB: mockDb([{
        id: "wf1", project_id: "p1", room_id: "r1", name: "Budget",
        description: null, workflow_type: "single", required_approvals: 1,
        required_roles: '["admin"]', sla_minutes: 60, auto_approve_after_sla: 0,
        notify_on_request: 1, notify_on_decision: 1, enabled: 1, created_at: "2026-01-01",
      }])};
      const req = await createRequest(env, {
        projectId: "p1", workflowId: "wf1", roomId: "r1",
        requesterId: "u1", title: "Budget $5000", slaMinutes: 30,
      });
      expect(req.id).toBeDefined();
      expect(req.title).toBe("Budget $5000");
      expect(req.status).toBe("pending");
      expect(req.slaDueAt).toBeDefined();
    });

    it("throws if workflow not found", async () => {
      const env = { DB: mockDb([]) };
      await expect(
        createRequest(env, { projectId: "p1", workflowId: "missing", roomId: "r1", requesterId: "u1", title: "x" })
      ).rejects.toThrow("Workflow not found");
    });
  });

  describe("getRequest", () => {
    it("returns formatted request", async () => {
      const env = { DB: mockDb([{
        id: "req1", workflow_id: "wf1", project_id: "p1", room_id: "r1",
        requester_id: "u1", title: "Budget", description: null,
        context_type: "expense", context_id: "exp1",
        context_data: '{"amount":5000}', status: "pending",
        decision: null, decided_by: null, decided_at: null,
        sla_due_at: "2026-01-02", created_at: "2026-01-01",
      }])};
      const req = await getRequest(env, { projectId: "p1", requestId: "req1" });
      expect(req.contextType).toBe("expense");
      expect(req.contextData.amount).toBe(5000);
    });
  });

  describe("listRequests", () => {
    it("filters by status", async () => {
      const env = { DB: mockDb([
        { id: "r1", workflow_id: "w1", project_id: "p1", room_id: "r1", requester_id: "u1", title: "A", description: null, context_type: null, context_id: null, context_data: "{}", status: "pending", decision: null, decided_by: null, decided_at: null, sla_due_at: "2026-01-02", created_at: "2026-01-01" },
      ])};
      const reqs = await listRequests(env, { projectId: "p1", roomId: "r1", status: "pending" });
      expect(reqs).toHaveLength(1);
      expect(reqs[0].status).toBe("pending");
    });
  });

  describe("cancelRequest", () => {
    it("cancels pending request", async () => {
      const env = { DB: mockDb() };
      const ok = await cancelRequest(env, { projectId: "p1", requestId: "req1" });
      expect(ok).toBe(true);
    });
  });

  describe("castVote", () => {
    it("casts vote and returns decision when threshold met", async () => {
      const pendingRequest = { id: "req1", workflow_id: "wf1", project_id: "p1", room_id: "r1", requester_id: "u1", title: "Budget", description: null, context_type: null, context_id: null, context_data: "{}", status: "pending", decision: null, decided_by: null, decided_at: null, sla_due_at: "2026-01-02", created_at: "2026-01-01" };
      const existingVote = { id: "v1", request_id: "req1", voter_id: "u1", vote: "approve", comment: null, voted_at: "2026-01-01" };
      const workflow = { id: "wf1", project_id: "p1", room_id: "r1", name: "Budget", description: null, workflow_type: "single", required_approvals: 1, required_roles: '["admin"]', sla_minutes: 60, auto_approve_after_sla: 0, notify_on_request: 1, notify_on_decision: 1, enabled: 1, created_at: "2026-01-01" };
      const env = { DB: mockDbRouter([
        { first: pendingRequest },   // getRequest
        {},                          // INSERT vote (run)
        { all: [existingVote, { id: "v2", request_id: "req1", voter_id: "u2", vote: "approve", comment: null, voted_at: "2026-01-01" }] }, // getVotesForRequest
        { first: workflow },         // getWorkflow
      ])};
      const result = await castVote(env, {
        projectId: "p1", requestId: "req1", voterId: "u2", vote: "approve",
      });
      expect(result.vote).toBe("approve");
      expect(result.decision).toBe("approved");
      expect(result.totalVotes).toBe(2);
    });

    it("throws on invalid vote", async () => {
      const env = { DB: mockDb([]) };
      await expect(
        castVote(env, { projectId: "p1", requestId: "r1", voterId: "u1", vote: "maybe" })
      ).rejects.toThrow("Invalid vote");
    });

    it("rejects vote on non-pending request", async () => {
      const env = { DB: mockDb([{
        id: "req1", workflow_id: "wf1", project_id: "p1", room_id: "r1",
        requester_id: "u1", title: "x", description: null, context_type: null,
        context_id: null, context_data: "{}", status: "approved",
        decision: "approved", decided_by: "u2", decided_at: "2026-01-01",
        sla_due_at: "2026-01-02", created_at: "2026-01-01",
      }])};
      await expect(
        castVote(env, { projectId: "p1", requestId: "req1", voterId: "u1", vote: "approve" })
      ).rejects.toThrow("Request not pending");
    });
  });

  describe("getVotesForRequest", () => {
    it("returns votes", async () => {
      const env = { DB: mockDb([
        { id: "v1", request_id: "r1", voter_id: "u1", vote: "approve", comment: "LGTM", voted_at: "2026-01-01" },
        { id: "v2", request_id: "r1", voter_id: "u2", vote: "reject", comment: "Too expensive", voted_at: "2026-01-01" },
      ])};
      const votes = await getVotesForRequest(env, { projectId: "p1", requestId: "r1" });
      expect(votes).toHaveLength(2);
      expect(votes[0].vote).toBe("approve");
      expect(votes[1].comment).toBe("Too expensive");
    });
  });

  describe("getApprovalStats", () => {
    it("returns stats", async () => {
      const env = { DB: mockDbRouter([
        { first: { total: 10 } },
        { all: [
          { status: "approved", count: 7 },
          { status: "pending", count: 2 },
          { status: "rejected", count: 1 },
        ]},
        { first: { avg_seconds: 1800 } },
      ])};
      const stats = await getApprovalStats(env, { projectId: "p1", roomId: "r1" });
      expect(stats.total).toBe(10);
      expect(stats.avgDecisionTimeSeconds).toBe(1800);
    });
  });
});
