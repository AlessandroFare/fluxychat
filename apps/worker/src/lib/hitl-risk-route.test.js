import { describe, expect, it } from "vitest";
import { routeHitlRisk } from "./hitl-risk-route.js";

describe("routeHitlRisk", () => {
  it("marks destructive tools high", () => {
    expect(routeHitlRisk({ toolName: "deleteFile" }).tier).toBe("high");
    expect(routeHitlRisk({ toolName: "search" }).tier).toBe("low");
    expect(routeHitlRisk({ toolName: "sendEmail" }).tier).toBe("medium");
  });
});
