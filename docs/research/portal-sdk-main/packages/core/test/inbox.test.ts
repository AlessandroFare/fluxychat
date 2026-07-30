import { serializeFrame } from "@portalsdk/wire-protocol";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Portal, type InboxHandle } from "../src/index.js";
import { resetSocketFactory, setSocketFactory } from "../src/transport/factory.js";
import { MockSocketServer, type ConnectScript } from "./mock-server/index.js";

afterEach(() => {
  resetSocketFactory();
});

function setup(script: ConnectScript): { inbox: InboxHandle; server: MockSocketServer } {
  const server = new MockSocketServer(script);
  setSocketFactory(server.factory);
  const inbox = new Portal({ apiKey: "pk", token: "jwt" }).inbox();
  return { inbox, server };
}

describe("lazy singleton", () => {
  it("returns the same handle and connects only on first use", () => {
    const server = new MockSocketServer(() => {});
    setSocketFactory(server.factory);
    const portal = new Portal({ apiKey: "pk", token: "jwt" });
    expect(server.sockets).toHaveLength(0);
    const first = portal.inbox();
    expect(server.sockets).toHaveLength(1);
    expect(portal.inbox()).toBe(first);
  });
});

describe("items", () => {
  it("stores an arriving item and fires the item event", async () => {
    const { inbox, server } = setup((ctx) => ctx.inboxReady());
    await vi.waitFor(() => expect(inbox.status).toBe("ready"));

    let received: string | undefined;
    inbox.on("item", (item) => {
      received = item.id;
    });
    server.socket?.emit({
      type: "message",
      data: serializeFrame({
        t: "item",
        item: { id: "evt_1", type: "mention", data: { x: 1 }, channelId: "c1", at: 5, read: false },
      }),
    });

    expect(inbox.items.map((i) => i.id)).toEqual(["evt_1"]);
    expect(received).toBe("evt_1");
  });

  it("does not re-announce a redelivered item id, but still updates its state", async () => {
    const { inbox, server } = setup((ctx) => ctx.inboxReady());
    await vi.waitFor(() => expect(inbox.status).toBe("ready"));

    const arrivals: string[] = [];
    inbox.on("item", (item) => arrivals.push(item.id));

    const send = (title: string): void =>
      server.socket?.emit({
        type: "message",
        data: serializeFrame({
          t: "item",
          item: { id: "evt_1", type: "mention", title, data: {}, at: 1, read: false },
        }),
      });

    send("first");
    send("second"); // same id: a redelivery / in-place update

    // Announced once, but the stored item reflects the latest frame.
    expect(arrivals).toEqual(["evt_1"]);
    expect(inbox.items).toHaveLength(1);
    expect(inbox.items[0]?.title).toBe("second");
  });
});

describe("read models", () => {
  const ready: ConnectScript = (ctx) =>
    ctx.inboxReady({
      entries: [{ id: "c1", unread: 3, muted: false, at: 2 }],
      items: [{ id: "i1", type: "mention", data: {}, channelId: "c1", at: 1, read: false }],
      counter: 3,
    });

  it("advances an entry position with a read frame (inbox, not the channel watermark)", async () => {
    const { inbox, server } = setup(ready);
    await vi.waitFor(() => expect(inbox.status).toBe("ready"));

    inbox.channels.get("c1")?.markAsRead();

    const frame = server.socket?.receivedInbox.find((f) => f?.t === "read");
    expect(frame).toMatchObject({ channelId: "c1" });
    // Independent read model: this is an inbox read, never a channel watermark.
    expect(server.socket?.receivedInbox.some((f) => (f as { t: string })?.t === "watermark")).toBe(
      false,
    );
    expect(inbox.channels.get("c1")?.unread).toBe(0);
  });

  it("flips a single item with an item.read frame", async () => {
    const { inbox, server } = setup(ready);
    await vi.waitFor(() => expect(inbox.status).toBe("ready"));

    inbox.items[0]?.markAsRead();

    expect(server.socket?.receivedInbox.find((f) => f?.t === "item.read")).toMatchObject({
      id: "i1",
    });
    expect(inbox.items[0]?.read).toBe(true);
  });

  it("marks everything read with a global read.all frame", async () => {
    const { inbox, server } = setup(ready);
    await vi.waitFor(() => expect(inbox.status).toBe("ready"));

    inbox.markAllRead();

    expect(server.socket?.receivedInbox.some((f) => f?.t === "read.all")).toBe(true);
    expect(inbox.items.every((i) => i.read)).toBe(true);
  });

  it("mutes a channel with a mute frame and optimistic state", async () => {
    const { inbox, server } = setup(ready);
    await vi.waitFor(() => expect(inbox.status).toBe("ready"));

    inbox.channels.get("c1")?.mute();

    expect(server.socket?.receivedInbox.find((f) => f?.t === "mute")).toMatchObject({
      channelId: "c1",
      muted: true,
    });
    expect(inbox.channels.get("c1")?.muted).toBe(true);
  });
});

