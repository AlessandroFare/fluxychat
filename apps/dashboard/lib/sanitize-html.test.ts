import { describe, expect, it } from "vitest";
import { sanitizeHtmlFragment } from "./sanitize-html";

describe("sanitizeHtmlFragment", () => {
  it("strips scripts and event handlers", () => {
    const html = `<p onclick="alert(1)">ok</p><script>alert(2)</script>`;
    const out = sanitizeHtmlFragment(html);
    expect(out.toLowerCase()).not.toContain("script");
    expect(out.toLowerCase()).not.toContain("onclick");
    expect(out).toContain("ok");
  });
});
