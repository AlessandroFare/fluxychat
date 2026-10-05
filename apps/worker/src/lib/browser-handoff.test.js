import { describe, expect, it } from "vitest";
import {
  canTakeBrowserHandoff,
  mapBrowserHandoffRequest,
  browserHandoffRoomEvent,
} from "./browser-handoff.js";

describe("browser-handoff", () => {
  it("rejects non-https and unknown hosts", () => {
    expect(mapBrowserHandoffRequest({ liveViewUrl: "http://x", invokerUserId: "u1" }).ok).toBe(false);
    expect(
      mapBrowserHandoffRequest({
        liveViewUrl: "https://evil.example/view",
        invokerUserId: "u1",
      }).ok,
    ).toBe(false);
  });

  it("whispers the live view only to invoker and named approvers", () => {
    const mapped = mapBrowserHandoffRequest({
      liveViewUrl: "https://example.browserbase.com/sessions/abc",
      invokerUserId: "user_invoke",
      approverIds: ["user_check"],
      reason: "mfa",
    });
    expect(mapped.ok).toBe(true);
    expect(mapped.handoff.recordingPaused).toBe(true);
    expect(canTakeBrowserHandoff(mapped.handoff, "user_invoke")).toBe(true);
    expect(canTakeBrowserHandoff(mapped.handoff, "user_check")).toBe(true);
    expect(canTakeBrowserHandoff(mapped.handoff, "stranger")).toBe(false);
    const event = browserHandoffRoomEvent(mapped.handoff);
    expect(event.visibility).toBe("whisper");
    expect(event.visibleTo).toEqual(["user_invoke", "user_check"]);
    expect(event.transcriptPolicy).toBe("no_screenshots");
  });
});
