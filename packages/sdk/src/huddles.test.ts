import { describe, it, expect } from "vitest";
import { createHuddle } from "./huddles";

describe("huddles", () => {
  it("should start with idle status", () => {
    const h = createHuddle({ roomId: "room-1", audioEnabled: true, videoEnabled: false, screenShareEnabled: true, captionsEnabled: false, recordingConsent: false, maxParticipants: 10 });
    expect(h.getStatus()).toBe("idle");
  });

  it("should return config", () => {
    const h = createHuddle({ roomId: "room-1", audioEnabled: true, videoEnabled: false, screenShareEnabled: true, captionsEnabled: false, recordingConsent: false, maxParticipants: 10 });
    expect(h.getConfig().roomId).toBe("room-1");
    expect(h.getConfig().maxParticipants).toBe(10);
  });

  it("should update config", () => {
    const h = createHuddle({ roomId: "room-1", audioEnabled: true, videoEnabled: false, screenShareEnabled: true, captionsEnabled: false, recordingConsent: false, maxParticipants: 10 });
    h.updateConfig({ maxParticipants: 20 });
    expect(h.getConfig().maxParticipants).toBe(20);
  });

  it("should emit events", () => {
    const h = createHuddle({ roomId: "room-1", audioEnabled: true, videoEnabled: false, screenShareEnabled: true, captionsEnabled: false, recordingConsent: false, maxParticipants: 10 });
    const events: string[] = [];
    h.onEvent((e) => events.push(e.type));
    h.giveRecordingConsent();
    expect(events).toContain("recording_started");
    h.revokeRecordingConsent();
    expect(events).toContain("recording_stopped");
  });

  it("should start and stop screen share", async () => {
    const h = createHuddle({ roomId: "room-1", audioEnabled: true, videoEnabled: false, screenShareEnabled: true, captionsEnabled: false, recordingConsent: false, maxParticipants: 10 });
    const events: string[] = [];
    h.onEvent((e) => events.push(e.type));
    await h.startScreenShare();
    expect(events).toContain("screen_share_started");
    await h.stopScreenShare();
    expect(events).toContain("screen_share_stopped");
  });

  it("should return empty participants initially", () => {
    const h = createHuddle({ roomId: "room-1", audioEnabled: true, videoEnabled: false, screenShareEnabled: true, captionsEnabled: false, recordingConsent: false, maxParticipants: 10 });
    expect(h.getParticipants()).toEqual([]);
  });

  it("should return null local stream initially", () => {
    const h = createHuddle({ roomId: "room-1", audioEnabled: true, videoEnabled: false, screenShareEnabled: true, captionsEnabled: false, recordingConsent: false, maxParticipants: 10 });
    expect(h.getLocalStream()).toBeNull();
  });

  it("should return empty captions initially", () => {
    const h = createHuddle({ roomId: "room-1", audioEnabled: true, videoEnabled: false, screenShareEnabled: true, captionsEnabled: false, recordingConsent: false, maxParticipants: 10 });
    expect(h.getCaptions()).toEqual([]);
  });
});
