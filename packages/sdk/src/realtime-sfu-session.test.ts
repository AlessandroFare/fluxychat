import { describe, expect, it } from "vitest";
import {
  CLOUDFLARE_STUN,
  buildLocalTrackObjects,
  toRemotePullTracks,
} from "./realtime-sfu-session";

describe("realtime-sfu-session", () => {
  it("maps sendonly transceivers to local track objects", () => {
    const objects = buildLocalTrackObjects([
      { mid: "0", sender: { track: { id: "mic-a", kind: "audio" } } },
      { mid: "1", sender: { track: { id: "cam-b", kind: "video" } } },
    ]);
    expect(objects).toEqual([
      { location: "local", mid: "0", trackName: "mic-a" },
      { location: "local", mid: "1", trackName: "cam-b" },
    ]);
  });

  it("turns published tracks into remote pulls for another session", () => {
    expect(
      toRemotePullTracks("ses_peer", [
        { location: "local", mid: "0", trackName: "mic-a" },
      ]),
    ).toEqual([
      { location: "remote", sessionId: "ses_peer", trackName: "mic-a" },
    ]);
  });

  it("uses Cloudflare STUN", () => {
    expect(CLOUDFLARE_STUN).toEqual({ urls: "stun:stun.cloudflare.com:3478" });
  });
});
