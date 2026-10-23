import { describe, expect, it } from "vitest";
import { compileSafeRegex, isSafeRegexPattern } from "./safe-regex.js";

describe("safe-regex (audit F-51)", () => {
  it("accepts ordinary configured patterns", () => {
    expect(isSafeRegexPattern("urgent")).toBe(true);
    expect(isSafeRegexPattern("incident\\.opened")).toBe(true);
    expect(compileSafeRegex("outage", "i") instanceof RegExp).toBe(true);
  });

  it("rejects catastrophic patterns", () => {
    expect(isSafeRegexPattern("(a+)+$")).toBe(false);
    expect(isSafeRegexPattern("(a|a)*$")).toBe(false);
    expect(isSafeRegexPattern("a*+")).toBe(false);
    expect(isSafeRegexPattern("(\\w+)+@")).toBe(false);
    expect(isSafeRegexPattern("(a)\\1{10}")).toBe(false);
    expect(compileSafeRegex("(a+)+$")).toBeNull();
  });

  it("rejects over-long and invalid patterns", () => {
    expect(isSafeRegexPattern("a".repeat(201))).toBe(false);
    expect(compileSafeRegex("[")).toBeNull();
    expect(isSafeRegexPattern("")).toBe(false);
  });
});
