import { describe, expect, it } from "vitest";
import { sanitizeFtsQuery, toFtsMatchQuery } from "./message-search.js";

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

describe("toFtsMatchQuery", () => {
  it("quotes terms so an unbalanced quote cannot break FTS5 (audit F-91)", () => {
    expect(toFtsMatchQuery('say "hi')).toBe('"say" "hi"');
    expect(toFtsMatchQuery('decision AND "quote"')).toBe('"decision" AND "quote"');
  });

  it("returns empty for blank input", () => {
    expect(toFtsMatchQuery("")).toBe("");
    expect(toFtsMatchQuery('  ""  ')).toBe("");
  });
});
