import { describe, it, expect } from "vitest";
import { createAgUiAdapter, mergeAgUiTextParts } from "./ag-ui-adapter";
import { createTextPart } from "./generative-ui";

describe("ag-ui-adapter", () => {
  it("accumulates text deltas into one text part", () => {
    const adapter = createAgUiAdapter();
    let state = adapter.createRun("run-1");
    state = adapter.applyEvent(state, { type: "text_delta", delta: "Hello " });
    state = adapter.applyEvent(state, { type: "text_delta", delta: "world" });
    expect(state.parts).toHaveLength(1);
    expect(state.parts[0]).toEqual({ type: "text", text: "Hello world" });
  });

  it("maps tool call and result", () => {
    const adapter = createAgUiAdapter();
    let state = adapter.createRun("run-2");
    state = adapter.applyEvent(state, {
      type: "tool_call",
      toolName: "search",
      toolCallId: "c1",
      args: { q: "fluxy" },
    });
    state = adapter.applyEvent(state, {
      type: "tool_result",
      toolName: "search",
      toolCallId: "c1",
      output: { hits: 1 },
    });
    expect(state.parts).toHaveLength(2);
    expect(state.parts[1].type).toBe("tool-search");
  });

  it("preserves unknown events", () => {
    const adapter = createAgUiAdapter();
    let state = adapter.createRun("run-3");
    state = adapter.applyEvent(state, { type: "custom_ping", payload: 1 });
    expect(state.unknownEvents).toHaveLength(1);
  });

  it("round-trips parts to events", () => {
    const adapter = createAgUiAdapter();
    const parts = mergeAgUiTextParts([createTextPart("Hi"), createTextPart(" there")]);
    const events = adapter.partsToEvents(parts);
    expect(events[0]).toMatchObject({ type: "text_delta", delta: "Hi there" });
  });
});
