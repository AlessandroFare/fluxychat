import { describe, expect, it } from "vitest";
import { historyBoundParam } from "./history-bound";

describe("FX-HIST-6 historyBoundParam", () => {
  it("passes ISO through and converts epoch ms", () => {
    expect(historyBoundParam("2026-01-01T00:00:00.000Z")).toBe("2026-01-01T00:00:00.000Z");
    expect(historyBoundParam(Date.parse("2026-01-01T00:00:00.000Z"))).toBe("2026-01-01T00:00:00.000Z");
    expect(historyBoundParam(null)).toBeNull();
  });
});
