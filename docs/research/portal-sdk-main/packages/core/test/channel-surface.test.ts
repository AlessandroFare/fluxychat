import { serializeFrame, type WireMessage } from "@portalsdk/wire-protocol";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Portal, type ChannelHandle } from "../src/index.js";
import { GRACE_MS } from "../src/channel.js";
import { resetHttpClientFactory, setHttpClientFactory } from "../src/http/factory.js";
import { resetSocketFactory, setSocketFactory } from "../src/transport/factory.js";
import { MockHttpClient } from "./mock-server/http.js";
import { MockSocketServer, type ConnectScript } from "./mock-server/index.js";

afterEach(() => {
  resetSocketFactory();
  resetHttpClientFactory();
  vi.useRealTimers();
});

function msg(seq: number): WireMessage {
  return {
    id: `m_${seq}`,
    seq,
    type: "message",
    kind: "text",
    content: { text: `msg ${seq}` },
    sender: { id: "u_other", anon: false },
    timestamp: 1_000 + seq,
    retracted: false,
    ephemeral: false,
  };
}

function setup(
  script: ConnectScript,
  http: MockHttpClient = new MockHttpClient(),
): { channel: ChannelHandle; server: MockSocketServer; http: MockHttpClient } {
  const server = new MockSocketServer(script);
  setSocketFactory(server.factory);
  setHttpClientFactory(http.factory);
  const channel = new Portal({ apiKey: "pk", token: "jwt" }).channel("room");
  channel.acquire();
  return { channel, server, http };
}

describe("read state", () => {
  it("derives initial unread from the ready watermark", async () => {
    const { channel } = setup((ctx) => ctx.ready({ seq: 10, watermark: 7 }));
    await vi.waitFor(() => expect(channel.status).toBe("ready"));
    expect(channel.unread).toBe(3);
  });

  it("grows unread with delivered messages and clears it on markAsRead", async () => {
    const { channel, server } = setup((ctx) => {
      ctx.ready({ seq: 0, watermark: 0 });
      ctx.send({ t: "batch", msgs: [msg(1), msg(2)] });
    });
    await vi.waitFor(() => expect(channel.messages).toHaveLength(2));

    expect(channel.unread).toBe(2);
    expect(channel.messages.every((m) => m.unread)).toBe(true);

    channel.markAsRead();
    expect(channel.unread).toBe(0);
    expect(channel.messages.every((m) => !m.unread)).toBe(true);

    const watermark = server.socket?.received.find((f) => f?.t === "watermark");
    expect(watermark).toMatchObject({ seq: 2 });
  });

  it("does not inflate unread when the user posts their own message", async () => {
    const http = new MockHttpClient({
      onPublish: () => ({ ok: true, ack: { id: "m_own", seq: 1, timestamp: 0 } }),
    });
    const { channel } = setup((ctx) => ctx.ready({ seq: 0, watermark: 0 }), http);
    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    await channel.send({ content: { text: "hello" } });
    expect(channel.unread).toBe(0);
    expect(channel.messages.find((m) => m.id === "m_own")?.unread).toBe(false);
  });
});

describe("activity", () => {
  it("tracks a peer's typing and expires it by absence", async () => {
    vi.useFakeTimers();
    const { channel, server } = setup((ctx) => ctx.ready());
    await vi.advanceTimersByTimeAsync(0);

    server.socket?.emit({
      type: "message",
      data: serializeFrame({ t: "activity", userId: "u_2", kind: "typing", since: 1 }),
    });
    expect(channel.typing).toEqual(["u_2"]);
    expect(channel.activity).toEqual([{ userId: "u_2", kind: "typing", since: 1 }]);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(channel.typing).toEqual([]);
  });

  it("throttles repeated outgoing activity of the same kind", async () => {
    const { channel, server } = setup((ctx) => ctx.ready());
    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    channel.sendTyping();
    channel.sendTyping();

    const sent = server.socket?.received.filter((f) => f?.t === "activity") ?? [];
    expect(sent).toHaveLength(1);
  });

  it("is a no-op on a broadcast channel", async () => {
    const { channel, server } = setup((ctx) =>
      ctx.ready({ channel: { id: "room", mode: "broadcast" } }),
    );
    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    channel.sendTyping();
    const sent = server.socket?.received.filter((f) => f?.t === "activity") ?? [];
    expect(sent).toHaveLength(0);
  });
});

describe("degraded-http", () => {
  it("keeps a publisher speaking over HTTP when the socket drops, then recovers", async () => {
    const http = new MockHttpClient({
      onPublish: () => ({ ok: true, ack: { id: "m_pub", seq: 1, timestamp: 0 } }),
    });
    const { channel, server } = setup((ctx) => ctx.ready({ seq: 0 }), http);
    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    server.socket?.emit({ type: "closed" });
    expect(channel.status).toBe("degraded-http");

    const ack = await channel.send({ content: { text: "still works" } });
    expect(ack.id).toBe("m_pub");

    server.socket?.reconnect();
    await vi.waitFor(() => expect(channel.status).toBe("ready"));
  });
});

describe("keepalive", () => {
  it("pings while the socket is open and stops once torn down", async () => {
    vi.useFakeTimers();
    const server = new MockSocketServer((ctx) => ctx.ready());
    setSocketFactory(server.factory);
    setHttpClientFactory(new MockHttpClient().factory);
    const channel = new Portal({ apiKey: "pk", token: "jwt" }).channel("room");
    channel.acquire();

    await vi.advanceTimersByTimeAsync(0); // connect → open
    await vi.advanceTimersByTimeAsync(25_000);
    const pinged = (server.socket?.received.filter((f) => f?.t === "ping") ?? []).length;
    expect(pinged).toBeGreaterThanOrEqual(1);

    // Teardown stops the pings.
    channel.release();
    vi.advanceTimersByTime(GRACE_MS);
    const afterTeardown = (server.socket?.received.filter((f) => f?.t === "ping") ?? []).length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect((server.socket?.received.filter((f) => f?.t === "ping") ?? []).length).toBe(
      afterTeardown,
    );
  });
});

describe("members", () => {
  it("fetches the directory across pages", async () => {
    const http = new MockHttpClient({
      onMembers: (_c, cursor) =>
        cursor === undefined
          ? { members: [{ userId: "a", online: true, claims: {} }], cursor: "p2" }
          : { members: [{ userId: "b", online: false, claims: {} }] },
    });
    const { channel } = setup((ctx) => ctx.ready(), http);
    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    const members = await channel.members();
    expect(members.map((m) => m.userId)).toEqual(["a", "b"]);
    expect(http.memberCalls.map((c) => c.cursor)).toEqual([undefined, "p2"]);
  });
});

describe("setMetadata", () => {
  it("sends a meta frame and carries the new metadata on reconnect", async () => {
    const { channel, server } = setup((ctx) => ctx.ready());
    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    channel.setMetadata({ color: "blue" });
    const meta = server.socket?.received.find((f) => f?.t === "meta");
    expect(meta).toMatchObject({ metadata: { color: "blue" } });

    server.socket?.reconnect();
    await vi.waitFor(() => expect(server.urls).toHaveLength(2));
    const metaParam = new URL(server.urls[1]!).searchParams.get("meta");
    expect(metaParam).not.toBeNull();
    expect(JSON.parse(atob(metaParam!))).toEqual({ color: "blue" });
  });
});
