import { describe, expect, it } from "vitest";
import { MAX_MESSAGE_LENGTH, validateMessageContent } from "./message-validation.js";

describe("validateMessageContent", () => {
  it("rejects empty and non-string content", () => {
    expect(validateMessageContent("").valid).toBe(false);
    expect(validateMessageContent("   ").valid).toBe(false);
    expect(validateMessageContent(null).valid).toBe(false);
  });

  it("rejects content over the max length", () => {
    const res = validateMessageContent("x".repeat(MAX_MESSAGE_LENGTH + 1));
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/maximum length/);
  });

  it("accepts trimmed content at the limit", () => {
    const res = validateMessageContent(`  ${"a".repeat(MAX_MESSAGE_LENGTH)}  `);
    expect(res.valid).toBe(true);
    expect(res.content).toHaveLength(MAX_MESSAGE_LENGTH);
  });
});
