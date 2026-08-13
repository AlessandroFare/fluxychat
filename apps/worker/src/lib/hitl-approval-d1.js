/**
 * D1-backed HITL approval store with immutable chain snapshot per request.
 */
import {
  resolveApproverAtStep,
  snapshotApprovalChain,
  stepTimeoutSeconds,
  DEFAULT_APPROVAL_TIMEOUT_SECONDS,
} from "./room-approval-chain.js";
import { appendRoomTimelineEvent } from "./room-timeline-events.js";

function nowIso() {
  return new Date().toISOString();
}

function mapRow(row) {
  if (!row) return null;
  let chainSnapshot = { steps: [], defaultTimeoutSeconds: DEFAULT_APPROVAL_TIMEOUT_SECONDS };
  try {
    chainSnapshot = JSON.parse(String(row.approval_chain_snapshot_json || "{}"));
  } catch {
    chainSnapshot = { steps: [] };
  }
  let toolInput = {};
  try {
    toolInput = JSON.parse(String(row.tool_input_json || "{}"));
  } catch {
    toolInput = {};
  }
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id,
    toolCallId: row.tool_call_id,
    toolName: row.tool_name,
    toolInput,
    runId: row.run_id ?? null,
    agentId: row.agent_id ?? null,
    userId: row.requester_user_id ?? null,
    requesterUserId: row.requester_user_id ?? null,
    status: row.status,
    approvalChainSnapshot: chainSnapshot,
    currentStepIndex: row.current_step_index ?? 0,
    currentApproverId: row.current_approver_id ?? null,
    startedAt: row.started_at,
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at,
    decidedAt: row.decided_at ?? null,
    decidedBy: row.decided_by ?? null,
    note: row.decision_note ?? null,
    reason: row.tool_name ? `Tool "${row.tool_name}" requires human approval` : undefined,
  };
}

function computeStepExpiry(chain, stepIndex) {
  const steps = chain?.steps ?? [];
  const step = steps[stepIndex];
  const defaultTimeout = chain?.defaultTimeoutSeconds ?? DEFAULT_APPROVAL_TIMEOUT_SECONDS;
  const seconds = step ? stepTimeoutSeconds(step, defaultTimeout) : defaultTimeout;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/**
 * @param {*} env
 */
export function createD1ApprovalStore(env) {
  return {
    async create(request) {
      const id = crypto.randomUUID();
      const now = nowIso();
      const chainSnapshot = snapshotApprovalChain(request.approvalChainSnapshot ?? { steps: [] });
      const steps = chainSnapshot.steps ?? [];
      const resolved = resolveApproverAtStep(steps, 0);
      const expiresAt = computeStepExpiry(chainSnapshot, 0);

      await env.DB.prepare(
        `INSERT INTO hitl_approval_requests (
          id, project_id, room_id, tool_call_id, tool_name, tool_input_json,
          run_id, agent_id, requester_user_id, status, approval_chain_snapshot_json,
          current_step_index, current_approver_id, started_at, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          request.projectId,
          request.roomId,
          request.toolCallId ?? request.runId ?? id,
          request.toolName,
          JSON.stringify(request.toolInput ?? {}),
          request.runId ?? null,
          request.agentId ?? null,
          request.userId ?? null,
          JSON.stringify(chainSnapshot),
          resolved.approverId,
          now,
          expiresAt,
          now,
        )
        .run();

      const entry = mapRow(
        await env.DB.prepare(`SELECT * FROM hitl_approval_requests WHERE id = ?`).bind(id).first(),
      );

      if (request.projectId) {
        await appendRoomTimelineEvent(env, {
          projectId: request.projectId,
          roomId: request.roomId,
          eventType: "approval_requested",
          createdBy: request.userId ?? null,
          payload: {
            type: "approval_requested",
            approvalRequestId: id,
            toolCallId: request.toolCallId ?? id,
            toolName: request.toolName,
            toolInput: request.toolInput ?? {},
            approvalChainSnapshot: chainSnapshot,
            currentStepIndex: 0,
            currentApproverId: resolved.approverId,
            startedAt: now,
          },
        });
      }

      return entry;
    },

    async get(id) {
      const row = await env.DB.prepare(`SELECT * FROM hitl_approval_requests WHERE id = ?`).bind(id).first();
      const entry = mapRow(row);
      if (!entry) return null;
      if (entry.status === "pending" && entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
        await env.DB.prepare(
          `UPDATE hitl_approval_requests SET status = 'expired', decided_at = ? WHERE id = ? AND status = 'pending'`,
        )
          .bind(nowIso(), id)
          .run();
        entry.status = "expired";
        entry.decidedAt = nowIso();
      }
      return entry;
    },

    async approve(id, userId, note) {
      return this.decide(id, userId, "approved", note);
    },

    async deny(id, userId, note) {
      return this.decide(id, userId, "denied", note);
    },

    async decide(id, userId, decision, note) {
      const existing = await this.get(id);
      if (!existing) throw new Error("Approval request not found");
      if (existing.status !== "pending") throw new Error(`Request already ${existing.status}`);
      if (existing.currentApproverId && existing.currentApproverId !== userId) {
        throw new Error("not_current_approver");
      }

      const status = decision === "approve" || decision === "approved" ? "approved" : "denied";
      const now = nowIso();
      await env.DB.prepare(
        `UPDATE hitl_approval_requests
         SET status = ?, decided_at = ?, decided_by = ?, decision_note = ?
         WHERE id = ? AND status = 'pending'`,
      )
        .bind(status, now, userId, note ?? null, id)
        .run();

      return this.get(id);
    },

    async getPendingForRoom(projectId, roomId) {
      const { results } = await env.DB.prepare(
        `SELECT * FROM hitl_approval_requests
         WHERE project_id = ? AND room_id = ? AND status = 'pending'
         ORDER BY started_at ASC LIMIT 100`,
      )
        .bind(projectId, roomId)
        .all();
      return (results || []).map(mapRow);
    },

    async getPendingForApprover(projectId, approverId) {
      const { results } = await env.DB.prepare(
        `SELECT * FROM hitl_approval_requests
         WHERE project_id = ? AND current_approver_id = ? AND status = 'pending'
         ORDER BY started_at ASC LIMIT 100`,
      )
        .bind(projectId, approverId)
        .all();
      return (results || []).map(mapRow);
    },

    /** @deprecated use getPendingForApprover */
    async getPendingForUser(userId) {
      throw new Error("getPendingForUser requires projectId — use getPendingForApprover");
    },
  };
}
