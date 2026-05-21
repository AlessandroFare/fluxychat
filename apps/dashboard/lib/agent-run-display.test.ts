import { describe, expect, it } from "vitest";
import { normalizeAgentRun, parseToolCallsJson } from "./agent-run-display";

describe("agent-run-display", () => {
  it("parses tool_calls_json string", () => {
    const calls = parseToolCallsJson(
      '[{"id":"tc1","name":"search","arguments":"{\\"q\\":\\"x\\"}"}]',
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("search");
  });

  it("normalizes snake_case run row", () => {
    const run = normalizeAgentRun({
      id: "run-1",
      status: "completed",
      latency_ms: 120,
      tool_calls_json: '[{"id":"a","name":"ping","arguments":"{}"}]',
    });
    expect(run.latency_ms).toBe(120);
    expect(run.tool_calls).toHaveLength(1);
  });
});
