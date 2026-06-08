import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStreamingEditBatcher } from "./streaming-edit-batcher";

describe("createStreamingEditBatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("merges streaming edits for the same message id", () => {
    const applied: { id: number; content: string }[] = [];
    const batcher = createStreamingEditBatcher((updates) => {
      for (const u of updates) applied.push({ id: u.id, content: u.content });
    });

    batcher.push({
      id: 1,
      content: "a",
      editedAt: "t1",
      streaming: true,
    });
    batcher.push({
      id: 1,
      content: "ab",
      editedAt: "t2",
      streaming: true,
    });

    vi.advanceTimersByTime(80);
    expect(applied).toEqual([{ id: 1, content: "ab" }]);
  });

  it("flush applies immediately", () => {
    const applied: string[] = [];
    const batcher = createStreamingEditBatcher((updates) => {
      applied.push(updates.map((u) => u.content).join(","));
    });

    batcher.push({
      id: 2,
      content: "x",
      editedAt: "t",
      streaming: true,
    });
    batcher.flush();
    expect(applied).toEqual(["x"]);
  });
});
