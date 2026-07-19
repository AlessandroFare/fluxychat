import { serializeFrame, type WireMessage } from "@portalsdk/wire-protocol";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BlockedError,
  NotYetSupportedError,
  Portal,
  PortalError,
  type ChannelHandle,
} from "../src/index.js";
import { resetHttpClientFactory, setHttpClientFactory } from "../src/http/factory.js";
import { resetSocketFactory, setSocketFactory } from "../src/transport/factory.js";
import { MockHttpClient } from "./mock-server/http.js";
import { MockSocketServer, type ConnectScript } from "./mock-server/index.js";

afterEach(() => {
  resetSocketFactory();
  resetHttpClientFactory();
  vi.useRealTimers();
});

function msg(seq: number, over: Partial<WireMessage> = {}): WireMessage {
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
    ...over,
  };
}

function setup(
  script: ConnectScript,
  http: MockHttpClient = new MockHttpClient(),
  channelId = "room",
): { channel: ChannelHandle; server: MockSocketServer; http: MockHttpClient } {
  const server = new MockSocketServer(script);
  setSocketFactory(server.factory);
  setHttpClientFactory(http.factory);
  const channel = new Portal({ apiKey: "pk", token: "jwt" }).channel(channelId);
  channel.acquire();
  return { channel, server, http };
}

describe("ordering, dedup, retraction over the wire", () => {
  it("drops a duplicate seq", async () => {
    const { channel } = setup((ctx) => {
      ctx.ready();
      ctx.send({ t: "batch", msgs: [msg(1)] });
      ctx.send({ t: "batch", msgs: [msg(1, { content: { text: "dupe" } })] });
    });
    await vi.waitFor(() => expect(channel.messages).toHaveLength(1));
    expect(channel.messages[0]?.content).toEqual({ text: "msg 1" });
  });

  it("applies a retract that arrived before its message", async () => {
    const { channel } = setup((ctx) => {
      ctx.ready();
      ctx.send({ t: "retract", id: "m_1", seq: 1 });
      ctx.send({ t: "batch", msgs: [msg(1)] });
    });
    await vi.waitFor(() => expect(channel.messages).toHaveLength(1));
    expect(channel.messages[0]?.retracted).toBe(true);
  });

  it("emits message and mention events for delivered messages", async () => {
    const messages: string[] = [];
    const mentions: string[] = [];
    const { channel } = setup((ctx) => {
      ctx.ready({ me: { id: "u_me", anon: false, claims: {}, capabilities: {} } });
      ctx.send({ t: "batch", msgs: [msg(1, { mentions: [{ userId: "u_me" }] })] });
      ctx.send({ t: "batch", msgs: [msg(2)] });
    });
    channel.on("message", (m) => messages.push(m.id));
    channel.on("mention", (m) => mentions.push(m.id));
    await vi.waitFor(() => expect(channel.messages).toHaveLength(2));
    expect(messages).toEqual(["m_1", "m_2"]);
    expect(mentions).toEqual(["m_1"]);
  });
});

describe("gap-fill", () => {
  it("fills an in-session gap by range fetch", async () => {
    vi.useFakeTimers();
    const http = new MockHttpClient({
      onHistory: (_c, q) =>
        q.from === 1 && q.to === 2 ? { msgs: [msg(1), msg(2)], hasMore: false } : { msgs: [], hasMore: false },
    });
    const { channel } = setup((ctx) => {
      ctx.ready();
      ctx.send({ t: "batch", msgs: [msg(3)] });
    }, http);

    await vi.advanceTimersByTimeAsync(0); // connect + ready + batch
    await vi.advanceTimersByTimeAsync(2_000); // gap-fill jitter + fetch

    expect(channel.messages.map((m) => m.id)).toEqual(["m_1", "m_2", "m_3"]);
  });

  it("range-fetches the remainder after a reconnect with a gap", async () => {
    vi.useFakeTimers();
    const http = new MockHttpClient({
      onHistory: (_c, q) =>
        q.from === 2 ? { msgs: [msg(2), msg(3), msg(4), msg(5)], hasMore: false } : { msgs: [], hasMore: false },
    });
    const { channel, server } = setup((ctx) => {
      if (ctx.attempt === 1) {
        ctx.ready({ seq: 0 });
        ctx.send({ t: "batch", msgs: [msg(1)] });
      } else {
        ctx.ready({ seq: 5 });
      }
    }, http);

    await vi.advanceTimersByTimeAsync(0);
    expect(channel.messages.map((m) => m.id)).toEqual(["m_1"]);

    server.socket?.reconnect();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(channel.messages.map((m) => m.id)).toEqual([
      "m_1",
      "m_2",
      "m_3",
      "m_4",
      "m_5",
    ]);
  });
});

