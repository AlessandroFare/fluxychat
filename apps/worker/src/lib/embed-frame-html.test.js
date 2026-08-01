import { describe, expect, it } from "vitest";
import { buildEmbedFrameHtml } from "./embed-frame-html.js";

describe("buildEmbedFrameHtml", () => {
  it("includes streaming edit handler for agent bubbles", () => {
    const html = buildEmbedFrameHtml({ primaryColor: "#2563eb", launcherTitle: "Support" });
    expect(html).toContain('data.type === "edit"');
    expect(html).toContain("data-streaming");
    expect(html).toContain("msg-body");
  });

  it("escapes launcher title", () => {
    const html = buildEmbedFrameHtml({ launcherTitle: '<script>alert(1)</script>' });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
