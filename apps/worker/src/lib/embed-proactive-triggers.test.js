import { describe, expect, it } from "vitest";
import {
  sanitizeProactiveTriggersInput,
  urlMatchesProactivePattern,
} from "./embed-proactive-triggers.js";

describe("embed-proactive-triggers", () => {
  it("matches path prefix patterns", () => {
    expect(urlMatchesProactivePattern("/pricing*", "https://acme.com/pricing/plans")).toBe(true);
    expect(urlMatchesProactivePattern("/pricing*", "https://acme.com/about")).toBe(false);
  });

  it("sanitizes trigger input", () => {
    const rules = sanitizeProactiveTriggersInput([
      { urlPattern: "/help", dwellSeconds: 15, message: "Need help?", autoOpen: true },
    ]);
    expect(rules[0].dwellSeconds).toBe(15);
    expect(rules[0].autoOpen).toBe(true);
  });
});
