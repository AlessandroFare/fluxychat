import type { ReactNode } from "react";

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { serializeFrame } from "@portalsdk/wire-protocol";
import { afterEach, describe, expect, it } from "vitest";

import { Portal } from "@portalsdk/core";

import { PortalProvider } from "../src/index.js";
import { useInbox } from "../src/use-inbox.js";
import { installMocks, MockSocketServer, resetMocks, type ConnectScript } from "./harness.js";

afterEach(() => {
  cleanup();
  resetMocks();
});

function makePortal(): Portal {
  return new Portal({
    apiKey: "pk",
    token: "jwt",
    apiUrl: "http://mock.test",
    realtimeUrl: "ws://mock.test",
  });
}

function wrapperFor(portal: Portal) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <PortalProvider client={portal}>{children}</PortalProvider>;
  };
}

const seeded: ConnectScript = (ctx) =>
  ctx.inboxReady({
    entries: [
      { id: "c1", unread: 2, muted: false, at: 2 },
      { id: "c2", unread: 1, muted: false, at: 1 },
    ],
    items: [
      { id: "i1", type: "mention", data: {}, channelId: "c1", at: 2, read: false },
      { id: "i2", type: "mention", data: {}, channelId: "c2", at: 1, read: false },
    ],
    counter: 3,
  });

function emitItem(server: MockSocketServer, item: Record<string, unknown>): void {
  server.socket?.emit({ type: "message", data: serializeFrame({ t: "item", item } as never) });
}

describe("useInbox over the mock server", () => {
  it("surfaces the ready snapshot", async () => {
    const server = new MockSocketServer(seeded);
    installMocks(server);
    const { result } = renderHook(() => useInbox(), { wrapper: wrapperFor(makePortal()) });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.channels.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(result.current.items.map((i) => i.id)).toEqual(["i1", "i2"]);
    expect(result.current.counter).toBe(3);
  });

  it("re-renders on a live item arrival", async () => {
    const server = new MockSocketServer(seeded);
    installMocks(server);
    const { result } = renderHook(() => useInbox(), { wrapper: wrapperFor(makePortal()) });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() =>
      emitItem(server, { id: "i3", type: "mention", data: {}, channelId: "c1", at: 3, read: false }),
    );
    expect(result.current.items.map((i) => i.id)).toContain("i3");
  });

  it("re-renders on a counter push", async () => {
    const server = new MockSocketServer(seeded);
    installMocks(server);
    const { result } = renderHook(() => useInbox(), { wrapper: wrapperFor(makePortal()) });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => server.socket?.emit({ type: "message", data: serializeFrame({ t: "counter", n: 9 }) }));
    expect(result.current.counter).toBe(9);
  });

  it("reflects a mute transition on an entry", async () => {
    const server = new MockSocketServer(seeded);
    installMocks(server);
    const { result } = renderHook(() => useInbox(), { wrapper: wrapperFor(makePortal()) });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.channels.get("c1")?.muted).toBe(false);
    act(() => result.current.channels.get("c1")?.mute());
    expect(result.current.channels.get("c1")?.muted).toBe(true);
  });

  it("reflects a per-item read transition", async () => {
    const server = new MockSocketServer(seeded);
    installMocks(server);
    const { result } = renderHook(() => useInbox(), { wrapper: wrapperFor(makePortal()) });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.items[0]?.read).toBe(false);
    act(() => result.current.items[0]?.markAsRead());
    expect(result.current.items[0]?.read).toBe(true);
  });

  it("marks everything read with the global markAllRead", async () => {
    const server = new MockSocketServer(seeded);
    installMocks(server);
    const { result } = renderHook(() => useInbox(), { wrapper: wrapperFor(makePortal()) });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.markAllRead());
    expect(result.current.items.every((i) => i.read)).toBe(true);
  });

  it("keeps counter global while unseen scopes to the view filter", async () => {
    const server = new MockSocketServer(seeded);
    installMocks(server);
    const { result } = renderHook(() => useInbox({ channelId: "c1" }), {
      wrapper: wrapperFor(makePortal()),
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    // Filtered to c1: one unseen item there; the counter stays the global badge.
    expect(result.current.items.map((i) => i.id)).toEqual(["i1"]);
    expect(result.current.unseen).toBe(1);
    expect(result.current.counter).toBe(3);
  });
});
