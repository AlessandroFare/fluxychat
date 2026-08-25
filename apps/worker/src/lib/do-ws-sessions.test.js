import { describe, expect, it, vi } from "vitest";
import {
  WsSessionRegistry,
  installWsAutoResponse,
  WS_ATTACHMENT_BUDGET_BYTES,
} from "./do-ws-sessions.js";

/**
 * Minimal stand-in for a hibernatable WebSocket. `serializeAttachment` is the
 * only mechanism that survives eviction, so the fake stores it out-of-band the
 * way the runtime does.
 */
function makeSocket() {
  const box = { attachment: undefined };
  return {
    box,
    sent: [],
    accept: vi.fn(),
    send(payload) {
      this.sent.push(payload);
    },
    serializeAttachment(value) {
      box.attachment = JSON.parse(JSON.stringify(value));
    },
    deserializeAttachment() {
      return box.attachment;
    },
  };
}

function makeHibernatableState() {
  const sockets = [];
  return {
    sockets,
    id: { toString: () => "room-1" },
    acceptWebSocket(ws, tags = []) {
      ws._tags = tags;
      sockets.push(ws);
    },
    getWebSockets(tag) {
      if (!tag) return [...sockets];
      return sockets.filter((ws) => (ws._tags || []).includes(tag));
    },
  };
}

/** State stub shaped like the existing unit tests: no hibernation API at all. */
function makeLegacyState() {
  return { id: { toString: () => "room-1" } };
}

describe("WsSessionRegistry — hibernation mode", () => {
  it("uses acceptWebSocket instead of accept(), so the DO is not billed while idle", () => {
    const state = makeHibernatableState();
    const registry = new WsSessionRegistry(state);
    const ws = makeSocket();

    expect(registry.hibernationEnabled).toBe(true);
    registry.accept(ws, ["user:alice"]);

    expect(ws.accept).not.toHaveBeenCalled();
    expect(state.getWebSockets()).toContain(ws);
  });

  it("survives a hibernation wake: per-socket state is re-read from the attachment", () => {
    const state = makeHibernatableState();
    const ws = makeSocket();

    const before = new WsSessionRegistry(state);
    before.accept(ws);
    before.field("u").set(ws, "alice");
    before.field("s").set(ws, "socket-123");

    // Simulate eviction: brand-new registry instance, cold cache, same socket.
    const after = new WsSessionRegistry(state);
    expect(after.field("u").get(ws)).toBe("alice");
    expect(after.field("s").get(ws)).toBe("socket-123");
  });

  it("keeps the live socket set correct after a wake (an in-memory Set would be empty)", () => {
    const state = makeHibernatableState();
    const a = makeSocket();
    const b = makeSocket();
    const before = new WsSessionRegistry(state);
    before.accept(a);
    before.accept(b);

    const after = new WsSessionRegistry(state);
    expect(after.socketSet().size).toBe(2);
    expect([...after.socketSet()]).toEqual([a, b]);
  });

  it("filters sockets by tag", () => {
    const state = makeHibernatableState();
    const registry = new WsSessionRegistry(state);
    const a = makeSocket();
    const b = makeSocket();
    registry.accept(a, ["user:alice"]);
    registry.accept(b, ["user:bob"]);

    expect(registry.socketsByTag("user:alice")).toEqual([a]);
    expect(registry.socketsByTag("user:bob")).toEqual([b]);
  });
});

describe("WsSessionRegistry — Map/Set API compatibility", () => {
  it("behaves like a Map for socket keys", () => {
    const registry = new WsSessionRegistry(makeHibernatableState());
    const ws = makeSocket();
    registry.accept(ws);
    const userIds = registry.field("u");

    expect(userIds.has(ws)).toBe(false);
    userIds.set(ws, "alice");
    expect(userIds.get(ws)).toBe("alice");
    expect(userIds.has(ws)).toBe(true);
    expect([...userIds.values()]).toEqual(["alice"]);
    expect([...userIds.keys()]).toEqual([ws]);
    expect([...userIds.entries()]).toEqual([[ws, "alice"]]);

    expect(userIds.delete(ws)).toBe(true);
    expect(userIds.get(ws)).toBeUndefined();
    expect(userIds.delete(ws)).toBe(false);
  });

  it("supports synthetic string keys used by presence recovery", () => {
    const registry = new WsSessionRegistry(makeHibernatableState());
    const ws = makeSocket();
    registry.accept(ws);
    const userIds = registry.field("u");

    userIds.set(ws, "alice");
    userIds.set("recovered:bob", "bob");

    expect(userIds.get("recovered:bob")).toBe("bob");
    expect(userIds.size).toBe(2);
    expect([...userIds.values()].sort()).toEqual(["alice", "bob"]);
  });

  it("forEach and iteration cover both socket and synthetic entries", () => {
    const registry = new WsSessionRegistry(makeHibernatableState());
    const ws = makeSocket();
    registry.accept(ws);
    const map = registry.field("u");
    map.set(ws, "alice");
    map.set("recovered:bob", "bob");

    const seen = [];
    map.forEach((v) => seen.push(v));
    expect(seen.sort()).toEqual(["alice", "bob"]);
  });

  it("socketSet delete stops the socket from appearing in broadcasts", () => {
    const state = makeHibernatableState();
    const registry = new WsSessionRegistry(state);
    const a = makeSocket();
    const b = makeSocket();
    registry.accept(a);
    registry.accept(b);
    const clients = registry.socketSet();

    expect(clients.size).toBe(2);
    expect(clients.delete(a)).toBe(true);
    expect(clients.size).toBe(1);
    expect([...clients]).toEqual([b]);
  });
});

