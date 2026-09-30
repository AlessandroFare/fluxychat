import { describe, expect, it } from "vitest";
import { VERTICAL_LANDINGS, verticalLandingBySlug } from "./vertical-landing";

describe("vertical-landing", () => {
  it("has incident, support, and pr-review", () => {
    expect(VERTICAL_LANDINGS.map((p) => p.slug)).toEqual(["incident", "support", "pr-review"]);
    expect(verticalLandingBySlug("support")?.scaffold).toContain("shared-ai-room");
  });
});
