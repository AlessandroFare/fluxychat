export const MAX_MESSAGE_LENGTH = 4000;

export function validateMessageContent(content) {
  if (typeof content !== "string") {
    return { valid: false, error: "content must be a string" };
  }
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "content cannot be empty" };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `content exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
    };
  }
  return { valid: true, content: trimmed };
}
