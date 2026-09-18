import { describe, expect, it } from "vitest";
import { YjsSyncHandler } from "./yjs-sync.js";

function mockWs() {
  const sent = [];
  return {
    sent,
    send(data) {
      sent.push(data);
    },
  };
}

describe("YjsSyncHandler on the same room as chat", () => {
  it("relays a binary update to the other socket, not the sender", async () => {
    const handler = new YjsSyncHandler();
    const alice = mockWs();
    const bob = mockWs();
    const storage = { get: async () => null, put: async () => {} };
    const seen = [];
    const broadcastFn = (data, exclude) => {
      seen.push({ data, exclude });
      if (exclude !== bob) bob.send(data);
      if (exclude !== alice) alice.send(data);
    };

    const payload = new Uint8Array([2, 9, 8, 7]);
    await handler.handleBinary(payload, alice, "room-1", storage, broadcastFn);

    expect(seen).toHaveLength(1);
    expect(seen[0].exclude).toBe(alice);
    expect(bob.sent).toHaveLength(1);
    expect(alice.sent).toHaveLength(0);
  });
});
