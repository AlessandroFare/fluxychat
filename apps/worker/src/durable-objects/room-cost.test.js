/**
 * F1 live marginal cost — DO wiring test.
 *
 * Verifies the RoomDurableObject actually accumulates billable units and that
 * the /cost endpoint exposes a customer-readable view. The numbers here are
 * what the product shows users, so drift in either direction (silent counters,
 * invented costs) fails this suite.
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
    id: { toString: () => "room-cost" },
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

describe("F1: RoomDO cost ledger", () => {
  it("starts at zero and /cost reports an honest empty view", async () => {
    const room = new RoomDurableObject(makeState(), {});
    room.projectId = "proj";
    room.roomId = "room-cost";

    const res = await room.fetch(new Request("https://internal/cost"));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.roomId).toBe("room-cost");
    // The /cost request meters itself (honest): exactly one DO request so far,
    // zero WS traffic.
    expect(body.usage.doRequests).toBe(1);
    expect(body.usage.wsFramesIn).toBe(0);
    expect(body.usage.billableRequests).toBe(1);
    expect(body.estimatedUsd.total).toBe(0);
    // A cold/empty room has consumed nothing above allowance: say so.
    expect(body.estimatedUsd.withinIncludedAllowance).toBe(true);
  });

  it("counts inbound WS frames as billable requests", async () => {
    const state = makeState();
    const room = new RoomDurableObject(state, {});
    room.projectId = "proj";
    room.roomId = "room-cost";
    await room.ensureStorageHydrated();

    const ws = makeSocket();
    room.sessions.accept(ws, ["user:alice"]);
    room.sessions.write(ws, { u: "alice", s: "s1", c: {}, r: [], p: "proj" });
    // Bypass full onMessage pipeline; drive webSocketMessage directly with pings
    for (let i = 0; i < 25; i += 1) {
      await room.webSocketMessage(ws, JSON.stringify({ type: "ping" }));
    }

    const res = await room.fetch(new Request("https://internal/cost"));
    const body = await res.json();
    // 25 frames at 20:1 => ceil(25/20) = 2 billable requests
    expect(body.usage.wsFramesIn).toBe(25);
    expect(body.usage.billableRequests).toBeGreaterThanOrEqual(2);
    expect(body.usage.handlerDurationMs).toBeGreaterThan(0);
  });

  it("counts broadcast fan-out frames", async () => {
    const room = new RoomDurableObject(makeState(), {});
    room.projectId = "proj";
    const ws1 = makeSocket();
    const ws2 = makeSocket();
    const ws3 = makeSocket();
    room.sessions.accept(ws1, []);
    room.sessions.accept(ws2, []);
    room.sessions.accept(ws3, []);

    await room.broadcast({ type: "typing", userId: "x", isTyping: true });

    const res = await room.fetch(new Request("https://internal/cost"));
    const body = await res.json();
    expect(body.usage.wsFramesOut).toBe(3);
  });

  it("persists the ledger across a wake (storage-backed)", async () => {
    const state = makeState();
    const before = new RoomDurableObject(state, {});
    before.projectId = "proj";
    before.costLedger.wsFramesIn = 100;
    before.costLedger.doRequests = 4;
    before.costLedger.handlerDurationMs = 250;
    await before.persistCostLedger();

    // Eviction: fresh instance over the same storage.
    const woken = new RoomDurableObject(state, {});
    woken.projectId = "proj";

    const res = await woken.fetch(new Request("https://internal/cost"));
    const body = await res.json();
    expect(body.usage.wsFramesIn).toBe(100);
    expect(body.usage.doRequests).toBeGreaterThanOrEqual(4); // +1 from this fetch
    expect(body.usage.handlerDurationMs).toBeGreaterThanOrEqual(250);
  });

  it("alarm firings are counted; checkpoint persists when alarm completes", async () => {
    const state = makeState();
    const env = { DB: {} };
    const room = new RoomDurableObject(state, env);
    room.projectId = "proj";
    room.roomId = "room-cost";
    await room.ensureStorageHydrated();

    // expireDueMessagesInRoom will fail on the empty DB stub — the counter is
    // incremented first, so the metering itself is what we pin here.
    try {
      await room.alarm();
    } catch {
      /* DB stub rejects parts of the alarm body */
    }
    expect(room.costLedger.alarms).toBe(1);

    // Checkpoint path: persist + read back from storage.
    await room.persistCostLedger();
    const snapshot = await state.storage.get("_cost_ledger");
    expect(snapshot.alarms).toBe(1);
  });
});
