import { describe, it, expect } from "vitest";
import { createSessionReplayManager } from "./session-replay";

describe("session-replay", () => {
  it("should create a replay session", () => {
    const s = createSessionReplayManager();
    const session = s.createReplaySession("orig-1", "metadata_only", 30);
    expect(session.sessionId).toMatch(/^replay-/);
    expect(session.expiresAt).toBeTruthy();
  });

  it("should record events", () => {
    const s = createSessionReplayManager();
    const session = s.createReplaySession("orig-1", "none", 30);
    const event = s.recordEvent(session.sessionId, "message", { text: "hello" });
    expect(event.type).toBe("message");
  });

  it("should reject recording without consent", () => {
    const s = createSessionReplayManager();
    const session = s.createReplaySession("orig-1", "none", 30);
    s.setConsent(session.sessionId, false, false);
    expect(() => s.recordEvent(session.sessionId, "message", { text: "x" })).toThrow();
  });

  it("should redact sensitive data", () => {
    const s = createSessionReplayManager();
    const session = s.createReplaySession("orig-1", "content_safe", 30);
    s.recordEvent(session.sessionId, "message", { text: "SSN: 123-45-6789 and email: user@example.com" });
    s.redactSession(session.sessionId);
    const protocol = s.exportProtocol(session.sessionId);
    expect(protocol.events[0].data.text).not.toContain("123-45-6789");
  });

  it("should export protocol with checksum", () => {
    const s = createSessionReplayManager();
    const session = s.createReplaySession("orig-1", "none", 30);
    s.recordEvent(session.sessionId, "msg", { text: "test" });
    const protocol = s.exportProtocol(session.sessionId);
    expect(protocol.protocolVersion).toBe("1.0");
    expect(protocol.checksum).toBeTruthy();
  });

  it("should delete session", () => {
    const s = createSessionReplayManager();
    const session = s.createReplaySession("orig-1", "none", 30);
    s.deleteSession(session.sessionId);
    expect(s.getSession(session.sessionId)).toBeNull();
  });
});
