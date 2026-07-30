import type { AIContentPart, AIMessage } from "./providers";

export interface AIMessageValidationOptions {
  allowSystemMessages?: boolean;
  maxMessages?: number;
  maxTextLength?: number;
  maxBinaryBytes?: number;
}

export type AIMessageValidationResult =
  | { success: true; messages: AIMessage[] }
  | { success: false; issues: string[] };

const VALID_ROLES = new Set(["system", "user", "assistant", "tool"]);
const VALID_PARTS = new Set(["text", "image", "audio", "file"]);

function validatePart(
  value: unknown,
  path: string,
  options: Required<AIMessageValidationOptions>,
  issues: string[],
): value is AIContentPart {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push(`${path} must be an object.`);
    return false;
  }
  const part = value as Record<string, unknown>;
  if (typeof part.type !== "string" || !VALID_PARTS.has(part.type)) {
    issues.push(`${path}.type is unsupported.`);
    return false;
  }
  const field = part.type === "text" ? "text" : part.type;
  const payload = part[field];
  if (typeof payload === "string") {
    if (!payload || payload.length > options.maxTextLength) issues.push(`${path}.${field} has an invalid length.`);
  } else if (payload instanceof Uint8Array) {
    if (payload.byteLength > options.maxBinaryBytes) issues.push(`${path}.${field} exceeds the binary limit.`);
  } else {
    issues.push(`${path}.${field} must be a string or Uint8Array.`);
  }
  if (part.mediaType !== undefined && typeof part.mediaType !== "string") issues.push(`${path}.mediaType must be a string.`);
  if (part.filename !== undefined && typeof part.filename !== "string") issues.push(`${path}.filename must be a string.`);
  return true;
}

export function safeValidateAIMessages(
  value: unknown,
  options: AIMessageValidationOptions = {},
): AIMessageValidationResult {
  const limits: Required<AIMessageValidationOptions> = {
    allowSystemMessages: options.allowSystemMessages ?? false,
    maxMessages: Math.max(1, options.maxMessages ?? 256),
    maxTextLength: Math.max(1, options.maxTextLength ?? 1_000_000),
    maxBinaryBytes: Math.max(1, options.maxBinaryBytes ?? 20_000_000),
  };
  if (!Array.isArray(value)) return { success: false, issues: ["Messages must be an array."] };
  if (value.length > limits.maxMessages) return { success: false, issues: ["Message count exceeds the limit."] };

  const issues: string[] = [];
  const messages: AIMessage[] = [];
  value.forEach((candidate, index) => {
    const path = `messages[${index}]`;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      issues.push(`${path} must be an object.`);
      return;
    }
    const message = candidate as Record<string, unknown>;
    if (typeof message.role !== "string" || !VALID_ROLES.has(message.role)) {
      issues.push(`${path}.role is unsupported.`);
      return;
    }
    if (message.role === "system" && !limits.allowSystemMessages) {
      issues.push(`${path} cannot use the system role.`);
    }
    if (typeof message.content === "string") {
      if (message.content.length > limits.maxTextLength) issues.push(`${path}.content exceeds the text limit.`);
    } else if (Array.isArray(message.content)) {
      message.content.forEach((part, partIndex) => validatePart(part, `${path}.content[${partIndex}]`, limits, issues));
    } else {
      issues.push(`${path}.content must be text or content parts.`);
    }
    if (message.name !== undefined && typeof message.name !== "string") issues.push(`${path}.name must be a string.`);
    if (message.toolCallId !== undefined && typeof message.toolCallId !== "string") issues.push(`${path}.toolCallId must be a string.`);
    messages.push(message as unknown as AIMessage);
  });
  return issues.length ? { success: false, issues } : { success: true, messages };
}

export function validateAIMessages(value: unknown, options?: AIMessageValidationOptions): AIMessage[] {
  const result = safeValidateAIMessages(value, options);
  if (!result.success) throw new TypeError(`Invalid AI messages: ${result.issues.join(" ")}`);
  return result.messages;
}