describe("send", () => {
  it("optimistically inserts, then reconciles pending → sent on ack", async () => {
    const http = new MockHttpClient({
      onPublish: () => ({ ok: true, ack: { id: "m_srv", seq: 1, timestamp: 999 } }),
    });
    const { channel } = setup((ctx) => ctx.ready({ seq: 0 }), http);
    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    const pending = channel.send({ content: { text: "hi" } });
    expect(channel.messages.at(-1)).toMatchObject({ status: "pending", content: { text: "hi" } });

    const ack = await pending;
    expect(ack).toEqual({ id: "m_srv", timestamp: 999 });
    expect(channel.messages).toHaveLength(1);
    expect(channel.messages[0]).toMatchObject({ id: "m_srv", status: "sent" });
  });

  it("rolls back and rejects with BlockedError on a 4xx block", async () => {
    const http = new MockHttpClient({
      onPublish: () => ({ ok: false, code: "blocked_by_middleware", reason: "no links" }),
    });
    const { channel } = setup((ctx) => ctx.ready({ seq: 0 }), http);
    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    const rejection = channel.send({ content: { text: "http://x" } });
    await expect(rejection).rejects.toBeInstanceOf(BlockedError);
    await rejection.catch((error: BlockedError) => expect(error.reason).toBe("no links"));
    expect(channel.messages).toHaveLength(0);
  });

  it("resolves an ephemeral send locally and routes a refusal to onError, not the promise", async () => {
    const { channel, server } = setup((ctx) => ctx.ready());
    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    const errors: PortalError[] = [];
    channel.on("status", (_s, error) => {
      if (error) errors.push(error);
    });

    const ack = await channel.send({ ephemeral: true, type: "cursor.move", content: { x: 1 } });
    expect(ack.id).toMatch(/^cl_/);

    const sent = server.socket?.received.find(
      (f): f is { t: "ephemeral"; cl: string; type: string; content: unknown } =>
        f?.t === "ephemeral",
    );
    expect(sent).toMatchObject({ type: "cursor.move" });

    // A later in-session error referencing the send surfaces on the error channel only.
    server.socket?.emit({
      type: "message",
      data: serializeFrame({ t: "error", code: "not_permitted", ref: sent?.cl }),
    });
    await vi.waitFor(() => expect(errors).toHaveLength(1));
    expect(errors[0]).toBeInstanceOf(PortalError);
    expect(errors[0]?.code).toBe("not_permitted");
  });
});

describe("extension routing via bindings", () => {
  it("routes a ws-bound namespace to an ephemeral frame", async () => {
    const { channel, server } = setup((ctx) => ctx.ready({ bindings: { "ns1.": "ws" } }));
    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    await channel.send({ type: "ns1.move", content: { at: 3 } });
    const sent = server.socket?.received.find(
      (f): f is { t: "ephemeral"; cl: string; type: string; content: unknown } =>
        f?.t === "ephemeral",
    );
    expect(sent).toMatchObject({ type: "ns1.move" });
  });

  it("routes an http-bound namespace to a publish", async () => {
    const http = new MockHttpClient({
      onPublish: () => ({ ok: true, ack: { id: "e_1", seq: 0, timestamp: 0 } }),
    });
    const { channel } = setup((ctx) => ctx.ready({ bindings: { "ns2.": "http" } }), http);
    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    await channel.send({ type: "ns2.do", content: { go: true } });
    expect(http.publishCalls.at(-1)?.body).toMatchObject({ type: "ns2.do" });
  });
});

describe("history", () => {
  it("backfills on connect and pages older with loadPrevious", async () => {
    const http = new MockHttpClient({
      onHistory: (_c, q) => {
        if (q.before === undefined) return { msgs: [msg(8), msg(9), msg(10)], hasMore: true };
        if (q.before === 8) return { msgs: [msg(5), msg(6), msg(7)], hasMore: false };
        return { msgs: [], hasMore: false };
      },
    });
    const { channel } = setup((ctx) => ctx.ready({ seq: 10 }), http);

    await vi.waitFor(() => expect(channel.messages).toHaveLength(3));
    expect(channel.hasPrevious).toBe(true);

    const more = await channel.loadPrevious();
    expect(more).toBe(false);
    expect(channel.messages.map((m) => m.id)).toEqual([
      "m_5",
      "m_6",
      "m_7",
      "m_8",
      "m_9",
      "m_10",
    ]);
    expect(channel.hasPrevious).toBe(false);
  });

  it("shares one in-flight promise across concurrent loadPrevious calls", async () => {
    const http = new MockHttpClient({
      onHistory: (_c, q) =>
        q.before === undefined
          ? { msgs: [msg(10)], hasMore: true }
          : { msgs: [msg(1)], hasMore: false },
    });
    const { channel } = setup((ctx) => ctx.ready({ seq: 10 }), http);
    await vi.waitFor(() => expect(channel.hasPrevious).toBe(true));

    const first = channel.loadPrevious();
    const second = channel.loadPrevious();
    expect(first).toBe(second);
    expect(channel.isLoadingPrevious).toBe(true);
    await first;
    expect(channel.isLoadingPrevious).toBe(false);
  });
});

describe("reserved surfaces", () => {
  it("throws NotYetSupportedError for a channel where-view", async () => {
    const { channel } = setup((ctx) => ctx.ready());
    await vi.waitFor(() => expect(channel.status).toBe("ready"));
    expect(() => channel.view({ retracted: { eq: false } })).toThrow(NotYetSupportedError);
  });
});