describe("WsSessionRegistry — legacy fallback", () => {
  it("falls back to accept() when the Hibernation API is absent", () => {
    const registry = new WsSessionRegistry(makeLegacyState());
    const ws = makeSocket();

    expect(registry.hibernationEnabled).toBe(false);
    registry.accept(ws);

    expect(ws.accept).toHaveBeenCalledTimes(1);
    expect(registry.socketSet().size).toBe(1);
  });

  it("still provides working Map semantics without hibernation", () => {
    const registry = new WsSessionRegistry(makeLegacyState());
    const ws = makeSocket();
    registry.accept(ws);
    registry.field("u").set(ws, "alice");
    expect(registry.field("u").get(ws)).toBe("alice");
  });

  it("tolerates sockets with no attachment support", () => {
    const registry = new WsSessionRegistry(makeLegacyState());
    const bare = { accept: vi.fn(), send: vi.fn() };
    registry.accept(bare);
    const map = registry.field("u");
    expect(() => map.set(bare, "alice")).not.toThrow();
    expect(map.get(bare)).toBe("alice");
  });
});

describe("WsSessionRegistry — attachment budget", () => {
  it("refuses writes above the 2 KB runtime cap instead of throwing mid-broadcast", () => {
    const overflow = vi.fn();
    const registry = new WsSessionRegistry(makeHibernatableState(), {
      onAttachmentOverflow: overflow,
    });
    const ws = makeSocket();
    registry.accept(ws);

    registry.field("u").set(ws, "alice");
    registry.field("big").set(ws, "x".repeat(WS_ATTACHMENT_BUDGET_BYTES + 100));

    expect(overflow).toHaveBeenCalled();
    // Previous good state is preserved; the oversized field was rejected.
    const reread = new WsSessionRegistry(makeHibernatableState());
    expect(reread.read(ws).u).toBe("alice");
    expect(reread.read(ws).big).toBeUndefined();
  });

  it("warns but still persists between the soft and hard budget", () => {
    const overflow = vi.fn();
    const registry = new WsSessionRegistry(makeHibernatableState(), {
      onAttachmentOverflow: overflow,
    });
    const ws = makeSocket();
    registry.accept(ws);
    registry.field("mid").set(ws, "x".repeat(1700));

    expect(overflow).toHaveBeenCalled();
    expect(registry.read(ws).mid).toHaveLength(1700);
  });
});

describe("installWsAutoResponse", () => {
  it("installs the runtime ping/pong responder so keepalives do not wake the DO", () => {
    class FakePair {
      constructor(req, res) {
        this.req = req;
        this.res = res;
      }
    }
    const original = globalThis.WebSocketRequestResponsePair;
    globalThis.WebSocketRequestResponsePair = FakePair;
    const setWebSocketAutoResponse = vi.fn();

    const installed = installWsAutoResponse({ setWebSocketAutoResponse });

    expect(installed).toBe(true);
    expect(setWebSocketAutoResponse).toHaveBeenCalledTimes(1);
    const pair = setWebSocketAutoResponse.mock.calls[0][0];
    expect(JSON.parse(pair.req)).toEqual({ type: "ping" });
    expect(JSON.parse(pair.res)).toEqual({ type: "pong" });

    globalThis.WebSocketRequestResponsePair = original;
  });

  it("returns false when the runtime does not support auto-response", () => {
    expect(installWsAutoResponse({})).toBe(false);
  });
});
