import { describe, expect, it } from "vitest";
import {
  applyLocationPrivacy,
  roundLocationCoordinates,
} from "./location-privacy";

describe("location-privacy", () => {
  it("rounds coordinates to grid", () => {
    const { latitude, longitude } = roundLocationCoordinates(45.123456, 9.123456, 50);
    expect(latitude).not.toBe(45.123456);
    expect(longitude).not.toBe(9.123456);
    expect(Math.abs(latitude - 45.123456)).toBeLessThan(0.001);
  });

  it("drops telemetry when accuracy is too poor", () => {
    const result = applyLocationPrivacy(
      { latitude: 45, longitude: 9, accuracy: 2000 },
      { maxAccuracyMeters: 500 },
    );
    expect(result).toBeNull();
  });

  it("returns sanitized telemetry when accuracy is acceptable", () => {
    const result = applyLocationPrivacy(
      { latitude: 45.111, longitude: 9.222, accuracy: 20 },
      { precisionMeters: 50, maxAccuracyMeters: 500 },
    );
    expect(result).not.toBeNull();
    expect(result!.accuracy).toBeGreaterThanOrEqual(50);
  });
});
