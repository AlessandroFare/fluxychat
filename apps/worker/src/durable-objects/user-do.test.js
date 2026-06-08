import { describe, it, expect } from "vitest";
import { UserDurableObject } from "./user-do.js";

function createMockWebSocket() {
  const sent = [];
  return {
    sent,
    accept() {},
    addEventListener() {},
    send(data) {
      sent.push(typeof data === "string" ? data : String(data));
    },
  };
}

describe("UserDurableObject", () => {
  it("broadcast delivers to all user sockets except excludeSocketId", () => {
    const state = { id: { toString: () => "proj__alice" } };
    const userDo = new UserDurableObject(state, {});
    const ws1 = createMockWebSocket();
    const ws2 = createMockWebSocket();
    userDo.clients.add(ws1);
    userDo.clients.add(ws2);
    userDo.socketIds.set(ws1, "sock-1");
    userDo.socketIds.set(ws2, "sock-2");

    const delivered = userDo.broadcast(
      { type: "user_event", userId: "alice", name: "ping", data: {} },
      { excludeSocketId: "sock-1" },
    );

    expect(delivered).toBe(1);
    expect(ws1.sent).toHaveLength(0);
    expect(JSON.parse(ws2.sent[0])).toMatchObject({ name: "ping" });
  });

  it("terminateAllConnections closes all sockets", () => {
    const state = { id: { toString: () => "proj__alice" } };
    const userDo = new UserDurableObject(state, {});
    const ws1 = createMockWebSocket();
    const ws2 = createMockWebSocket();
    ws1.close = () => {};
    ws2.close = () => {};
    userDo.clients.add(ws1);
    userDo.clients.add(ws2);

    const closed = userDo.terminateAllConnections(4001, "kick");
    expect(closed).toBe(2);
    expect(userDo.clients.size).toBe(0);
  });
});
