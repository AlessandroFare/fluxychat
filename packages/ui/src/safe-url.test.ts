import { describe, it, expect } from "vitest";
import { safeHttpUrl } from "./safe-url";

describe("safeHttpUrl", () => {
  it("allows http and https URLs", () => {
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com");
    expect(safeHttpUrl("https://example.com/path?q=1")).toBe(
      "https://example.com/path?q=1",
    );
  });

  it("allows mailto URLs", () => {
    expect(safeHttpUrl("mailto:a@b.com")).toBe("mailto:a@b.com");
  });

  it("allows relative and protocol-relative URLs", () => {
    expect(safeHttpUrl("/attachments/abc")).toBe("/attachments/abc");
    expect(safeHttpUrl("./img.png")).toBe("./img.png");
    expect(safeHttpUrl("img.png")).toBe("img.png");
    expect(safeHttpUrl("//cdn.example.com/x.png")).toBe("//cdn.example.com/x.png");
  });

  it("blocks javascript: scheme (XSS vector)", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("JavaScript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("  javascript:alert(1)")).toBeUndefined();
  });

  it("blocks data:, vbscript: and file: schemes", () => {
    expect(safeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(safeHttpUrl("vbscript:msgbox(1)")).toBeUndefined();
    expect(safeHttpUrl("file:///etc/passwd")).toBeUndefined();
  });

  it("blocks control-character obfuscation", () => {
    expect(safeHttpUrl("java\nscript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("java\tscript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("\u0000https://example.com")).toBeUndefined();
  });

  it("handles non-string and empty input", () => {
    expect(safeHttpUrl(undefined)).toBeUndefined();
    expect(safeHttpUrl(null)).toBeUndefined();
    expect(safeHttpUrl(123)).toBeUndefined();
    expect(safeHttpUrl("")).toBeUndefined();
    expect(safeHttpUrl("   ")).toBeUndefined();
  });
});
