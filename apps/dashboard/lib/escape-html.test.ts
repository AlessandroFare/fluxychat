import { describe, expect, it } from "vitest";
import { escapeHtml, highlightSearchSnippet } from "./escape-html";

describe("escape-html", () => {
  it("escapes HTML metacharacters", () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      "&lt;img src=x onerror=alert(1)&gt;",
    );
  });

  it("highlights FTS markers after escaping", () => {
    expect(highlightSearchSnippet("hello [[world]] <b>")).toBe(
      "hello <mark>world</mark> &lt;b&gt;",
    );
  });
});
