import { describe, expect, it } from "vitest";
import { routeHitlRisk } from "./hitl-risk-route";

describe("routeHitlRisk", () => {
  it("classifies delete vs search", () => {
    expect(routeHitlRisk("deleteFile").tier).toBe("high");
    expect(routeHitlRisk("searchDocs").tier).toBe("low");
  });
});
