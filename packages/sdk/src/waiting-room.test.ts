import { describe, it, expect } from "vitest";
import { createVirtualWaitingRoom } from "./waiting-room";

describe("createVirtualWaitingRoom", () => {
  it("enqueue adds ticket to queue", () => {
    const wr = createVirtualWaitingRoom();
    const ticket = wr.enqueue("user-1");
    expect(ticket.status).toBe("queued");
    expect(ticket.position).toBe(1);
  });

  it("enqueue with priority orders correctly", () => {
    const wr = createVirtualWaitingRoom();
    wr.enqueue("user-normal");
    wr.enqueue("user-vip", "vip");
    const vip = wr.getUserTicket("user-vip");
    expect(vip!.position).toBe(1);
  });

  it("dequeue returns first in line", () => {
    const wr = createVirtualWaitingRoom();
    wr.enqueue("user-1");
    wr.enqueue("user-2");
    const ticket = wr.dequeue("agent-1");
    expect(ticket).toBeDefined();
    expect(ticket!.userId).toBe("user-1");
    expect(ticket!.status).toBe("connecting");
  });

  it("dequeue returns undefined when queue empty", () => {
    const wr = createVirtualWaitingRoom();
    expect(wr.dequeue("agent-1")).toBeUndefined();
  });

  it("getTicket returns ticket by id", () => {
    const wr = createVirtualWaitingRoom();
    const t = wr.enqueue("user-1");
    expect(wr.getTicket(t.id)!.userId).toBe("user-1");
  });

  it("getUserTicket finds by user id", () => {
    const wr = createVirtualWaitingRoom();
    wr.enqueue("user-1");
    expect(wr.getUserTicket("user-1")).toBeDefined();
  });

  it("peek returns next N tickets", () => {
    const wr = createVirtualWaitingRoom();
    wr.enqueue("user-1");
    wr.enqueue("user-2");
    expect(wr.peek(1)).toHaveLength(1);
  });

  it("abandon marks ticket as abandoned and removes from active queue", () => {
    const wr = createVirtualWaitingRoom();
    const t = wr.enqueue("user-1");
    wr.abandon(t.id);
    const ticket = wr.getUserTicket("user-1");
    expect(ticket!.status).toBe("abandoned");
    const stats = wr.getStats();
    expect(stats.totalQueued).toBe(0);
  });

  it("connect removes ticket and marks connected", () => {
    const wr = createVirtualWaitingRoom();
    const t = wr.enqueue("user-1");
    const connected = wr.connect(t.id);
    expect(connected.status).toBe("connected");
    expect(connected.connectedAt).toBeDefined();
  });

  it("getStats returns queue statistics", () => {
    const wr = createVirtualWaitingRoom();
    wr.enqueue("user-1");
    wr.enqueue("user-2");
    wr.setAgentCount(2);
    const stats = wr.getStats();
    expect(stats.totalQueued).toBe(2);
    expect(stats.agentsAvailable).toBeGreaterThanOrEqual(0);
  });
});
