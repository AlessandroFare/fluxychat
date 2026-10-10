import { describe, expect, it } from "vitest";
import { createRoomFrameLog } from "./room-frame-log";

describe("createRoomFrameLog", () => {
  it("keeps the last N frames", () => {
    const log = createRoomFrameLog(3);
    log.push({ type: "a" });
    log.push({ type: "b" });
    log.push({ type: "c" });
    log.push({ type: "d" });
    expect(log.list().map((row) => row.event.type)).toEqual(["b", "c", "d"]);
  });
});
