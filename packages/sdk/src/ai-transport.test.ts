import { describe, it, expect } from "vitest";
import { createDurableAITransport } from "./ai-transport";

describe("createDurableAITransport", () => {
  it("creates a session with initial metadata", () => {
    const dt = createDurableAITransport();
    const s = dt.createSession("user-1", { deviceId: "dev-1" });
    expect(s.id).toMatch(/dur-session-/);
    expect(s.userId).toBe("user-1");
    expect(s.lastOffset).toBe(0);
  });

  it("appends events with increasing offsets", () => {
    const dt = createDurableAITransport();
    const s = dt.createSession("user-1");
    const e1 = dt.appendEvent(s.id, "message", { text: "hello" });
    const e2 = dt.appendEvent(s.id, "typing", {});
    expect(e1.offset).toBe(1);
    expect(e2.offset).toBe(2);
  });

  it("replay returns events after offset", () => {
    const dt = createDurableAITransport();
    const s = dt.createSession("user-1");
    dt.appendEvent(s.id, "a", {});
    dt.appendEvent(s.id, "b", {});
    const replayed = dt.replay(s.id, 1);
    expect(replayed).toHaveLength(1);
    expect(replayed[0].data).toEqual({});
  });

  it("replay returns all events from 0 offset", () => {
    const dt = createDurableAITransport();
    const s = dt.createSession("user-1");
    dt.appendEvent(s.id, "a", {});
    dt.appendEvent(s.id, "b", {});
    expect(dt.replay(s.id)).toHaveLength(2);
  });

  it("getEventsSince returns events after offset", () => {
    const dt = createDurableAITransport();
    const s = dt.createSession("user-1");
    dt.appendEvent(s.id, "a", {});
    dt.appendEvent(s.id, "b", { n: 2 });
    const events = dt.getEventsSince(s.id, 1);
    expect(events).toHaveLength(1);
    expect(events[0].data).toEqual({ n: 2 });
  });

  it("switchDevice updates metadata", () => {
    const dt = createDurableAITransport();
    const s = dt.createSession("user-1", { deviceId: "dev-1" });
    expect(dt.switchDevice(s.id, "dev-2")).toBe(true);
    const retrieved = dt.getSession(s.id)!;
    expect(retrieved.metadata.deviceId).toBe("dev-2");
  });

  it("disconnect updates lastActiveAt", () => {
    const dt = createDurableAITransport();
    const s = dt.createSession("user-1");
    dt.disconnect(s.id);
    const retrieved = dt.getSession(s.id)!;
    expect(retrieved.lastActiveAt).toBeGreaterThan(0);
  });

  it("reconnect returns last session for user", () => {
    const dt = createDurableAITransport();
    dt.createSession("user-1", { deviceId: "dev-1" });
    const reconnected = dt.reconnect("user-1", "dev-2");
    expect(reconnected).toBeDefined();
    expect(reconnected!.metadata.deviceId).toBe("dev-2");
  });

  it("reconnect returns undefined for unknown user", () => {
    const dt = createDurableAITransport();
    expect(dt.reconnect("unknown", "dev-1")).toBeUndefined();
  });
});
