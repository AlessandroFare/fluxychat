import { FLUXY_MAX_MESSAGE_LENGTH } from "./room-rest";

export interface AgentOutboundMessageInput {
  userId: string;
  content: string;
  parentId?: number | null;
  attachments?: unknown[];
}

export interface AgentOutboundValidationResult {
  valid: boolean;
  error?: string;
  content?: string;
  parentId?: number | null;
}

export function validateAgentOutboundMessage(
  input: AgentOutboundMessageInput,
): AgentOutboundValidationResult {
  const userId = input.userId?.trim();
  if (!userId) {
    return { valid: false, error: "userId is required" };
  }
  if (userId.length > 128) {
    return { valid: false, error: "userId exceeds maximum length" };
  }

  if (typeof input.content !== "string") {
    return { valid: false, error: "content must be a string" };
  }
  const trimmed = input.content.trim();
  if (!trimmed) {
    return { valid: false, error: "content cannot be empty" };
  }
  if (trimmed.length > FLUXY_MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `content exceeds maximum length of ${FLUXY_MAX_MESSAGE_LENGTH} characters`,
    };
  }

  let parentId: number | null = null;
  if (input.parentId != null) {
    if (!Number.isFinite(input.parentId) || input.parentId < 1) {
      return { valid: false, error: "parentId must be a positive message id" };
    }
    parentId = Math.floor(input.parentId);
  }

  const attachments = input.attachments;
  if (attachments != null) {
    if (!Array.isArray(attachments)) {
      return { valid: false, error: "attachments must be an array" };
    }
    if (attachments.length > 20) {
      return { valid: false, error: "attachments cannot exceed 20 items" };
    }
  }

  return { valid: true, content: trimmed, parentId };
}

export function buildAgentOutboundWsPayload(
  input: AgentOutboundMessageInput,
): Record<string, unknown> {
  const validated = validateAgentOutboundMessage(input);
  if (!validated.valid) {
    throw new Error(validated.error ?? "Invalid agent outbound message");
  }
  return {
    type: "message",
    userId: input.userId.trim(),
    content: validated.content,
    parentId: validated.parentId ?? null,
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
  };
}
