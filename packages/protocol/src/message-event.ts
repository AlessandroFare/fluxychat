import { isWsFrameWithinSizeLimit } from "./frame-size.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const MAX_MESSAGE_CONTENT_CHARS = 32_000;

/**
 * Structural check for chat `message` frames (inbound or outbound).
 * Type allowlists live in event-types; this bounds required fields.
 */
export function isValidChatMessageEvent(value: unknown): boolean {
  if (!isRecord(value) || value.type !== "message") return false;
  if (!isWsFrameWithinSizeLimit(value)) return false;
  if (value.content != null && typeof value.content !== "string") return false;
  if (typeof value.content === "string" && value.content.length > MAX_MESSAGE_CONTENT_CHARS) {
    return false;
  }
  if (value.id != null && typeof value.id !== "string" && typeof value.id !== "number") {
    return false;
  }
  if (value.roomId != null && typeof value.roomId !== "string") return false;
  return true;
}
