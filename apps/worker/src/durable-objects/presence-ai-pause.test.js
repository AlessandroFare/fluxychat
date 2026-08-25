/**
 * R6 presence-aware AI cost control.
 *
 * A user whose sockets all reported `presence_state: "background"` must not
 * consume speculative agent warmup (pure token spend with no viewer). The flag
 * rides the socket attachment, so it must survive a hibernation wake.
 */
import { describe, expect, it, vi } from "vitest";
import { RoomDurableObject } from "./room-do.js";

function makeSocket() {
  const box = {};
  return {
    sent: [],
    accept: vi.fn(),
    close: vi.fn(),
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
    id: { toString: () => "room-r6" },
    // Mirrors the real runtime contract: tags passed to acceptWebSocket are
    // persisted on the socket and filterable via getWebSockets(tag).
    acceptWebSocket: (ws, tags = []) => {
      ws._tags = tags;
      sockets.push(ws);
    },
    getWebSockets: (tag) =>
      tag ? sockets.filter((ws) => (ws._tags || []).includes(tag)) : [...sockets],
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
      setAlarm: vi.fn(),
      deleteAlarm: vi.fn(),
    },
  };
}

function connectAs(roomDo, ws, userId) {
  roomDo.sessions.accept(ws, [`user:${userId}`]);
  roomDo.sessions.write(ws, { u: userId, s: `sock-${Math.random()}`, c: {}, r: [], p: "proj" });
}

describe("R6: isUserBackgrounded", () => {
  it("returns false for a user with no sockets (offline is not backgrounded)", async () => {
    const room = new RoomDurableObject(makeState(), { DB: {} });
    expect(room.isUserBackgrounded("nobody")).toBe(false);
  });

  it("returns false when at least one socket is active", async () => {
    const room = new RoomDurableObject(makeState(), { DB: {} });
    const phone = makeSocket();
    const laptop = makeSocket();
    connectAs(room, phone, "alice");
    connectAs(room, laptop, "alice");

    // Phone goes to background; laptop stays active.
    await room.onMessage(phone, { data: JSON.stringify({ type: "presence_state", state: "background" }) });

    expect(room.isUserBackgrounded("alice")).toBe(false);
  });

  it("returns true only when every socket of the user is backgrounded", async () => {
    const room = new RoomDurableObject(makeState(), { DB: {} });
    const phone = makeSocket();
    const laptop = makeSocket();
    connectAs(room, phone, "alice");
    connectAs(room, laptop, "alice");

    await room.onMessage(phone, { data: JSON.stringify({ type: "presence_state", state: "background" }) });
    await room.onMessage(laptop, { data: JSON.stringify({ type: "presence_state", state: "background" }) });

    expect(room.isUserBackgrounded("alice")).toBe(true);
  });

  it("single backgrounded socket means backgrounded", async () => {
    const room = new RoomDurableObject(makeState(), { DB: {} });
    const ws = makeSocket();
    connectAs(room, ws, "bob");
    await room.onMessage(ws, { data: JSON.stringify({ type: "presence_state", state: "background" }) });
    expect(room.isUserBackgrounded("bob")).toBe(true);
  });

  it("returning to active clears the background state", async () => {
    const room = new RoomDurableObject(makeState(), { DB: {} });
    const ws = makeSocket();
    connectAs(room, ws, "carol");

    await room.onMessage(ws, { data: JSON.stringify({ type: "presence_state", state: "background" }) });
    expect(room.isUserBackgrounded("carol")).toBe(true);

    await room.onMessage(ws, { data: JSON.stringify({ type: "presence_state", state: "active" }) });
    expect(room.isUserBackgrounded("carol")).toBe(false);
  });

  it("an invalid or missing state defaults to active (never silently pauses AI)", async () => {
    const room = new RoomDurableObject(makeState(), { DB: {} });
    const ws = makeSocket();
    connectAs(room, ws, "dave");
    await room.onMessage(ws, { data: JSON.stringify({ type: "presence_state", state: "weird" }) });
    expect(room.isUserBackgrounded("dave")).toBe(false);

    await room.onMessage(ws, { data: JSON.stringify({ type: "presence_state" }) });
    expect(room.isUserBackgrounded("dave")).toBe(false);
  });

  it("the background flag survives a hibernation wake (attachment-backed)", async () => {
    const state = makeState();
    const before = new RoomDurableObject(state, { DB: {} });
    const ws = makeSocket();
    connectAs(before, ws, "erin");
    await before.onMessage(ws, { data: JSON.stringify({ type: "presence_state", state: "background" }) });

    // Eviction: brand-new instance, cold memory, same socket still open.
    const woken = new RoomDurableObject(state, { DB: {} });
    expect(woken.isUserBackgrounded("erin")).toBe(true);
  });

  it("users do not interfere: bob's background does not pause alice's warmup eligibility", async () => {
    const room = new RoomDurableObject(makeState(), { DB: {} });
    const aliceWs = makeSocket();
    const bobWs = makeSocket();
    connectAs(room, aliceWs, "alice");
    connectAs(room, bobWs, "bob");

    await room.onMessage(bobWs, { data: JSON.stringify({ type: "presence_state", state: "background" }) });

    expect(room.isUserBackgrounded("alice")).toBe(false);
    expect(room.isUserBackgrounded("bob")).toBe(true);
  });
});

describe("R6: speculative warmup skips backgrounded users", () => {
  it("maybeRunSpeculativeWarmup returns early and discards stale cache for a backgrounded user", async () => {
    const state = makeState();
    const env = {
      DB: {},
      SPECULATIVE_WARMUP_ENABLED: "true",
    };
    const room = new RoomDurableObject(state, env);
    // Guards upstream of the R6 skip require a resolved room/project context.
    room.projectId = "proj";
    const ws = makeSocket();
    connectAs(room, ws, "alice");

    await room.onMessage(ws, { data: JSON.stringify({ type: "presence_state", state: "background" }) });

    // Seed a stale cache entry that should get discarded by the skip path.
    room.speculativeWarmupCache.set("alice", { text: "old", results: [], discarded: false });

    let retrievalCalled = false;
    vi.doMock("../lib/speculative-warmup.js", () => ({
      isSpeculativeWarmupEnabled: () => true,
      countWords: () => 10,
      normalizeWarmupText: (t) => t,
      runSpeculativeRetrieval: async () => {
        retrievalCalled = true;
        return { ok: true, results: [] };
      },
      buildWarmupCacheEntry: () => ({}),
      recordWarmupTelemetry: async () => {},
      WARMUP_THROTTLE_MS: 0,
      WARMUP_MIN_WORDS: 1,
    }));

    await room.maybeRunSpeculativeWarmup("alice", "some partial text here", true);

    expect(retrievalCalled).toBe(false);
    expect(room.speculativeWarmupCache.get("alice").discarded).toBe(true);
    vi.doUnmock("../lib/speculative-warmup.js");
  });
});
