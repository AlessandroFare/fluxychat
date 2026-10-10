import { describe, expect, it } from "vitest";
import { windowMessages } from "./window-messages";

describe("windowMessages", () => {
  it("returns the full list when under the cap", () => {
    expect(windowMessages([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });

  it("keeps the latest windowSize items", () => {
    expect(windowMessages([1, 2, 3, 4, 5], 3)).toEqual([3, 4, 5]);
  });

  it("does not cap when windowSize is omitted", () => {
    expect(windowMessages([1, 2, 3])).toEqual([1, 2, 3]);
  });
});
