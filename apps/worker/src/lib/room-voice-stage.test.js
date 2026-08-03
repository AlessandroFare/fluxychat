import { describe, expect, it } from "vitest";
import {
  buildStageSnapshot,
  mapVoiceStageRow,
  pickActiveSpeaker,
} from "./room-voice-stage.js";

describe("room-voice-stage", () => {
  it("maps config row", () => {
    const row = mapVoiceStageRow({
      id: "stage_1",
      project_id: "p1",
      room_id: "room1",
      enabled: 1,
      max_speakers: 5,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    });
    expect(row?.maxSpeakers).toBe(5);
    expect(row?.enabled).toBe(true);
  });

  it("builds stage snapshot with active speaker flag", () => {
    const map = new Map([
      ["u1", { role: "speaker", joinedAt: "2026-08-01T00:00:00Z", vadScore: 0.8, lastVadAt: Date.now() }],
      ["u2", { role: "listener", joinedAt: "2026-08-01T00:00:00Z" }],
    ]);
    const snap = buildStageSnapshot(map, "u1");
    expect(snap.speakerCount).toBe(1);
    expect(snap.listenerCount).toBe(1);
    expect(snap.participants.find((p) => p.userId === "u1")?.isActiveSpeaker).toBe(true);
  });

  it("picks highest recent vad speaker", () => {
    const now = Date.now();
    const map = new Map([
      ["a", { role: "speaker", vadScore: 0.3, lastVadAt: now }],
      ["b", { role: "speaker", vadScore: 0.9, lastVadAt: now }],
    ]);
    expect(pickActiveSpeaker(map, now)).toBe("b");
  });
});
