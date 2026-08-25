import { describe, expect, it } from "vitest";
import { applyStreamTailToLocal, streamCheckpoint, streamTail } from "./stream-offset.js";

describe("stream offset resume", () => {
  it("checkpoints full buffer length", () => {
    expect(streamCheckpoint("hello")).toEqual({ content: "hello", offset: 5 });
  });

  it("returns a suffix when the client is behind", () => {
    const tail = streamTail("hello world", 6);
    expect(tail.content).toBe("world");
    expect(tail.resumeFrom).toBe(6);
    expect(tail.offset).toBe(11);
    expect(tail.caughtUp).toBe(false);
  });

  it("is caught up when the client offset matches", () => {
    expect(streamTail("abc", 3).caughtUp).toBe(true);
    expect(streamTail("abc", 3).content).toBe("");
  });

  it("splices a tail onto local content", () => {
    expect(applyStreamTailToLocal("hello ", { content: "world", resumeFrom: 6 })).toBe(
      "hello world",
    );
  });
});
