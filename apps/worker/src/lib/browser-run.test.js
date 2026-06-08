import { describe, expect, it } from "vitest";
import {
  browserMarkdownForUrl,
  browserOgPreview,
  isBrowserRunConfigured,
} from "./browser-run.js";

describe("browser-run", () => {
  it("detects BROWSER binding", () => {
    expect(isBrowserRunConfigured({})).toBe(false);
    expect(
      isBrowserRunConfigured({ BROWSER: { quickAction: async () => "# Title" } }),
    ).toBe(true);
  });

  it("browserOgPreview parses markdown title and description", async () => {
    const env = {
      BROWSER: {
        quickAction: async () =>
          "# Example Site\n\nA short description of the page.\n\n![og](https://cdn.example/og.png)",
      },
    };
    const preview = await browserOgPreview(env, "https://example.com/post");
    expect(preview?.title).toBe("Example Site");
    expect(preview?.description).toBe("A short description of the page.");
    expect(preview?.imageUrl).toBe("https://cdn.example/og.png");
    expect(preview?.source).toBe("browser_run");
  });

  it("blocks private URLs", async () => {
    const env = {
      BROWSER: { quickAction: async () => "x" },
    };
    const res = await browserMarkdownForUrl(env, "http://127.0.0.1/admin");
    expect(res.ok).toBe(false);
    expect(res.error).toBe("ssrf_blocked");
  });
});
