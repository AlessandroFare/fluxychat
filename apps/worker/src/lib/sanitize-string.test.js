import { describe, expect, it } from "vitest";
import { sanitizeString } from "./sanitize-string.js";

describe("sanitizeString", () => {
  it("strips control characters and truncates", () => {
    expect(sanitizeString("hello\u0000world", 8)).toBe("hellowor");
    expect(sanitizeString("  room-1  ", 128)).toBe("room-1");
  });
});
