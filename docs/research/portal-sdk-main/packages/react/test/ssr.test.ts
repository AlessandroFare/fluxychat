// @vitest-environment node
// Runs in node (no jsdom) so window/document are genuinely absent — the SSR / RSC condition.
import { describe, expect, it } from "vitest";

import { assertBrowser } from "../src/ssr.js";

describe("client-only guard", () => {
  it("throws loudly when window/document are absent (SSR or a Server Component)", () => {
    expect(typeof window).toBe("undefined");
    expect(() => assertBrowser()).toThrow(/client-only/);
  });
});
