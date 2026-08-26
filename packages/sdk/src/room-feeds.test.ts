import { describe, expect, it } from "vitest";
import { appendFeedMessage, mergeFeed } from "./room-feeds";

const feed = {
  id: "feed_1",
  roomId: "r1",
  name: "Traces",
  kind: "agent",
  createdBy: "workflow",
  createdAt: "t0",
  updatedAt: "t0",
};

describe("room-feeds helpers", () => {
  it("merges feeds by id", () => {
    const merged = mergeFeed([feed], { ...feed, name: "Agent traces" });
    expect(merged).toHaveLength(1);
    expect(merged[0]?.name).toBe("Agent traces");
  });

  it("appends messages once", () => {
    const msg = {
      id: "fmsg_1",
      feedId: "feed_1",
      roomId: "r1",
      userId: "workflow",
      body: "ok",
      metadata: { source: "n8n" },
      createdAt: "t1",
    };
    const once = appendFeedMessage([], msg);
    expect(appendFeedMessage(once, msg)).toHaveLength(1);
  });
});
