/**
 * Vercel WorkflowAgent stays in `ai`. This helper treats a FluxyChat room as the
 * reviewer surface: humans vote HITL, HMAC from experimental_toolApprovalSecret
 * is accepted on decide, quorum still wins.
 */
import type { FluxyChatClient } from "@fluxy-chat/sdk";

export interface RoomReviewerOptions {
  client: FluxyChatClient;
  roomId?: string;
}

export function createRoomReviewer(options: RoomReviewerOptions) {
  const { client } = options;
  return {
    async requireToolApproval(input: {
      toolName: string;
      toolInput?: Record<string, unknown>;
      reason?: string;
      approverIds?: string[];
    }) {
      return client.requireApproval(input);
    },
    async decide(
      approvalId: string,
      approved: boolean,
      extra?: { note?: string; vercelSignature?: string },
    ) {
      return client.decideHitl(approvalId, approved ? "approve" : "deny", extra);
    },
    async pending(roomId = options.roomId) {
      if (!roomId) return [];
      return client.listHitlApprovals(roomId);
    },
  };
}
