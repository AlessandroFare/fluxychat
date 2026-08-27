import { describe, expect, it } from "vitest";
import { DERIVED_MAX_BYTES, sanitizeDerivedState } from "./room-derived.js";

describe("room-derived", () => {
  it("accepts a small object", () => {
    expect(sanitizeDerivedState({ score: 3, turn: "ada" })).toEqual({
      ok: true,
      state: { score: 3, turn: "ada" },
    });
  });

  it("clears on null", () => {
    expect(sanitizeDerivedState(null)).toEqual({ ok: true, state: {} });
  });

  it("rejects arrays and oversized payloads", () => {
    expect(sanitizeDerivedState([1, 2]).ok).toBe(false);
    expect(sanitizeDerivedState({ blob: "x".repeat(DERIVED_MAX_BYTES) }).ok).toBe(false);
  });
});
