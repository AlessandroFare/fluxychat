import type { FluxyChatClient } from "./fluxy-chat-client";

/** OpenAI Agents SDK: call this from a human-approval tool instead of their default UI. */
export function openaiAgentsRequireApproval(client: FluxyChatClient) {
  return async function requireApproval(toolName: string, args: Record<string, unknown>, approverIds?: string[]) {
    return client.requireApproval({ toolName, toolInput: args, approverIds });
  };
}

/** LangGraph interrupt: persist `{ roomId, approvalId }` on the checkpoint, resume after HITL. */
export function langGraphRequireApproval(client: FluxyChatClient) {
  return openaiAgentsRequireApproval(client);
}
