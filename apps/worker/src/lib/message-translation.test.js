import { describe, it, expect } from "vitest";
import { normalizeTargetLang } from "./message-translation.js";

describe("message-translation", () => {
  it("normalizes language codes", () => {
    expect(normalizeTargetLang("it")).toBe("it");
    expect(normalizeTargetLang("en-US")).toBe("en");
    expect(normalizeTargetLang("invalid")).toBe(null);
  });
});
