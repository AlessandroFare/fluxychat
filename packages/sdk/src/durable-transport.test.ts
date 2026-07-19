import { describe, it, expect } from "vitest";
import { createDurableTransport } from "./durable-transport";

describe("createDurableTransport", () => {
  it("creates a session and returns it", () => {
    const t = createDurableTransport();
    const session = t.createSession("device-1");
    expect(session.id).toBeTruthy();
    expect(session.state.deviceIds).toEqual(["device-1"]);
    expect(session.isActive).toBe(true);
  });

  it("getSession returns null for unknown", () => {
    const t = createDurableTransport();
    expect(t.getSession("nonexistent")).toBeNull();
  });

  it("appends chunks with incrementing offsets", () => {
    const t = createDurableTransport();
    const session = t.createSession("device-1");
    expect(t.appendChunk(session.id, "hello")).toBe(0);
    expect(t.appendChunk(session.id, "world")).toBe(1);
    const chunks = t.getChunks(session.id, 0);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].data).toBe("hello");
    expect(chunks[1].data).toBe("world");
  });

  it("reconnect returns missed chunks", () => {
    const t = createDurableTransport();
    const session = t.createSession("device-1");
    t.appendChunk(session.id, "a");
    t.appendChunk(session.id, "b");
    t.appendChunk(session.id, "c");
    const result = t.reconnect(session.id, "device-2", 0);
    expect(result).not.toBeNull();
    expect(result!.missedChunks).toHaveLength(2);
    expect(result!.missedChunks[0].data).toBe("b");
    expect(result!.missedChunks[1].data).toBe("c");
    expect(result!.session.state.deviceIds).toContain("device-2");
  });

  it("reconnect returns null for closed session", () => {
    const t = createDurableTransport();
    const session = t.createSession("device-1");
    t.closeSession(session.id);
    expect(t.reconnect(session.id, "device-1", 0)).toBeNull();
  });

  it("appendChunk on unknown session returns -1", () => {
    const t = createDurableTransport();
    expect(t.appendChunk("x", "data")).toBe(-1);
  });

  it("listSessions returns all active sessions", () => {
    const t = createDurableTransport();
    t.createSession("d1");
    t.createSession("d2");
    expect(t.listSessions()).toHaveLength(2);
  });

  it("cleanup removes expired sessions", async () => {
    const t = createDurableTransport({ ttlMs: 1 });
    t.createSession("d1");
    await new Promise((r) => setTimeout(r, 10));
    expect(t.cleanup()).toBe(1);
    expect(t.listSessions()).toHaveLength(0);
  });

  it("respects maxChunks limit", () => {
    const t = createDurableTransport({ maxChunks: 3 });
    const s = t.createSession("d1");
    t.appendChunk(s.id, "a");
    t.appendChunk(s.id, "b");
    t.appendChunk(s.id, "c");
    t.appendChunk(s.id, "d");
    expect(t.getChunks(s.id, 0)).toHaveLength(3);
    expect(t.getChunks(s.id, 0)[0].data).toBe("b");
  });

  it("closeSession marks session inactive", () => {
    const t = createDurableTransport();
    const s = t.createSession("d1");
    t.closeSession(s.id);
    expect(s.isActive).toBe(false);
  });
});
