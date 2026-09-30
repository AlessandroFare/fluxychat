export function buildHitlEvidencePack(entry) {
  if (!entry || typeof entry !== "object") return null;
  return {
    v: 1,
    kind: "fluxy.hitl.evidence",
    approvalId: entry.id || null,
    projectId: entry.projectId || null,
    roomId: entry.roomId || null,
    toolName: entry.toolName || null,
    toolCallId: entry.toolCallId || null,
    toolInput: entry.toolInput ?? {},
    status: entry.status || null,
    chain: entry.approvalChainSnapshot ?? null,
    currentApproverId: entry.currentApproverId ?? null,
    requesterUserId: entry.requesterUserId || entry.userId || null,
    startedAt: entry.startedAt || null,
    expiresAt: entry.expiresAt || null,
    decidedAt: entry.decidedAt || null,
    decidedBy: entry.decidedBy || null,
    note: entry.note || null,
  };
}
