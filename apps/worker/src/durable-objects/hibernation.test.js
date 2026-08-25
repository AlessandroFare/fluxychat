/**
 * Hibernation regression suite.
 *
 * The single line `webSocket.accept()` in a Durable Object pins the object in
 * memory for the whole connection and, per Cloudflare's pricing docs, bills
 * duration for that entire window. Their published examples put the delta at
 * roughly 40x per connection-hour. These tests exist so that regression cannot
 * come back silently.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const doDir = dirname(fileURLToPath(import.meta.url));

/**
 * Strip comments and string literals so the guard reasons about executable code
 * only. Without this, prose explaining why `accept()` is forbidden would itself
 * trip the check.
 */
function stripNonCode(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, "``")
    .replace(/'(?:\\.|[^\\'])*'/g, "''")
    .replace(/"(?:\\.|[^\\"])*"/g, '""');
}

function durableObjectSources() {
  return readdirSync(doDir)
    .filter((f) => f.endsWith("-do.js") && !f.includes(".test."))
    .map((f) => {
      const source = readFileSync(join(doDir, f), "utf8");
      return { file: f, source, code: stripNonCode(source) };
    });
}

describe("durable objects must use the WebSocket Hibernation API", () => {
  it("no durable object calls the billing-pinning webSocket.accept()", () => {
    const offenders = [];
    for (const { file, code } of durableObjectSources()) {
      // Match `.accept()` on a socket, but not `state.acceptWebSocket(...)`.
      const matches = code.match(/(?<!\w)(?:webSocket|server|ws|socket)\s*\.accept\s*\(\s*\)/g);
      if (matches) offenders.push(`${file}: ${matches.join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("every durable object that upgrades websockets routes through the registry", () => {
    const missing = [];
    for (const { file, source } of durableObjectSources()) {
      if (!source.includes("WebSocketPair")) continue;
      if (!source.includes("WsSessionRegistry")) missing.push(file);
    }
    expect(missing).toEqual([]);
  });

  it("every websocket-serving durable object implements the hibernation handlers", () => {
    const incomplete = [];
    for (const { file, source } of durableObjectSources()) {
      if (!source.includes("WebSocketPair")) continue;
      for (const handler of ["webSocketMessage", "webSocketClose", "webSocketError"]) {
        if (!new RegExp(`async\\s+${handler}\\s*\\(`).test(source)) {
          incomplete.push(`${file} missing ${handler}`);
        }
      }
    }
    expect(incomplete).toEqual([]);
  });

  it("installs the runtime ping/pong auto-responder so keepalives are not billed", () => {
    const missing = [];
    for (const { file, source } of durableObjectSources()) {
      if (!source.includes("WebSocketPair")) continue;
      if (!source.includes("installWsAutoResponse")) missing.push(file);
    }
    expect(missing).toEqual([]);
  });
});

describe("RoomDurableObject hibernation behaviour", () => {
  /** Fake that records whether the non-hibernating path was taken. */
  function makeSocket() {
    const box = {};
    return {
      accept: vi.fn(),
      addEventListener: vi.fn(),
      close: vi.fn(),
      sent: [],
      send(p) {
        this.sent.push(p);
      },
      serializeAttachment(v) {
        box.v = JSON.parse(JSON.stringify(v));
      },
      deserializeAttachment() {
        return box.v;
      },
    };
  }

  function makeState() {
    const sockets = [];
    const store = new Map();
    return {
      sockets,
      id: { toString: () => "room-hib" },
      acceptWebSocket(ws) {
        sockets.push(ws);
      },
      getWebSockets: () => [...sockets],
      setWebSocketAutoResponse: vi.fn(),
      blockConcurrencyWhile: (fn) => fn(),
      storage: {
        get: async (k) => store.get(k),
        put: async (k, v) => {
          if (typeof k === "object") {
            for (const [kk, vv] of Object.entries(k)) store.set(kk, vv);
          } else store.set(k, v);
        },
        delete: async (k) => store.delete(k),
        list: async () => new Map(),
        setAlarm: vi.fn(),
        deleteAlarm: vi.fn(),
      },
    };
  }

  it("accepts through the hibernation API and never calls accept()", async () => {
    const { RoomDurableObject } = await import("./room-do.js");
    const state = makeState();
    const room = new RoomDurableObject(state, { DB: {} });
    const ws = makeSocket();

    room.sessions.accept(ws);

    expect(ws.accept).not.toHaveBeenCalled();
    expect(state.getWebSockets()).toContain(ws);
    expect(room.sessions.hibernationEnabled).toBe(true);
  });

  it("rebuilds per-user connection counts after a wake instead of losing them", async () => {
    const { RoomDurableObject } = await import("./room-do.js");
    const state = makeState();
    const first = new RoomDurableObject(state, { DB: {} });
    const a = makeSocket();
    const b = makeSocket();
    first.sessions.accept(a);
    first.sessions.accept(b);
    first.sessions.write(a, { u: "alice" });
    first.sessions.write(b, { u: "alice" });

    expect(first.countUserConnections("alice")).toBe(2);

    // Eviction: new instance, cold memory, same sockets still open.
    const woken = new RoomDurableObject(state, { DB: {} });
    expect(woken.countUserConnections("alice")).toBe(2);
    expect(woken.userConnectionCounts.get("alice")).toBe(2);
    expect(woken.clients.size).toBe(2);
    expect(woken.userIds.get(a)).toBe("alice");
  });

  it("does not emit a duplicate join for a user already connected before the wake", async () => {
    const { RoomDurableObject } = await import("./room-do.js");
    const state = makeState();
    const before = new RoomDurableObject(state, { DB: {} });
    const a = makeSocket();
    before.sessions.accept(a);
    before.sessions.write(a, { u: "alice" });

    const woken = new RoomDurableObject(state, { DB: {} });
    const b = makeSocket();
    woken.sessions.accept(b);
    woken.sessions.write(b, { u: "alice" });

    // Second socket for the same user => count 2, so the caller must not treat
    // this as a fresh member_joined (which is gated on count === 1).
    expect(woken.incrementUserConnection("alice")).toBe(2);
  });

  it("reports 0 remaining connections once the last socket for a user closes", async () => {
    const { RoomDurableObject } = await import("./room-do.js");
    const state = makeState();
    const room = new RoomDurableObject(state, { DB: {} });
    const a = makeSocket();
    room.sessions.accept(a);
    room.sessions.write(a, { u: "alice" });

    expect(room.incrementUserConnection("alice")).toBe(1);
    room.sessions.forget(a);
    expect(room.decrementUserConnection("alice")).toBe(0);
  });

  it("persists and restores room-scoped live state across a wake", async () => {
    const { RoomDurableObject } = await import("./room-do.js");
    const state = makeState();
    const before = new RoomDurableObject(state, { DB: {} });
    await before.ensureStorageHydrated();

    before.stageByUserId.set("alice", { role: "speaker", joinedAt: "2026-08-23T00:00:00Z" });
    before.activeSpeakerUserId = "alice";
    before.activeStreams.set("stream-1", { messageId: 7, lastFlushMs: 123 });
    before.userInfoByUserId.set("alice", { displayName: "Alice" });
    await before.persistRoomStateToStorage();

    const woken = new RoomDurableObject(state, { DB: {} });
    await woken.ensureStorageHydrated();

    expect(woken.stageByUserId.get("alice")).toEqual({
      role: "speaker",
      joinedAt: "2026-08-23T00:00:00Z",
    });
    expect(woken.activeSpeakerUserId).toBe("alice");
    expect(woken.activeStreams.get("stream-1")).toEqual({ messageId: 7, lastFlushMs: 123 });
    expect(woken.userInfoByUserId.get("alice")).toEqual({ displayName: "Alice" });
  });

  it("clears persisted room state when the room goes quiet", async () => {
    const { RoomDurableObject } = await import("./room-do.js");
    const state = makeState();
    const room = new RoomDurableObject(state, { DB: {} });
    await room.ensureStorageHydrated();
    room.stageByUserId.set("alice", { role: "speaker", joinedAt: "x" });
    await room.persistRoomStateToStorage();

    room.stageByUserId.clear();
    room.activeSpeakerUserId = null;
    await room.persistRoomStateToStorage();

    const woken = new RoomDurableObject(state, { DB: {} });
    await woken.ensureStorageHydrated();
    expect(woken.stageByUserId.size).toBe(0);
  });

  it("installs the auto-responder on construction", async () => {
    const { RoomDurableObject } = await import("./room-do.js");
    class FakePair {
      constructor(a, b) {
        this.a = a;
        this.b = b;
      }
    }
    const original = globalThis.WebSocketRequestResponsePair;
    globalThis.WebSocketRequestResponsePair = FakePair;
    const state = makeState();

    const room = new RoomDurableObject(state, { DB: {} });

    expect(room.autoResponseInstalled).toBe(true);
    expect(state.setWebSocketAutoResponse).toHaveBeenCalledTimes(1);
    globalThis.WebSocketRequestResponsePair = original;
  });
});

describe("UserDurableObject hibernation behaviour", () => {
  function makeSocket() {
    const box = {};
    return {
      accept: vi.fn(),
      addEventListener: vi.fn(),
      close: vi.fn(),
      sent: [],
      send(p) {
        this.sent.push(p);
      },
      serializeAttachment(v) {
        box.v = JSON.parse(JSON.stringify(v));
      },
      deserializeAttachment() {
        return box.v;
      },
    };
  }

  function makeState() {
    const sockets = [];
    const store = new Map();
    return {
      id: { toString: () => "proj__alice" },
      acceptWebSocket: (ws) => sockets.push(ws),
      getWebSockets: () => [...sockets],
      setWebSocketAutoResponse: vi.fn(),
      blockConcurrencyWhile: (fn) => fn(),
      storage: {
        get: async (k) => store.get(k),
        put: async (k, v) => {
          if (typeof k === "object") {
            for (const [kk, vv] of Object.entries(k)) store.set(kk, vv);
          } else store.set(k, v);
        },
        delete: async (k) => store.delete(k),
      },
    };
  }

  it("keeps delivering to sockets opened before a wake", async () => {
    const { UserDurableObject } = await import("./user-do.js");
    const state = makeState();
    const before = new UserDurableObject(state, {});
    const ws = makeSocket();
    before.sessions.accept(ws);
    before.sessions.write(ws, { s: "sock-1", u: "alice" });

    const woken = new UserDurableObject(state, {});
    await woken.ensureHydrated();

    const delivered = woken.broadcast({ type: "user_event", name: "ping" });
    expect(delivered).toBe(1);
    expect(ws.sent).toHaveLength(1);
  });

  it("honours excludeSocketId after a wake using the attachment-backed socket id", async () => {
    const { UserDurableObject } = await import("./user-do.js");
    const state = makeState();
    const before = new UserDurableObject(state, {});
    const a = makeSocket();
    const b = makeSocket();
    before.sessions.accept(a);
    before.sessions.accept(b);
    before.sessions.write(a, { s: "sock-a" });
    before.sessions.write(b, { s: "sock-b" });

    const woken = new UserDurableObject(state, {});
    const delivered = woken.broadcast({ type: "user_event" }, { excludeSocketId: "sock-a" });

    expect(delivered).toBe(1);
    expect(a.sent).toHaveLength(0);
    expect(b.sent).toHaveLength(1);
  });

  it("restores channel identity so /deliver works on a woken object", async () => {
    const { UserDurableObject } = await import("./user-do.js");
    const state = makeState();
    await state.storage.put({ projectId: "proj", userId: "alice" });

    const woken = new UserDurableObject(state, {});
    await woken.ensureHydrated();

    expect(woken.projectId).toBe("proj");
    expect(woken.userId).toBe("alice");
  });
});
