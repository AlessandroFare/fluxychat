import type { FluxyChatMessage } from "@fluxy-chat/sdk";
import { MessageItem } from "./message-item";

export interface AgentMessageProps {
  message: FluxyChatMessage;
  reactions?: Record<string, number>;
  seenByUserIds?: string[];
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReact?: (emoji: string) => void;
  agentLabel?: string;
}

/** SPEC §8 helper: same as MessageItem with explicit agent chrome. */
export function AgentMessage({ agentLabel, ...rest }: AgentMessageProps) {
  return <MessageItem {...rest} variant="agent" agentLabel={agentLabel} />;
}
