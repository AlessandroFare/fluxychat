import { describe, expect, it } from "vitest";
import { classifyContentLabels } from "./moderation-labels.js";

describe("classifyContentLabels", () => {
  it("detects pii and profanity patterns", () => {
    const result = classifyContentLabels("Contact me at test@example.com you bastard");
    expect(result.labels).toContain("pii");
    expect(result.labels).toContain("profanity");
    expect(result.severity).not.toBe("none");
  });

  it("returns none for empty content", () => {
    expect(classifyContentLabels("   ").labels).toEqual([]);
  });
});
