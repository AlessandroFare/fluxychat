/**
 * P20-B: Realtime Approval Workflows — fast in-room approvals.
 *
 * Features:
 *   • Workflow CRUD per room (budget, content, incident, support)
 *   • Approval requests with context (link to any entity)
 *   • Voting: approve/reject/abstain with comments
 *   • Threshold: single, majority, unanimous
 *   • SLA with auto-approve/escalate
 *   • Decision audit trail
 *   • Analytics (approval rate, avg time, bottlenecks)
 */

const WORKFLOW_TYPES = ["single", "majority", "unanimous", "threshold"];
const VOTE_DECISIONS = ["approve", "reject", "abstain"];
const REQUEST_STATUS = ["pending", "approved", "rejected", "expired", "cancelled"];

export async function createWorkflow(env, {
  projectId, roomId, name, description, workflowType, requiredApprovals,
  requiredRoles, slaMinutes, autoApproveAfterSla, notifyOnRequest, notifyOnDecision,
}) {
  if (!WORKFLOW_TYPES.includes(workflowType)) throw new Error(`Invalid workflow type: ${workflowType}`);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO approval_workflows (id, project_id, room_id, name, description, workflow_type,
     required_approvals, required_roles, sla_minutes, auto_approve_after_sla, notify_on_request, notify_on_decision)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, roomId, name, description || null, workflowType,
    requiredApprovals || 1, JSON.stringify(requiredRoles || ["owner", "admin"]),
    slaMinutes || 60, autoApproveAfterSla ? 1 : 0, notifyOnRequest !== false ? 1 : 0,
    notifyOnDecision !== false ? 1 : 0).run();
  return { id, name, workflowType, requiredApprovals: requiredApprovals || 1 };
}

