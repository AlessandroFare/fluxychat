import { describe, it, expect } from "vitest";
import { safeUrl } from "./safe-url";

describe("safeUrl", () => {
  it("allows http and https URLs", () => {
    expect(safeUrl("http://example.com")).toBe("http://example.com");
    expect(safeUrl("https://example.com/path?q=1")).toBe(
      "https://example.com/path?q=1",
    );
  });

  it("allows mailto URLs", () => {
    expect(safeUrl("mailto:a@b.com")).toBe("mailto:a@b.com");
  });

  it("allows relative and protocol-relative URLs", () => {
    expect(safeUrl("/attachments/abc")).toBe("/attachments/abc");
    expect(safeUrl("./img.png")).toBe("./img.png");
    expect(safeUrl("img.png")).toBe("img.png");
    expect(safeUrl("//cdn.example.com/x.png")).toBe("//cdn.example.com/x.png");
  });

  it("blocks javascript: scheme (XSS vector)", () => {
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("JavaScript:alert(1)")).toBeUndefined();
    expect(safeUrl("  javascript:alert(1)")).toBeUndefined();
  });

  it("blocks data:, vbscript: and file: schemes", () => {
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(safeUrl("vbscript:msgbox(1)")).toBeUndefined();
    expect(safeUrl("file:///etc/passwd")).toBeUndefined();
  });

  it("blocks control-character obfuscation", () => {
    expect(safeUrl("java\nscript:alert(1)")).toBeUndefined();
    expect(safeUrl("java\tscript:alert(1)")).toBeUndefined();
    expect(safeUrl("\u0000https://example.com")).toBeUndefined();
  });

  it("handles non-string and empty input", () => {
    expect(safeUrl(undefined)).toBeUndefined();
    expect(safeUrl(null)).toBeUndefined();
    expect(safeUrl(123)).toBeUndefined();
    expect(safeUrl("")).toBeUndefined();
    expect(safeUrl("   ")).toBeUndefined();
  });
});
