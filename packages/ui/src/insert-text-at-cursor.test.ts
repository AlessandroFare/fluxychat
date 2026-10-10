import { describe, expect, it } from "vitest";
import { insertTextAtCursor } from "./insert-text-at-cursor";

describe("insertTextAtCursor", () => {
  it("appends when there is no element", () => {
    expect(insertTextAtCursor(null, "hi", "🎉")).toEqual({
      next: "hi🎉",
      caret: "hi🎉".length,
    });
  });
});
