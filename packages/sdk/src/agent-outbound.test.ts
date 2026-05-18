import { describe, expect, it } from "vitest";
import {
  buildAgentOutboundWsPayload,
  validateAgentOutboundMessage,
} from "./agent-outbound";

describe("validateAgentOutboundMessage", () => {
  it("accepts trimmed content within limits", () => {
    const result = validateAgentOutboundMessage({
      userId: "agent-1",
      content: "  hello  ",
    });
    expect(result.valid).toBe(true);
    expect(result.content).toBe("hello");
  });

  it("rejects empty content", () => {
    const result = validateAgentOutboundMessage({
      userId: "agent-1",
      content: "   ",
    });
    expect(result.valid).toBe(false);
  });

  it("buildAgentOutboundWsPayload throws on invalid input", () => {
    expect(() =>
      buildAgentOutboundWsPayload({ userId: "", content: "hi" }),
    ).toThrow();
  });
});
