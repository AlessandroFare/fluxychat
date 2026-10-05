/**
 * Four-eyes / maker-checker for HITL. Agent never approves. Requester never approves.
 */

export function isAgentActorId(userId, agentId) {
  const id = String(userId || "").trim();
  if (!id) return false;
  if (id.startsWith("agent:") || id.startsWith("@")) return true;
  if (agentId && id === String(agentId)) return true;
  return false;
}

/**
 * @param {{
 *   makerChecker?: boolean,
 *   requesterUserId?: string | null,
 *   decidedBy?: string | null,
 *   agentId?: string | null,
 * }} input
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function assertMakerCheckerDecision(input) {
  if (!input?.makerChecker) return { ok: true };
  const decidedBy = String(input.decidedBy || "").trim();
  if (!decidedBy) return { ok: false, error: "maker_checker_requires_human" };
  if (isAgentActorId(decidedBy, input.agentId)) {
    return { ok: false, error: "agent_cannot_approve" };
  }
  const requester = String(input.requesterUserId || "").trim();
  if (requester && decidedBy === requester) {
    return { ok: false, error: "requester_cannot_approve" };
  }
  return { ok: true };
}
