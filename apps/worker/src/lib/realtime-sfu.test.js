import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addRealtimeSfuTracks,
  createRealtimeSfuSession,
  defaultHuddleProvider,
  huddleParticipantCap,
  isRealtimeSfuConfigured,
} from "./realtime-sfu.js";

describe("realtime-sfu", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is unconfigured without app id and secret", () => {
    expect(isRealtimeSfuConfigured({})).toBe(false);
    expect(defaultHuddleProvider({})).toBe("livekit");
  });

  it("defaults to cloudflare-realtime when SFU secrets exist", () => {
    const env = { REALTIME_SFU_APP_ID: "app", REALTIME_SFU_APP_SECRET: "sec" };
    expect(isRealtimeSfuConfigured(env)).toBe(true);
    expect(defaultHuddleProvider(env)).toBe("cloudflare-realtime");
    expect(defaultHuddleProvider(env, "livekit")).toBe("livekit");
  });

  it("caps huddle size", () => {
    expect(huddleParticipantCap(100)).toBe(16);
    expect(huddleParticipantCap(1)).toBe(2);
  });

  it("creates a session through the HTTPS API with the browser offer SDP", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sessionId: "ses_1" }),
      }),
    );
    const offer = {
      sessionDescription: { type: "offer", sdp: "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n" },
    };
    const out = await createRealtimeSfuSession(
      {
        REALTIME_SFU_APP_ID: "app",
        REALTIME_SFU_APP_SECRET: "sec",
      },
      offer,
    );
    expect(out.ok).toBe(true);
    expect(out.data.sessionId).toBe("ses_1");
    expect(fetch).toHaveBeenCalledWith(
      "https://rtc.live.cloudflare.com/v1/apps/app/sessions/new",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(offer),
      }),
    );
  });

  it("adds tracks on an existing session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tracks: [] }),
      }),
    );
    const out = await addRealtimeSfuTracks(
      { REALTIME_SFU_APP_ID: "app", REALTIME_SFU_APP_SECRET: "sec" },
      "ses_1",
      { tracks: [{ location: "local" }] },
    );
    expect(out.ok).toBe(true);
  });
});
