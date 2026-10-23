import { describe, expect, it } from "vitest";
import { OPS_NAMED_VIEWS, catalogNamedViews, namedViewByName } from "./ops-policy.js";

// Catalog lint (Wren-style): a named view with a missing description, column
// list or synonyms silently degrades the lookup prompt and the view errors.
describe("OPS_NAMED_VIEWS catalog", () => {
  it("has complete, unique view metadata", () => {
    const names = new Set();
    for (const view of OPS_NAMED_VIEWS) {
      expect(view.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(names.has(view.name)).toBe(false);
      names.add(view.name);
      expect(String(view.description || "").trim().length).toBeGreaterThan(0);
      expect(Array.isArray(view.columns) && view.columns.length).toBeGreaterThan(0);
      expect(view.columns.every((col) => typeof col === "string" && col.trim().length > 0)).toBe(true);
      expect(Array.isArray(view.synonyms) && view.synonyms.length).toBeGreaterThan(0);
      expect(view.synonyms.every((word) => typeof word === "string" && word.trim().length > 0)).toBe(true);
      expect(Array.isArray(view.joins)).toBe(true);
    }
  });

  it("filters the catalog by policy and resolves views by name", () => {
    expect(catalogNamedViews({ allowedViews: ["orders"] }).map((view) => view.name)).toEqual(["orders"]);
    expect(namedViewByName("orders")?.name).toBe("orders");
    expect(namedViewByName("nope")).toBeNull();
  });
});
