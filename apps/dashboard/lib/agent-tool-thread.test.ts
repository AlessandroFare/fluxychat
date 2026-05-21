import { describe, expect, it } from "vitest";
import { toolCallsToThreadEvents } from "./agent-tool-thread";

describe("toolCallsToThreadEvents", () => {
  it("expands call + result pairs", () => {
    const events = toolCallsToThreadEvents("run-1", [
      {
        id: "tc1",
        name: "ping",
        arguments: "{}",
        success: true,
        resultPreview: '{"ok":true}',
      },
    ]);
    expect(events).toHaveLength(2);
    expect(events[0]?.kind).toBe("tool_call");
    expect(events[1]?.kind).toBe("tool_result");
  });

  it("expands call + error on failure", () => {
    const events = toolCallsToThreadEvents("run-2", [
      {
        id: "tc2",
        name: "fail",
        arguments: "{}",
        success: false,
        resultPreview: "timeout",
      },
    ]);
    expect(events[1]?.kind).toBe("tool_error");
  });
});
