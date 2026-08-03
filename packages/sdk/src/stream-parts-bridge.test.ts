import { describe, expect, it } from "vitest";
import {
  agentStreamPartToCanonical,
  canonicalStreamPartToAgUiEvent,
  canonicalStreamPartsToDisplay,
  mergeCanonicalTextDeltas,
  uiPartsToCanonicalStreamParts,
} from "./stream-parts-bridge";
import { createTextPart, createToolCallPart } from "./generative-ui";

describe("stream-parts-bridge", () => {
  it("maps agent text-delta to canonical and AG-UI", () => {
    const canonical = agentStreamPartToCanonical({ type: "text-delta", delta: "Hi" });
    expect(canonical).toEqual({ type: "text-delta", delta: "Hi", id: undefined });
    const event = canonicalStreamPartToAgUiEvent(canonical!);
    expect(event).toMatchObject({ type: "text_delta", delta: "Hi" });
  });

  it("merges consecutive text deltas", () => {
    const merged = mergeCanonicalTextDeltas([
      { type: "text-delta", delta: "Hello " },
      { type: "text-delta", delta: "world" },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ delta: "Hello world" });
  });

  it("round-trips UI parts through canonical form", () => {
    const parts = [createTextPart("Done"), createToolCallPart("search", "c1", { q: "x" })];
    const canonical = uiPartsToCanonicalStreamParts(parts);
    const { text } = canonicalStreamPartsToDisplay(canonical);
    expect(text).toBe("Done");
    expect(canonical.some((p) => p.type === "tool-input-available")).toBe(true);
  });
});
