import { describe, expect, it } from "vitest";
import { appendCommentToThreads, mergeCommentThread } from "./comment-threads";

const thread = {
  id: "cth_1",
  roomId: "r1",
  createdBy: "ada",
  metadata: { x: 1, y: 2 },
  resolved: false,
  createdAt: "t0",
  updatedAt: "t0",
  comments: [],
};

describe("comment-threads helpers", () => {
  it("merges by id", () => {
    const merged = mergeCommentThread([thread], { ...thread, resolved: true });
    expect(merged).toHaveLength(1);
    expect(merged[0]?.resolved).toBe(true);
  });

  it("appends comments", () => {
    const next = appendCommentToThreads([thread], {
      id: "cmt_1",
      threadId: "cth_1",
      userId: "bob",
      body: "ok",
      createdAt: "t1",
    });
    expect(next[0]?.comments).toHaveLength(1);
  });
});
