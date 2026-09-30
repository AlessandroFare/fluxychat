import { describe, expect, it } from "vitest";
import {
  classifyMessageTrust,
  evaluateTwoKeyTurn,
  isExternalEffectTool,
  rewriteUntrustedMarkdown,
  stripHiddenUnicode,
  twoKeyRequiresHitl,
  wrapTwoKeyApprovalGate,
} from "./shared-room-agent-guard.js";

describe("shared-room-agent-guard", () => {
  it("strips hidden unicode (synthetic, not an exploit recipe)", () => {
    expect(stripHiddenUnicode("hi\u200bthere")).toBe("hithere");
    expect(stripHiddenUnicode("ok\u202E")).toBe("ok");
  });

  it("labels guests untrusted and members trusted", () => {
    expect(classifyMessageTrust({ user_id: "guest_abc" })).toBe("untrusted");
    expect(classifyMessageTrust({ user_id: "user_ana" })).toBe("trusted");
  });

  it("requires HITL when untrusted text + private context + external tool", () => {
    const turn = evaluateTwoKeyTurn({
      invokerUserId: "guest_abc",
      agentId: "bot_1",
      contextFetchUrl: "https://app.example/context",
      history: [{ user_id: "guest_abc", content: "MARKER_UNTRUSTED_ROOM_TEXT" }],
    });
    expect(turn.readUntrusted).toBe(true);
    expect(turn.hasPrivateData).toBe(true);
    expect(twoKeyRequiresHitl(turn, "postMessage")).toBe(true);
    expect(twoKeyRequiresHitl(turn, "fetchMessages")).toBe(false);
  });

  it("does not trip two-key without private data", () => {
    const turn = evaluateTwoKeyTurn({
      invokerUserId: "guest_abc",
      agentId: "bot_1",
      history: [{ user_id: "guest_abc", content: "hi" }],
    });
    expect(turn.hasPrivateData).toBe(false);
    expect(twoKeyRequiresHitl(turn, "http_request")).toBe(false);
  });

  it("omits markdown images and off-allowlist links", () => {
    const raw = "see ![x](https://evil.example/i.png) and [docs](https://evil.example/q?d=secret)";
    expect(rewriteUntrustedMarkdown(raw, [])).toBe("see [image omitted] and docs");
    expect(rewriteUntrustedMarkdown("[ok](https://docs.fluxychat.com/a)", ["fluxychat.com"])).toContain(
      "https://docs.fluxychat.com/a",
    );
  });

  it("wraps the approval gate", async () => {
    const turn = { readUntrusted: true, hasPrivateData: true };
    const gate = wrapTwoKeyApprovalGate(
      { needsApproval: async () => false },
      turn,
    );
    expect(await gate.needsApproval("sendDirectMessage", {}, {})).toBe(true);
    expect(isExternalEffectTool("fetchMessages")).toBe(false);
  });

  it("defaults two-key on unless SHARED_ROOM_TWO_KEY is false", async () => {
    const { twoKeyGuardEnabled } = await import("./shared-room-agent-guard.js");
    expect(twoKeyGuardEnabled({})).toBe(true);
    expect(twoKeyGuardEnabled({ SHARED_ROOM_TWO_KEY: "false" })).toBe(false);
    expect(twoKeyGuardEnabled({ SHARED_ROOM_TWO_KEY: "false" }, { sharedRoomTwoKey: true })).toBe(true);
    expect(twoKeyGuardEnabled({}, { sharedRoomTwoKey: false })).toBe(false);
  });
});
