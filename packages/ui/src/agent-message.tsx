import type { FluxyChatMessage } from "@fluxy-chat/sdk";
import { MessageItem } from "./message-item";

export interface AgentMessageProps {
  message: FluxyChatMessage;
  /** Resolved parent message for reply threading. */
  parentMessage?: FluxyChatMessage | null;
  reactions?: Record<string, number>;
  seenByUserIds?: string[];
  localUserId?: string;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReact?: (emoji: string) => void;
  /** Retry a failed optimistic send. */
  onRetry?: (clientMessageId: string) => void;
  agentLabel?: string;
  className?: string;
  "data-testid"?: string;
  "data-streaming"?: string;
  "data-message-id"?: string;
}

/** Thin wrapper: renders a MessageItem with agent chrome (label + alignment). */
export function AgentMessage({ agentLabel, ...rest }: AgentMessageProps) {
  return <MessageItem {...rest} variant="agent" agentLabel={agentLabel} />;
}
