import { describe, expect, it } from "vitest";
import {
  compactResearchUserMessage,
  detectResearchMode,
  extractResearchQuery,
  isLocalhostUrl,
  resolveWebSearchProviders,
  sanitizeSearchQuery,
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
    expect(extractResearchQuery("@assistant [web-search] how is the weather now in kilimanjaro?")).toBe(
      "how is the weather now in kilimanjaro?",
    );
  });

  it("compacts long research prompts before the LLM", () => {
    const long =
      "@assistant [web-search] Search the web for current, factual information about: kilimanjaro weather. Summarize findings, cite sources with URLs when possible, and note when information may be outdated.";
    expect(compactResearchUserMessage(long)).toBe("[web-search] kilimanjaro weather");
  });

  it("strips PII before the query leaves the worker", () => {
    expect(
      sanitizeSearchQuery("email me at ada@fluxychat.com about pricing token=eyJhbGciOiJIUzI1NiJ9.aaa.bbb"),
    ).not.toMatch(/@|eyJ/);
    expect(sanitizeSearchQuery("FluxyChat pricing")).toBe("FluxyChat pricing");
  });

  it("defaults provider chain to wikipedia first", () => {
    expect(resolveWebSearchProviders({})).toEqual(["wikipedia", "brave", "tavily", "searxng"]);
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
