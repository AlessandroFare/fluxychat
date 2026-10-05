import { describe, expect, it } from "vitest";
import { A2UI_CATALOG, A2UI_CATALOG_VERSION } from "./a2ui";

describe("a2ui catalog", () => {
  it("does not include iframe or script types", () => {
    expect(A2UI_CATALOG_VERSION).toBe("0.9");
    expect(A2UI_CATALOG).not.toHaveProperty("iframe");
    expect(A2UI_CATALOG.Button.interactive).toBe(true);
  });
});
