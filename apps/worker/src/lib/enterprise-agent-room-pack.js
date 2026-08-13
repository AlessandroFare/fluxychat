/**
 * NW-202 — Enterprise Agent Room product pack (B2B multi-agent + audit + cross-org).
 */

export const ENTERPRISE_AGENT_ROOM_PACK_ID = "enterprise-agent-room-v1";

export const ENTERPRISE_AGENT_ROOM_FEATURES = [
  {
    id: "multi_agent",
    label: "Multi-agent room",
    path: "/agents/platform",
    description: "Several agents with scoped tool policies in one room",
  },
  {
    id: "audit_chain",
    label: "Audit chain export",
    path: "/audit-chain",
    description: "Tamper-evident export of agent + moderation actions",
  },
  {
    id: "cross_org",
    label: "Cross-org negotiation",
    path: "/agents/cross-org",
    description: "Neutral host room with escrow commitments",
  },
  {
    id: "hitl",
    label: "HITL tool approvals",
    path: "/settings/agent-tools",
    description: "Policy-as-code require_approval for sensitive tools",
  },
];

export function buildEnterpriseAgentRoomPreview(opts = {}) {
  const name = String(opts.name || "Enterprise Agent Room").trim() || "Enterprise Agent Room";
  return {
    packId: ENTERPRISE_AGENT_ROOM_PACK_ID,
    name,
    roomType: "group",
    features: ENTERPRISE_AGENT_ROOM_FEATURES,
    welcomeMessage:
      `Welcome to **${name}** (Enterprise Agent Room).\n\n` +
      `Bundled workflows:\n` +
      ENTERPRISE_AGENT_ROOM_FEATURES.map((f) => `• **${f.label}** — ${f.description}`).join("\n"),
    recommendedAgents: ["@support", "@compliance", "@technical"],
  };
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   userId: string,
 *   name?: string,
 *   agentHandles?: string[],
 *   createRoom: (input: { name: string, type: string, members?: Array<{ userId: string, role: string }> }) => Promise<{ id: string }>,
 *   postWelcome?: (roomId: string, content: string) => Promise<unknown>,
 * }} deps
 */
export async function provisionEnterpriseAgentRoom(env, deps) {
  const preview = buildEnterpriseAgentRoomPreview({ name: deps.name });
  const members = [{ userId: deps.userId, role: "owner" }];
  const room = await deps.createRoom({
    name: preview.name,
    type: preview.roomType,
    members,
  });

  if (typeof deps.postWelcome === "function" && room?.id) {
    try {
      await deps.postWelcome(room.id, preview.welcomeMessage);
    } catch {
      /* non-fatal */
    }
  }

  return {
    ok: true,
    packId: ENTERPRISE_AGENT_ROOM_PACK_ID,
    room,
    features: ENTERPRISE_AGENT_ROOM_FEATURES,
    recommendedAgents: preview.recommendedAgents,
    auditExportPath: "/audit-chain",
    crossOrgPath: "/agents/cross-org",
  };
}
