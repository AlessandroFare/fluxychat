/**
 * Ephemeral room for a tool decision. Entry for agents that do not use chat UI.
 */
import { createD1ApprovalStore } from "./hitl-approval-d1.js";
import { routeHitlRisk } from "./hitl-risk-route.js";

export async function requireApprovalRoom(env, { projectId, requesterUserId, toolName, toolInput, reason, approverIds }) {
  if (!env?.DB || !projectId || !requesterUserId) {
    return { ok: false, error: "db_unavailable", status: 503 };
  }
  const name = String(toolName || "tool").slice(0, 64);
  if (!name) return { ok: false, error: "tool_name_required", status: 400 };

  const now = new Date().toISOString();
  const roomId = crypto.randomUUID();
  const roomName = `Approval: ${name}`.slice(0, 80);
  await env.DB.prepare(
    "INSERT INTO rooms (id, project_id, type, name, created_at) VALUES (?, ?, 'group', ?, ?)",
  )
    .bind(roomId, projectId, roomName, now)
    .run();

  const members = new Set([requesterUserId]);
  for (const id of approverIds || []) {
    if (typeof id === "string" && id.trim() && members.size < 12) members.add(id.trim());
  }
  const stmts = [...members].map((userId, index) =>
    env.DB.prepare(
      "INSERT INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
    ).bind(roomId, userId, index === 0 ? "owner" : "member", now),
  );
  if (stmts.length) await env.DB.batch(stmts);

  const approver = [...members].find((id) => id !== requesterUserId) || requesterUserId;
  const risk = routeHitlRisk({ toolName: name });
  const store = createD1ApprovalStore(env);
  const entry = await store.create({
    projectId,
    roomId,
    toolName: name,
    toolInput: toolInput && typeof toolInput === "object" ? toolInput : {},
    userId: requesterUserId,
    approvalChainSnapshot: {
      steps: [{ approverId: approver }],
      defaultTimeoutSeconds: risk.defaultTimeoutSeconds,
    },
  });

  return {
    ok: true,
    roomId,
    approvalId: entry?.id || null,
    riskTier: risk.tier,
    reason: reason ? String(reason).slice(0, 500) : null,
  };
}
