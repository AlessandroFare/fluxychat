import { describe, it, expect } from "vitest";
import { createDecentralizedRelay } from "./decentralized-relay";

describe("createDecentralizedRelay", () => {
  it("registers and lists peers", () => {
    const r = createDecentralizedRelay();
    r.registerPeer("peer-1", "10.0.0.1:8080");
    r.registerPeer("peer-2", "10.0.0.2:8080");
    expect(r.getPeers()).toHaveLength(2);
  });

  it("unregisters peer", () => {
    const r = createDecentralizedRelay();
    r.registerPeer("peer-1", "10.0.0.1:8080");
    r.unregisterPeer("peer-1");
    expect(r.getPeers()).toHaveLength(0);
  });

  it("send creates message", () => {
    const r = createDecentralizedRelay();
    r.registerPeer("peer-1", "10.0.0.1:8080");
    r.registerPeer("peer-2", "10.0.0.2:8080");
    const msg = r.send("peer-1", "peer-2", "hello");
    expect(msg.from).toBe("peer-1");
    expect(msg.to).toBe("peer-2");
    expect(msg.hopCount).toBe(0);
  });

  it("route increments hop count", () => {
    const r = createDecentralizedRelay();
    r.registerPeer("peer-1", "10.0.0.1:8080");
    r.registerPeer("peer-2", "10.0.0.2:8080");
    const msg = r.send("peer-1", "peer-2", "data");
    const routed = r.route(msg);
    expect(routed?.hopCount).toBe(1);
  });

  it("route returns null for unknown peer", () => {
    const r = createDecentralizedRelay();
    r.registerPeer("peer-1", "10.0.0.1:8080");
    const msg = r.send("peer-1", "unknown", "data");
    expect(r.route(msg)).toBeNull();
  });

  it("broadcast sends to all peers except sender", () => {
    const r = createDecentralizedRelay();
    r.registerPeer("peer-1", "10.0.0.1:8080");
    r.registerPeer("peer-2", "10.0.0.2:8080");
    r.registerPeer("peer-3", "10.0.0.3:8080");
    const msgs = r.broadcast("peer-1", "announce");
    expect(msgs).toHaveLength(2);
    for (const m of msgs) expect(m.from).toBe("peer-1");
  });

  it("getRoute returns path", () => {
    const r = createDecentralizedRelay();
    r.registerPeer("peer-1", "10.0.0.1:8080");
    r.registerPeer("peer-2", "10.0.0.2:8080");
    r.registerPeer("peer-3", "10.0.0.3:8080");
    const route = r.getRoute("peer-1", "peer-3");
    expect(route.length).toBeGreaterThanOrEqual(2);
    expect(route[0]).toBe("peer-1");
    expect(route[route.length - 1]).toBe("peer-3");
  });
});
