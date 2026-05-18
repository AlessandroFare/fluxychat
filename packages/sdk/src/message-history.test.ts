import { describe, expect, it } from "vitest";
import {
  clampHistoryLimit,
  mergeMessagesChronological,
  sortMessagesChronological,
} from "./message-history";

describe("message-history", () => {
  it("sortMessagesChronological orders by createdAt ascending", () => {
    const sorted = sortMessagesChronological([
      { id: 2, createdAt: "2026-01-02T00:00:00.000Z" },
      { id: 1, createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
    expect(sorted.map((m) => m.id)).toEqual([1, 2]);
  });

  it("mergeMessagesChronological dedupes by id (current list wins)", () => {
    const merged = mergeMessagesChronological(
      [{ id: 1, createdAt: "2026-01-01T00:00:00.000Z", content: "current" }],
      [{ id: 1, createdAt: "2026-01-01T00:00:00.000Z", content: "older-page" }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.content).toBe("current");
  });

  it("clampHistoryLimit enforces bounds", () => {
    expect(clampHistoryLimit()).toBe(50);
    expect(clampHistoryLimit(0)).toBe(50);
    expect(clampHistoryLimit(9999)).toBe(500);
  });
});