describe("views", () => {
  const ready: ConnectScript = (ctx) =>
    ctx.inboxReady({
      entries: [
        { id: "c1", unread: 1, muted: false, at: 2 },
        { id: "c2", unread: 0, muted: true, at: 1 },
      ],
      items: [
        { id: "i1", type: "mention", data: {}, channelId: "c1", at: 2, read: false },
        { id: "i2", type: "ticket.assigned", data: {}, channelId: "c2", at: 1, read: true },
      ],
      counter: 1,
    });

  it("filters the item feed by where and counts unseen", async () => {
    const { inbox } = setup(ready);
    await vi.waitFor(() => expect(inbox.status).toBe("ready"));

    const view = inbox.view({ where: { type: { eq: "mention" } } });
    expect(view.items.map((i) => i.id)).toEqual(["i1"]);
    expect(view.unseen).toBe(1);
  });

  it("scopes to a channel but .get still hits the full registry", async () => {
    const { inbox } = setup(ready);
    await vi.waitFor(() => expect(inbox.status).toBe("ready"));

    const view = inbox.view({ channelId: "c1" });
    expect(view.items.map((i) => i.id)).toEqual(["i1"]);
    expect(view.channels.map((c) => c.id)).toEqual(["c1"]);
    // .get reaches outside the view's filter, into the full registry.
    expect(view.channels.get("c2")?.id).toBe("c2");
  });
});

describe("anonymous synthesis", () => {
  it("swallows the anon refusal and synthesizes a permanently-empty ready store", async () => {
    const { inbox } = setup((ctx) => ctx.refuse("anonymous_not_allowed"));
    await vi.waitFor(() => expect(inbox.status).toBe("ready"));

    expect(inbox.channels).toHaveLength(0);
    expect(inbox.items).toHaveLength(0);
    expect(inbox.counter).toBe(0);
  });
});

describe("refusal resilience", () => {
  it("regains its token-refresh budget after each successful ready", async () => {
    let issued = 0;
    const token = async () => `jwt_${++issued}`;
    const server = new MockSocketServer((ctx) => {
      // Expire on the 1st and 3rd upgrades; a fresh ready between them must restore the retry.
      if (ctx.attempt === 1 || ctx.attempt === 3) ctx.refuse("token_expired");
      else ctx.inboxReady();
    });
    setSocketFactory(server.factory);
    const inbox = new Portal({ apiKey: "pk", token }).inbox();

    await vi.waitFor(() => expect(inbox.status).toBe("ready")); // attempt 1 refused → 2 ready
    expect(server.urls).toHaveLength(2);

    // A later drop whose upgrade expires again must still get its own retry, not stall.
    server.socket?.reconnect();
    await vi.waitFor(() => expect(server.urls).toHaveLength(4)); // 3 refused → 4 ready
    expect(inbox.status).toBe("ready");
  });

  it("stops reconnecting on a fatal, unrecoverable refusal", async () => {
    const { inbox, server } = setup((ctx) => ctx.refuse("invalid_api_key"));
    // Terminal refusal: the socket is closed rather than retried forever.
    await vi.waitFor(() => expect(server.socket?.closed).toBe(true));
    expect(server.socket?.reconnectCount).toBe(0);
    // No terminal inbox status exists (§5), so it never reaches ready.
    expect(inbox.status).toBe("connecting");
  });

  it("keeps retrying a rotating token that is still expired, without closing", async () => {
    const server = new MockSocketServer((ctx) => ctx.refuse("token_expired"));
    setSocketFactory(server.factory);
    const inbox = new Portal({ apiKey: "pk", token: async () => "expired" }).inbox();

    // Refresh once (attempt 2), then keep retrying via the transport rather than closing.
    await vi.waitFor(() => expect(server.urls).toHaveLength(2));
    expect(server.socket?.closed).toBe(false);
    expect(inbox.status).toBe("reconnecting");
  });

  it("closes on a static token expiry it cannot re-resolve", async () => {
    const { inbox, server } = setup((ctx) => ctx.refuse("token_expired"));
    await vi.waitFor(() => expect(server.socket?.closed).toBe(true));
    expect(server.socket?.reconnectCount).toBe(0);
    expect(inbox.status).toBe("connecting");
  });
});
