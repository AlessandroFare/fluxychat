import { describe, expect, it, vi } from "vitest";

vi.mock("@fluxy-chat/ui", () => ({ Cursor: () => null }));
vi.mock("~/components/marketing/spotlight-card", () => ({ SpotlightCard: () => null }));

import { HOMEPAGE_EXAMPLES } from "./landing-build-gallery";

describe("HOMEPAGE_EXAMPLES", () => {
  it("leads with live cursors and keeps one distinct preview per example", () => {
    expect(HOMEPAGE_EXAMPLES.map((e) => e.preview)).toEqual(["cursors", "war", "shared", "deal"]);
  });
});
