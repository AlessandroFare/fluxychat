import { describe, expect, it } from "vitest";
import { scoreIoTReadings } from "./fluxy-iot.js";

describe("scoreIoTReadings", () => {
  it("returns empty health when there are no samples", () => {
    const out = scoreIoTReadings([]);
    expect(out.sampleSize).toBe(0);
    expect(out.health).toBe(100);
    expect(out.alerts).toEqual([]);
  });

  it("flags a spike when the last reading is far from the mean", () => {
    const out = scoreIoTReadings([10, 10, 10, 10, 10, 40]);
    expect(out.sampleSize).toBe(6);
    expect(out.alerts).toContain("spike");
    expect(out.health).toBeLessThan(100);
  });

  it("flags a trend on a steep slope", () => {
    const out = scoreIoTReadings([1, 2, 3, 4, 5, 20]);
    expect(out.alerts.length).toBeGreaterThan(0);
    expect(out.slope).not.toBe(0);
  });
});
