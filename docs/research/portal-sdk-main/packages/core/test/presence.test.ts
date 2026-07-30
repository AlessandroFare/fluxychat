import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Portal,
  type AggregatePresence,
  type ChannelHandle,
  type DetailedPresence,
} from "../src/index.js";
import { resetHttpClientFactory, setHttpClientFactory } from "../src/http/factory.js";
import { resetSocketFactory, setSocketFactory } from "../src/transport/factory.js";
import { MockHttpClient } from "./mock-server/http.js";
import { MockSocketServer, type ConnectScript } from "./mock-server/index.js";

afterEach(() => {
  resetSocketFactory();
  resetHttpClientFactory();
});

function setup(script: ConnectScript): { channel: ChannelHandle; server: MockSocketServer } {
  const server = new MockSocketServer(script);
  setSocketFactory(server.factory);
  setHttpClientFactory(new MockHttpClient().factory);
  const channel = new Portal({ apiKey: "pk", token: "jwt" }).channel("room");
  channel.acquire();
  return { channel, server };
}

const detailed = (p: DetailedPresence | AggregatePresence | undefined): DetailedPresence => {
  expect(p?.kind).toBe("detailed");
  return p as DetailedPresence;
};

describe("detailed presence", () => {
  it("seeds from the ready snapshot and applies join/leave deltas", async () => {
    const { channel } = setup((ctx) => {
      ctx.ready({
        presence: {
          mode: "detailed",
          participants: [{ id: "alice", anon: false, username: "ada" }],
          count: 1,
        },
      });
      ctx.send({
        t: "presence",
        mode: "detailed",
        joined: [
          { id: "bob", anon: false },
          { id: "carol", anon: true },
        ],
        left: [],
        count: 3,
      });
      ctx.send({ t: "presence", mode: "detailed", joined: [], left: ["carol"], count: 2 });
    });
    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    const presence = detailed(channel.presence);
    expect(presence.participants.map((p) => p.id)).toEqual(["alice", "bob"]);
    expect(presence.count).toBe(2);
    // Participant shape is the contract's, verbatim from the wire.
    expect(presence.participants[0]).toEqual({ id: "alice", anon: false, username: "ada" });
    expect(presence.participants[1]).toEqual({ id: "bob", anon: false });
  });

  it("surfaces re-announced session metadata in place", async () => {
    const { channel } = setup((ctx) => {
      ctx.ready({
        presence: { mode: "detailed", participants: [{ id: "alice", anon: false }], count: 1 },
      });
      // The server re-announces a metadata change as a joined delta for the same id.
      ctx.send({
        t: "presence",
        mode: "detailed",
        joined: [{ id: "alice", anon: false, metadata: { color: "blue" } }],
        left: [],
        count: 1,
      });
    });
    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    const presence = detailed(channel.presence);
    expect(presence.participants).toHaveLength(1);
    expect(presence.participants[0]?.metadata).toEqual({ color: "blue" });
  });

  it("emits the presence event on a delta", async () => {
    const { channel, server } = setup((ctx) =>
      ctx.ready({
        presence: { mode: "detailed", participants: [{ id: "alice", anon: false }], count: 1 },
      }),
    );
    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    const seen: number[] = [];
    channel.on("presence", (p) => seen.push(p.count));
    server.socket?.emit({
      type: "message",
      data: JSON.stringify({
        t: "presence",
        mode: "detailed",
        joined: [{ id: "bob", anon: false }],
        left: [],
        count: 2,
      }),
    });

    expect(seen).toEqual([2]);
    expect(detailed(channel.presence).participants.map((p) => p.id)).toEqual(["alice", "bob"]);
  });
});

describe("aggregate presence", () => {
  it("maps a broadcast channel's aggregate snapshot (mode → kind)", async () => {
    const { channel } = setup((ctx) =>
      ctx.ready({
        channel: { id: "room", mode: "broadcast" },
        presence: { mode: "aggregate", count: 9412, recent: [] },
      }),
    );
    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    expect(channel.presence?.kind).toBe("aggregate");
    expect((channel.presence as AggregatePresence).count).toBe(9412);
  });
});