export async function getWorkflow(env, { projectId, workflowId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM approval_workflows WHERE project_id = ? AND id = ?`
  ).bind(projectId, workflowId).first();
  return row ? formatWorkflow(row) : null;
}

export async function listWorkflows(env, { projectId, roomId }) {
  let query = `SELECT * FROM approval_workflows WHERE project_id = ?`;
  const params = [projectId];
  if (roomId) { query += ` AND room_id = ?`; params.push(roomId); }
  query += ` ORDER BY created_at DESC`;
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatWorkflow);
}

export async function deleteWorkflow(env, { projectId, workflowId }) {
  const info = await env.DB.prepare(
    `DELETE FROM approval_workflows WHERE project_id = ? AND id = ?`
  ).bind(projectId, workflowId).run();
  return info.meta?.changes > 0;
}

/* ═══ Requests ═══ */

export async function createRequest(env, {
  projectId, workflowId, roomId, requesterId, title, description,
  contextType, contextId, contextData, slaMinutes,
}) {
  const workflow = await getWorkflow(env, { projectId, workflowId });
  if (!workflow) throw new Error("Workflow not found");
  const id = crypto.randomUUID();
  const slaDue = new Date(Date.now() + (slaMinutes || workflow.slaMinutes || 60) * 60000).toISOString();
  await env.DB.prepare(
    `INSERT INTO approval_requests (id, workflow_id, project_id, room_id, requester_id,
     title, description, context_type, context_id, context_data, sla_due_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, workflowId, projectId, roomId, requesterId, title, description || null,
    contextType || null, contextId || null, JSON.stringify(contextData || {}), slaDue).run();
  return { id, title, status: "pending", slaDueAt: slaDue };
}

export async function getRequest(env, { projectId, requestId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM approval_requests WHERE project_id = ? AND id = ?`
  ).bind(projectId, requestId).first();
  return row ? formatRequest(row) : null;
}

export async function listRequests(env, { projectId, roomId, status, limit = 50 }) {
  let query = `SELECT * FROM approval_requests WHERE project_id = ?`;
  const params = [projectId];
  if (roomId) { query += ` AND room_id = ?`; params.push(roomId); }
  if (status) { query += ` AND status = ?`; params.push(status); }
  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatRequest);
}

export async function cancelRequest(env, { projectId, requestId }) {
  const info = await env.DB.prepare(
    `UPDATE approval_requests SET status = 'cancelled' WHERE project_id = ? AND id = ? AND status = 'pending'`
  ).bind(projectId, requestId).run();
  return info.meta?.changes > 0;
}

/* ═══ Voting ═══ */

export async function castVote(env, { projectId, requestId, voterId, vote, comment }) {
  if (!VOTE_DECISIONS.includes(vote)) throw new Error(`Invalid vote: ${vote}`);
  const request = await getRequest(env, { projectId, requestId });
  if (!request || request.status !== "pending") throw new Error("Request not pending");
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO approval_votes (id, request_id, voter_id, vote, comment)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, requestId, voterId, vote, comment || null).run();

  const votes = await getVotesForRequest(env, { projectId, requestId });
  const workflow = await getWorkflow(env, { projectId, projectId: request.projectId, workflowId: request.workflow_id });
  const decision = evaluateDecision(votes, workflow);

  if (decision) {
    await env.DB.prepare(
      `UPDATE approval_requests SET status = ?, decision = ?, decided_by = ?, decided_at = datetime('now')
       WHERE project_id = ? AND id = ?`
    ).bind(decision, decision, voterId, projectId, requestId).run();
  }

  return { id, vote, decision: decision || "pending", totalVotes: votes.length };
}

export async function getVotesForRequest(env, { projectId, requestId }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM approval_votes WHERE request_id = ? ORDER BY voted_at ASC`
  ).bind(requestId).all();
  return results.map(formatVote);
}

function evaluateDecision(votes, workflow) {
  const approveCount = votes.filter(v => v.vote === "approve").length;
  const rejectCount = votes.filter(v => v.vote === "reject").length;
  const total = votes.length;
  const required = workflow?.requiredApprovals || 1;
  const type = workflow?.workflowType || "single";

  if (type === "unanimous" && approveCount === total && total >= required) return "approved";
  if (type === "majority" && approveCount > total / 2 && approveCount >= required) return "approved";
  if (type === "threshold" && approveCount >= required) return "approved";
  if (type === "single" && approveCount >= 1) return "approved";
  if (rejectCount > total / 2) return "rejected";
  return null;
}

/* ═══ Analytics ═══ */

export async function getApprovalStats(env, { projectId, roomId }) {
  const total = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM approval_requests WHERE project_id = ? AND room_id = ?`
  ).bind(projectId, roomId).first();
  const byStatus = await env.DB.prepare(
    `SELECT status, COUNT(*) as count FROM approval_requests
     WHERE project_id = ? AND room_id = ? GROUP BY status`
  ).bind(projectId, roomId).all();
  const avgTime = await env.DB.prepare(
    `SELECT AVG((julianday(decided_at) - julianday(created_at)) * 86400) as avg_seconds
     FROM approval_requests WHERE project_id = ? AND room_id = ? AND decided_at IS NOT NULL`
  ).bind(projectId, roomId).first();

  return {
    total: total?.total || 0,
    byStatus: Object.fromEntries((byStatus.results || byStatus).map(r => [r.status, r.count])),
    avgDecisionTimeSeconds: avgTime?.avg_seconds ? Math.round(avgTime.avg_seconds) : null,
  };
}

function formatWorkflow(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id, name: row.name,
    description: row.description, workflowType: row.workflow_type,
    requiredApprovals: row.required_approvals,
    requiredRoles: JSON.parse(row.required_roles || "[]"),
    slaMinutes: row.sla_minutes, autoApproveAfterSla: row.auto_approve_after_sla === 1,
    notifyOnRequest: row.notify_on_request === 1, notifyOnDecision: row.notify_on_decision === 1,
    enabled: row.enabled === 1, createdAt: row.created_at,
  };
}

function formatRequest(row) {
  return {
    id: row.id, workflowId: row.workflow_id, projectId: row.project_id, roomId: row.room_id,
    requesterId: row.requester_id, title: row.title, description: row.description,
    contextType: row.context_type, contextId: row.context_id,
    contextData: JSON.parse(row.context_data || "{}"), status: row.status,
    decision: row.decision, decidedBy: row.decided_by, decidedAt: row.decided_at,
    slaDueAt: row.sla_due_at, createdAt: row.created_at,
  };
}

function formatVote(row) {
  return {
    id: row.id, requestId: row.request_id, voterId: row.voter_id,
    vote: row.vote, comment: row.comment, votedAt: row.voted_at,
  };
}
