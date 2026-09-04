import { describe, expect, it } from "vitest";
import { isMarketingPath } from "./hosted-product";
import { isMarketingRoute } from "./is-marketing-route";

describe("isMarketingPath / isMarketingRoute", () => {
  it("does not treat trust URLs as console (no ConsoleAuthGate)", () => {
    expect(isMarketingPath("/subprocessors")).toBe(true);
    expect(isMarketingRoute("/subprocessors")).toBe(true);
    expect(isMarketingPath("/health")).toBe(true);
    expect(isMarketingRoute("/health")).toBe(true);
  });

  it("still treats rooms as console", () => {
    expect(isMarketingPath("/rooms")).toBe(false);
    expect(isMarketingRoute("/rooms")).toBe(false);
  });
});
