import { describe, expect, it } from "vitest";
import { BUILTIN_PARSERS, createDataPartRegistry, parsePartialJSON } from "./data-parts";

describe("data part registry", () => {
  it("validates built-in tool calls", () => {
    const registry = createDataPartRegistry();
    registry.register(BUILTIN_PARSERS["tool-call"]);
    expect(registry.parse("tool-call", { toolCallId: "1", toolName: "search", args: { q: "x" } })).toEqual({
      toolCallId: "1", toolName: "search", args: { q: "x" },
    });
    expect(registry.parse("tool-call", { toolCallId: 1 })).toBeNull();
  });

  it("returns null for unknown and throwing parsers", () => {
    const registry = createDataPartRegistry();
    expect(registry.parse("unknown", {})).toBeNull();
    registry.register({ type: "broken", parse: () => { throw new Error("bad"); }, serialize: () => null });
    expect(registry.parse("broken", {})).toBeNull();
  });
});

describe("parsePartialJSON", () => {
  it("repairs incomplete objects, arrays and strings", () => {
    expect(parsePartialJSON('{"user":{"name":"Ada')).toEqual({ user: { name: "Ada" } });
    expect(parsePartialJSON<{ values: number[] }>('{"values":[1,2')).toEqual({ values: [1, 2] });
  });

  it("rejects structurally invalid input", () => {
    expect(parsePartialJSON("not json")).toBeNull();
    expect(parsePartialJSON("{]" )).toBeNull();
  });
});
