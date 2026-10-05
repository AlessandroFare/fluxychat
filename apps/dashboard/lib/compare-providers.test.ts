import { describe, expect, it } from "vitest";
import { COMPARE_ROWS, LANDING_COMPARE_ROWS } from "./compare-providers";

describe("landing compare rows", () => {
  it("keeps HITL and drops cursors from the homepage table", () => {
    const labels = LANDING_COMPARE_ROWS.map((row) => row.label);
    expect(labels).toContain("Tool approvals");
    expect(labels).toContain("Agent on the room timeline");
    expect(labels).not.toContain("Cursors on the same room");
    expect(labels).not.toContain("HTTP device ingest");
    expect(COMPARE_ROWS.some((row) => row.label === "Cursors on the same room")).toBe(true);
    expect(LANDING_COMPARE_ROWS).toHaveLength(7);
  });
});
