import { describe, expect, it } from "vitest";
import {
  isSideEffectTool,
  mergeToolArguments,
  parseToolCallsJson,
} from "./counterfactual-replay.js";

describe("counterfactual-replay helpers", () => {
  it("detects side-effect tool names", () => {
    expect(isSideEffectTool("send_email")).toBe(true);
    expect(isSideEffectTool("create_invoice")).toBe(true);
    expect(isSideEffectTool("search_docs")).toBe(false);
  });

  it("merges tool argument patches", () => {
    expect(mergeToolArguments({ a: 1, b: 2 }, { b: 9, c: 3 })).toEqual({ a: 1, b: 9, c: 3 });
  });

  it("parses tool_calls_json", () => {
    const calls = parseToolCallsJson('[{"id":"t1","name":"ping","arguments":"{}"}]');
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("ping");
  });
});
