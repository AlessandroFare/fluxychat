import { describe, expect, it } from "vitest";
import { isMarketingPath } from "./hosted-product";
import { isMarketingRoute } from "./is-marketing-route";

describe("isMarketingPath / isMarketingRoute", () => {
  it("does not treat subprocessors as console (no ConsoleAuthGate)", () => {
    expect(isMarketingPath("/subprocessors")).toBe(true);
    expect(isMarketingRoute("/subprocessors")).toBe(true);
  });

  it("treats operator pages as console", () => {
    expect(isMarketingPath("/health")).toBe(false);
    expect(isMarketingRoute("/health")).toBe(false);
    expect(isMarketingPath("/privacy")).toBe(false);
    expect(isMarketingPath("/security")).toBe(false);
    expect(isMarketingPath("/soc2")).toBe(false);
    expect(isMarketingPath("/embed")).toBe(false);
    expect(isMarketingPath("/rooms")).toBe(false);
    expect(isMarketingRoute("/rooms")).toBe(false);
  });
});
