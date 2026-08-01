import { describe, expect, it } from "vitest";
import {
  detectResearchMode,
  extractResearchQuery,
  isLocalhostUrl,
  resolveWebSearchProviders,
  searxngAuthHeader,
} from "./web-search.js";

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

  it("defaults provider chain to tavily, searxng", () => {
    expect(resolveWebSearchProviders({})).toEqual(["tavily", "searxng"]);
    expect(resolveWebSearchProviders({ WEB_SEARCH_PROVIDER: "searxng,tavily" })).toEqual([
      "searxng",
      "tavily",
    ]);
  });

  it("detects localhost SearXNG URLs", () => {
    expect(isLocalhostUrl("http://127.0.0.1:8888")).toBe(true);
    expect(isLocalhostUrl("https://searxng.fluxychat.com")).toBe(false);
  });

  it("builds SearXNG Basic Auth header", () => {
    expect(searxngAuthHeader({})).toBeNull();
    expect(searxngAuthHeader({
      SEARXNG_BASIC_AUTH_USER: "fluxyagent",
      SEARXNG_BASIC_AUTH_PASS: "secret",
    })).toBe(`Basic ${btoa("fluxyagent:secret")}`);
  });
});
