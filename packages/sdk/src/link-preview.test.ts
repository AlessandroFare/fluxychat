import { describe, it, expect } from "vitest";
import { createLinkPreview, linkPreviewFromData } from "./link-preview";

describe("createLinkPreview", () => {
  it("extracts links from text", () => {
    const api = createLinkPreview();
    const links = api.extractLinks("Check https://example.com and http://test.com/page");
    expect(links).toEqual(["https://example.com", "http://test.com/page"]);
  });

  it("returns deduplicated links", () => {
    const api = createLinkPreview();
    const links = api.extractLinks("https://example.com and https://example.com");
    expect(links).toEqual(["https://example.com"]);
  });

  it("fetchMessage returns cached result", async () => {
    const api = createLinkPreview();
    const first = await api.fetchMessage("https://example.com");
    expect(first?.url).toBe("https://example.com");
    const second = await api.fetchMessage("https://example.com");
    expect(second?.title).toBe(first?.title);
  });

  it("returns empty array for text without links", () => {
    const api = createLinkPreview();
    expect(api.extractLinks("no links here")).toEqual([]);
  });
});

describe("linkPreviewFromData", () => {
  it("creates preview with minimal data", () => {
    const p = linkPreviewFromData({ url: "https://example.com" });
    expect(p.url).toBe("https://example.com");
  });

  it("includes optional fields", () => {
    const p = linkPreviewFromData({ url: "https://example.com", title: "Example", description: "desc" });
    expect(p.title).toBe("Example");
    expect(p.description).toBe("desc");
  });
});
