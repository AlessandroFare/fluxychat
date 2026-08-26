import { describe, expect, it } from "vitest";
import {
  buildCursorOutbound,
  clampCursorCoordinate,
  parseLiveCursorEvent,
} from "./live-cursors";

describe("live cursors", () => {
  it("parses inbound cursor frames", () => {
    expect(
      parseLiveCursorEvent({
        type: "cursor",
        userId: "ada",
        x: 10,
        y: 20,
        label: "Ada",
      }),
    ).toMatchObject({ userId: "ada", x: 10, y: 20, label: "Ada" });
  });

  it("rejects invalid frames", () => {
    expect(parseLiveCursorEvent({ type: "typing" })).toBeNull();
    expect(parseLiveCursorEvent({ type: "cursor", userId: "ada" })).toBeNull();
  });

  it("builds a bounded outbound payload", () => {
    expect(buildCursorOutbound({ x: 1e9, y: -3, label: "x".repeat(80) })).toMatchObject({
      type: "cursor",
      x: 1e6,
      y: -3,
    });
    expect(String(buildCursorOutbound({ x: 0, y: 0, label: "x".repeat(80) }).label)).toHaveLength(64);
  });

  it("clamps non-finite coordinates", () => {
    expect(clampCursorCoordinate(Number.NaN)).toBe(0);
  });
});
