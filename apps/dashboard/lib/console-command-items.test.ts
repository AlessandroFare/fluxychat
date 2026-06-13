import { describe, expect, it } from "vitest";
import {
  buildConsoleCommandItems,
  filterConsoleCommandItems,
  groupConsoleCommandItems,
} from "./console-command-items";

describe("console-command-items", () => {
  const items = buildConsoleCommandItems("/onboarding");

  it("includes main nav routes", () => {
    expect(items.some((item) => item.label === "Rooms" && item.href === "/rooms")).toBe(true);
    expect(items.some((item) => item.label === "Quickstart" && item.href === "/onboarding")).toBe(
      true,
    );
  });

  it("filters by label and keywords", () => {
    const filtered = filterConsoleCommandItems(items, "billing");
    expect(filtered.some((item) => item.label === "Billing")).toBe(true);
    expect(filtered.every((item) => itemHaystackIncludes(item, "billing"))).toBe(true);
  });

  it("supports multi-token search", () => {
    const filtered = filterConsoleCommandItems(items, "copy worker");
    expect(filtered.some((item) => item.action === "copy-worker-url")).toBe(true);
  });

  it("groups items in stable order", () => {
    const grouped = groupConsoleCommandItems(items);
    expect(grouped[0]?.group).toBe("Navigate");
    expect(grouped.some((section) => section.group === "Actions")).toBe(true);
  });
});

function itemHaystackIncludes(
  item: ReturnType<typeof buildConsoleCommandItems>[number],
  token: string,
): boolean {
  const haystack = [
    item.label,
    item.description,
    ...(item.keywords ?? []),
    item.href ?? "",
    item.action ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(token);
}
