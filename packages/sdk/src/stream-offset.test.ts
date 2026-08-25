import { describe, expect, it } from "vitest";
import { applyStreamTailToLocal } from "./stream-offset";

describe("applyStreamTailToLocal", () => {
  it("replaces when resumeFrom is missing", () => {
    expect(applyStreamTailToLocal("old", { content: "new" })).toBe("new");
  });

  it("splices a suffix at resumeFrom", () => {
    expect(applyStreamTailToLocal("hello ", { content: "world", resumeFrom: 6 })).toBe(
      "hello world",
    );
  });
});
