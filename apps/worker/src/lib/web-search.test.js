import { describe, expect, it } from "vitest";
import { detectResearchMode, extractResearchQuery } from "./web-search.js";

describe("web-search helpers", () => {
  it("detects web-search mode", () => {
    expect(detectResearchMode("@bot [web-search] find news")).toBe("web-search");
    expect(detectResearchMode("hello")).toBeNull();
  });

  it("extracts query from composer prompt", () => {
    const prompt =
      "@groq [web-search] Search the web for current, factual information about: FluxyChat pricing. Summarize findings";
    expect(extractResearchQuery(prompt)).toBe("FluxyChat pricing");
  });
});
