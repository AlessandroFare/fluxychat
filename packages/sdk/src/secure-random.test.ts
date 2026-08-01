import { describe, expect, it } from "vitest";
import { secureRandomInt, secureRandomIntInRange } from "./secure-random";

describe("secureRandomInt", () => {
  it("returns 0 for invalid max", () => {
    expect(secureRandomInt(0)).toBe(0);
    expect(secureRandomInt(-1)).toBe(0);
  });

  it("returns values in [0, maxExclusive)", () => {
    for (let i = 0; i < 50; i++) {
      const value = secureRandomInt(7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
  });
});

describe("secureRandomIntInRange", () => {
  it("returns values in [min, max)", () => {
    for (let i = 0; i < 50; i++) {
      const value = secureRandomIntInRange(200, 1000);
      expect(value).toBeGreaterThanOrEqual(200);
      expect(value).toBeLessThan(1000);
    }
  });
});
