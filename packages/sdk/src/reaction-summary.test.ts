import { describe, expect, it } from "vitest";
import { applyRawReaction, parseReactionSummary, summaryFromRows } from "./reaction-summary";

describe("FX-REAC-1 reaction unique summary", () => {
  it("adds and removes client ids per emoji", () => {
    const summaries = new Map();
    expect(applyRawReaction(summaries, { messageId: 9, userId: "ada", emoji: "👍", op: "add" })).toEqual({
      messageId: 9,
      unique: { "👍": { total: 1, clientIds: ["ada"] } },
      distinct: { "👍": { total: 1, clientIds: ["ada"] } },
      multiple: {
        "👍": {
          total: 1,
          clientIds: { ada: 1 },
          totalUnidentified: 0,
          clipped: false,
          totalClientIds: 1,
        },
      },
    });
    applyRawReaction(summaries, { messageId: 9, userId: "lin", emoji: "👍", op: "add" });
    expect(applyRawReaction(summaries, { messageId: 9, userId: "ada", emoji: "👍", op: "remove" }).unique).toEqual({
      "👍": { total: 1, clientIds: ["lin"] },
    });
    const empty = applyRawReaction(summaries, { messageId: 9, userId: "lin", emoji: "👍", op: "remove" });
    expect(empty.unique).toEqual({});
    expect(empty.distinct).toEqual({});
    expect(empty.multiple).toEqual({});
  });

  it("FX-REAC-3 counts repeats on multiple and keeps unique as a set", () => {
    const summaries = new Map();
    applyRawReaction(summaries, { messageId: 9, userId: "ada", emoji: "👏", op: "add" });
    const doubled = applyRawReaction(summaries, {
      messageId: 9,
      userId: "ada",
      emoji: "👏",
      op: "add",
    });
    expect(doubled.unique["👏"]?.total).toBe(1);
    expect(doubled.multiple["👏"]).toMatchObject({
      total: 2,
      clientIds: { ada: 2 },
      totalClientIds: 1,
      clipped: false,
    });
    const once = applyRawReaction(summaries, {
      messageId: 9,
      userId: "ada",
      emoji: "👏",
      op: "remove",
    });
    expect(once.unique["👏"]?.clientIds).toEqual(["ada"]);
    expect(once.multiple["👏"]?.total).toBe(1);
  });

  it("builds a snapshot from REST rows", () => {
    expect(
      summaryFromRows(3, [
        { emoji: "🔥", userId: "a" },
        { emoji: "🔥", userId: "b" },
        { emoji: "❤️", userId: "a" },
      ]).unique,
    ).toEqual({
      "🔥": { total: 2, clientIds: ["a", "b"] },
      "❤️": { total: 1, clientIds: ["a"] },
    });
  });

  it("parses Ably REST multiple maps", () => {
    const parsed = parseReactionSummary(1, {
      unique: { "👍": { total: 1, clientIds: ["client1"] } },
      multiple: {
        "👏": {
          total: 15,
          clientIds: { client1: 5, client2: 10 },
          totalUnidentified: 0,
        },
      },
    });
    expect(parsed.multiple["👏"]).toMatchObject({
      total: 15,
      clientIds: { client1: 5, client2: 10 },
      totalUnidentified: 0,
      totalClientIds: 2,
      clipped: false,
    });
  });
});
