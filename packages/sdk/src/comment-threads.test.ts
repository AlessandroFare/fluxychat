import { describe, expect, it } from "vitest";
import {
  appendCommentToThreads,
  mergeCommentThread,
  removeCommentFromThreads,
  removeThreadById,
  replaceCommentInThreads,
  searchCommentThreads,
  filterCommentThreads,
  commentThreadPreview,
} from "./comment-threads";

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

  it("replaces an edited comment and removes a deleted thread", () => {
    const withComment = appendCommentToThreads([thread], {
      id: "cmt_1",
      threadId: "cth_1",
      userId: "bob",
      body: "ok",
      createdAt: "t1",
    });
    const edited = replaceCommentInThreads(withComment, {
      id: "cmt_1",
      threadId: "cth_1",
      userId: "bob",
      body: "edited",
      createdAt: "t1",
      editedAt: "t2",
    });
    expect(edited[0]?.comments[0]?.body).toBe("edited");
    expect(removeCommentFromThreads(edited, "cth_1", "cmt_1")[0]?.comments).toEqual([]);
    expect(removeThreadById(edited, "cth_1")).toEqual([]);
  });

  it("searches comment body and pin quote", () => {
    const withComment = appendCommentToThreads(
      [{ ...thread, metadata: { ...thread.metadata, quote: "Look here" } }],
      {
        id: "cmt_1",
        threadId: "cth_1",
        userId: "bob",
        body: "agreed on the pin",
        createdAt: "t1",
      },
    );
    expect(searchCommentThreads(withComment, "agreed")).toHaveLength(1);
    expect(searchCommentThreads(withComment, "LOOK HERE")).toHaveLength(1);
    expect(searchCommentThreads(withComment, "missing")).toEqual([]);
  });

  it("filters open vs resolved and previews the first comment", () => {
    const open = { ...thread, comments: [{ id: "c1", threadId: "cth_1", userId: "ada", body: "first", createdAt: "t0" }] };
    const done = { ...thread, id: "cth_2", resolved: true, comments: [] };
    expect(filterCommentThreads([open, done], "open")).toEqual([open]);
    expect(filterCommentThreads([open, done], "resolved")).toEqual([done]);
    expect(commentThreadPreview(open)).toBe("first");
    expect(commentThreadPreview(done)).toBe("Comment");
  });
});
