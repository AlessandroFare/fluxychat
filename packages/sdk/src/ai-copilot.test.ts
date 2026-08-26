import { describe, expect, it } from "vitest";
import { mockCopilotReply, serializeKnowledge } from "./ai-copilot";

describe("ai copilot mock", () => {
  it("includes knowledge and tools without claiming HIPAA", () => {
    const reply = mockCopilotReply({
      userText: "What is selected?",
      knowledge: [{ name: "selection", value: { x: 1 } }],
      tools: [{ name: "highlight" }],
    });
    expect(reply).toContain("Keyless copilot mock");
    expect(reply).toContain("selection");
    expect(reply).toContain("highlight");
    expect(reply).not.toMatch(/HIPAA|MQTT/i);
  });

  it("caps serialized knowledge", () => {
    const blob = serializeKnowledge([{ name: "doc", value: "a".repeat(5000) }]);
    expect(blob.length).toBeLessThan(2100);
  });
});
