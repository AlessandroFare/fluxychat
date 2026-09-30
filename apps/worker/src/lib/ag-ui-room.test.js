import { describe, expect, it } from "vitest";
import { agentRunToAgUiEvents, encodeAgUiSse } from "./ag-ui-room.js";

describe("ag-ui-room", () => {
  it("maps a run with tools to AG-UI events", () => {
    const events = agentRunToAgUiEvents({
      id: "run_1",
      agentId: "bot_1",
      roomId: "r1",
      status: "completed",
      latencyMs: 12,
      estimatedCost: 0.01,
      toolCalls: [{ id: "c1", name: "search", arguments: { q: "sku" }, result: { hits: 1 } }],
    });
    expect(events[0].type).toBe("RUN_STARTED");
    expect(events.some((e) => e.type === "TOOL_CALL_START")).toBe(true);
    expect(events.at(-1).type).toBe("RUN_FINISHED");
  });

  it("encodes SSE frames", () => {
    const sse = encodeAgUiSse([{ type: "RUN_STARTED", runId: "a" }]);
    expect(sse).toContain("data: {");
    expect(sse).toContain("[DONE]");
  });
});
