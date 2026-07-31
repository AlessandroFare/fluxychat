import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createStreamingEditBatcher,
  mergeStreamingEditIntoMessages,
} from "./streaming-edit-batcher";

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

  it("mergeStreamingEditIntoMessages upserts when message frame is not in store yet", () => {
    type Row = {
      id: number;
      roomId: string;
      userId: string;
      content: string;
      createdAt: string;
      streaming?: boolean;
    };
    const sort = (rows: Row[]) => rows;
    const next = mergeStreamingEditIntoMessages<Row>(
      [],
      {
        id: 42,
        roomId: "room-a",
        userId: "bot-1",
        content: "Hello fluxychat",
        editedAt: "2026-07-31T16:00:00.000Z",
        streaming: false,
      },
      sort,
    );
    expect(next).toEqual([
      {
        id: 42,
        roomId: "room-a",
        userId: "bot-1",
        content: "Hello fluxychat",
        createdAt: "2026-07-31T16:00:00.000Z",
        editedAt: "2026-07-31T16:00:00.000Z",
        streaming: false,
      },
    ]);
  });
});
