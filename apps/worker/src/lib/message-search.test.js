import { describe, expect, it } from "vitest";
import { sanitizeFtsQuery } from "./message-search.js";

describe("sanitizeFtsQuery", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitizeFtsQuery("  hello   world  ")).toBe("hello world");
  });

  it("strips risky operators", () => {
    expect(sanitizeFtsQuery('decision AND "quote" OR (bad)')).toBe('decision AND "quote" OR bad');
  });

  it("returns empty for blank input", () => {
    expect(sanitizeFtsQuery("   ")).toBe("");
  });
});
