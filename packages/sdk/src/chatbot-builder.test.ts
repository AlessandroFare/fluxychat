import { describe, expect, it } from "vitest";
import { createChatbotBuilder } from "./chatbot-builder";

describe("chatbot-builder", () => {
  it("skips actions when conditions fail", async () => {
    const builder = createChatbotBuilder();
    builder.addRule({
      name: "vip-only",
      trigger: { type: "message_received" },
      conditions: [{ field: "role", operator: "eq", value: "vip" }],
      actions: [{ type: "send_message", params: { text: "hi" } }],
      enabled: true,
      priority: 1,
    });
    const missed = await builder.evaluateTrigger({ type: "message_received" }, { role: "guest" });
    expect(missed[0].matchedConditions).toBe(false);
    expect(missed[0].executedActions).toEqual([]);
    const hit = await builder.evaluateTrigger({ type: "message_received" }, { role: "vip" });
    expect(hit[0].matchedConditions).toBe(true);
    expect(hit[0].executedActions).toHaveLength(1);
  });
});
