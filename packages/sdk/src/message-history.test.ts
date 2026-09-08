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

  it("mergeMessagesChronological dedupes by id (current list wins at equal length)", () => {
    const merged = mergeMessagesChronological(
      [{ id: 1, createdAt: "2026-01-01T00:00:00.000Z", content: "live-text" }],
      [{ id: 1, createdAt: "2026-01-01T00:00:00.000Z", content: "from-hist" }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.content).toBe("live-text");
  });

  it("mergeMessagesChronological does not let an empty streaming stub replace REST text", () => {
    const merged = mergeMessagesChronological(
      [{ id: 9, createdAt: "2026-01-01T00:00:00.000Z", content: "", streaming: true }],
      [{ id: 9, createdAt: "2026-01-01T00:00:00.000Z", content: "Agent finished this reply." }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.content).toBe("Agent finished this reply.");
    expect(merged[0]?.streaming).toBeUndefined();
  });

  it("mergeMessagesChronological keeps streamed tokens over an empty REST row", () => {
    const merged = mergeMessagesChronological(
      [{ id: 9, createdAt: "2026-01-01T00:00:00.000Z", content: "Hello from the agent", streaming: true }],
      [{ id: 9, createdAt: "2026-01-01T00:00:00.000Z", content: "" }],
    );
    expect(merged[0]?.content).toBe("Hello from the agent");
    expect(merged[0]?.streaming).toBe(true);
  });

  it("mergeMessagesChronological keeps poll and decision when incoming row omits them", () => {
    const merged = mergeMessagesChronological(
      [
        {
          id: 4,
          createdAt: "2026-01-01T00:00:00.000Z",
          content: "Vote",
          poll: { question: "Ready?", options: [], totalVoters: 0, closed: false },
        },
      ],
      [{ id: 4, createdAt: "2026-01-01T00:00:00.000Z", content: "Vote" }],
    );
    expect(merged[0]?.poll).toEqual({
      question: "Ready?",
      options: [],
      totalVoters: 0,
      closed: false,
    });
  });

  it("clampHistoryLimit enforces bounds", () => {
    expect(clampHistoryLimit()).toBe(50);
    expect(clampHistoryLimit(0)).toBe(50);
    expect(clampHistoryLimit(9999)).toBe(500);
  });
});
