import { describe, expect, it } from "vitest";
import { evalJsonLogic } from "./ops-jsonlogic.js";

describe("ops-jsonlogic", () => {
  it("compares numbers and vars", () => {
    expect(evalJsonLogic({ ">": [{ var: "total" }, 5000] }, { total: 9000 })).toBe(true);
    expect(evalJsonLogic({ "==": [{ var: "differences.length" }, 0] }, { differences: [] })).toBe(true);
  });

  it("rejects eval-like operators", () => {
    expect(() => evalJsonLogic({ eval: "1+1" }, {})).toThrow(/forbidden/);
  });
});
