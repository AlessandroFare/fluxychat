import { describe, it, expect } from "vitest";
import {
  loadFrameRecording,
  listFrameRecordings,
  replayFrameRecording,
  assertFrameExpectations,
} from "./frame-replay.js";

describe("NW-113 frame replay", () => {
  it("lists and loads room-connect-history recording", () => {
    const names = listFrameRecordings();
    expect(names).toContain("room-connect-history");
    const rec = loadFrameRecording("room-connect-history");
    expect(rec.frames.length).toBeGreaterThan(0);
  });

  it("replays frames into expected room state", () => {
    const rec = loadFrameRecording("room-connect-history");
    const state = replayFrameRecording(rec);
    expect(state.messages).toHaveLength(3);
    expect(state.online).toBe(2);
    expect(state.reactions["1"]["👍"]).toBe(2);
    expect(state.reactions["3"]["🔥"]).toBe(1);
    assertFrameExpectations(rec, state);
  });
});
