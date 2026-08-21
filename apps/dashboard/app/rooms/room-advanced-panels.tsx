"use client";

import { RoomOfflineNotifySettings } from "../components/room-offline-notify-settings";
import { RoomMcpConnectPanel } from "../components/room-mcp-connect-panel";
import { RoomPresenceEscalationPanel } from "../components/room-presence-escalation-panel";
import { RoomRoleVisibilityPanel } from "../components/room-role-visibility-panel";
import { RoomDecisionQuorumPanel } from "../components/room-decision-quorum-panel";
import { RoomExternalEventPanel } from "../components/room-external-event-panel";
import { RoomAsymmetryPanel } from "../components/room-asymmetry-panel";
import { RoomAudienceScorePanel } from "../components/room-audience-score-panel";
import { RoomMemoryPanel } from "../components/room-memory-panel";
import { RoomKnowledgeGraphPanel } from "../components/room-knowledge-graph-panel";
import { RoomApprovalChainPanel } from "../components/room-approval-chain-panel";

export function RoomAdvancedPanels({
  roomId,
  memberJwt,
  memberUserId,
}: {
  roomId: string;
  memberJwt: string;
  memberUserId?: string;
}) {
  return (
    <div className="mt-4 space-y-6">
      <p className="text-xs text-muted-foreground">
        Advanced room modules (MCP, memory, quorum, …). Same Worker APIs; not required for chat.
      </p>
      <RoomMcpConnectPanel roomId={roomId} memberJwt={memberJwt} />
      <RoomPresenceEscalationPanel roomId={roomId} memberJwt={memberJwt} />
      <RoomRoleVisibilityPanel roomId={roomId} />
      <RoomDecisionQuorumPanel roomId={roomId} memberJwt={memberJwt} />
      <RoomExternalEventPanel roomId={roomId} memberJwt={memberJwt} />
      <RoomAsymmetryPanel roomId={roomId} memberJwt={memberJwt} />
      <RoomAudienceScorePanel roomId={roomId} memberJwt={memberJwt} />
      <RoomMemoryPanel roomId={roomId} memberJwt={memberJwt} />
      <RoomApprovalChainPanel roomId={roomId} memberJwt={memberJwt} />
      <RoomKnowledgeGraphPanel roomId={roomId} memberJwt={memberJwt} />
      <RoomOfflineNotifySettings
        roomId={roomId}
        memberJwt={memberJwt}
        memberUserId={memberUserId}
      />
    </div>
  );
}
