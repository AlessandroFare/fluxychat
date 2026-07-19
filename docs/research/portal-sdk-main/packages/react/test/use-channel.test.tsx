import type { ReactNode } from "react";

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InvalidApiKeyError, Portal } from "@portalsdk/core";

import { PortalProvider } from "../src/index.js";
import { useChannel } from "../src/use-channel.js";
import { installMocks, MockSocketServer, resetMocks } from "./harness.js";

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

describe("useChannel over the mock server", () => {
  it("surfaces the ready snapshot (status, me, channel info)", async () => {
    const server = new MockSocketServer((ctx) => ctx.ready());
    installMocks(server);
    const { result } = renderHook(() => useChannel({ channelId: "room" }), {
      wrapper: wrapperFor(makePortal()),
    });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.me?.id).toBe("u_test");
    expect(result.current.channel).toEqual({ id: "room", mode: "standard" });
  });

  it("shares one connection across two components of the same channel", async () => {
    const server = new MockSocketServer((ctx) => ctx.ready());
    installMocks(server);
    const portal = makePortal();
    const wrapper = wrapperFor(portal);

    const a = renderHook(() => useChannel({ channelId: "room" }), { wrapper });
    const b = renderHook(() => useChannel({ channelId: "room" }), { wrapper });

    await waitFor(() => {
      expect(a.result.current.status).toBe("ready");
      expect(b.result.current.status).toBe("ready");
    });
    // One handle (registry), one socket — the two mounts refcount the same connection.
    expect(server.sockets).toHaveLength(1);
  });

  it("survives a StrictMode remount without reconnect churn", async () => {
    const server = new MockSocketServer((ctx) => ctx.ready());
    installMocks(server);
    const { result } = renderHook(() => useChannel({ channelId: "room" }), {
      wrapper: wrapperFor(makePortal()),
      reactStrictMode: true,
    });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    // The grace window absorbed the strict release/re-acquire: one socket, still open, never
    // reconnected.
    expect(server.sockets).toHaveLength(1);
    expect(server.socket?.closed).toBe(false);
    expect(server.socket?.reconnectCount).toBe(0);
  });

  it("delivers a terminal refusal through onError and status 'blocked'", async () => {
    const server = new MockSocketServer((ctx) => ctx.refuse("invalid_api_key"));
    installMocks(server);
    const onError = vi.fn();
    const { result } = renderHook(
      () => useChannel({ channelId: "room", onError }),
      { wrapper: wrapperFor(makePortal()) },
    );

    await waitFor(() => expect(result.current.status).toBe("blocked"));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(InvalidApiKeyError);
  });

  it("publishes a persistent send through the HTTP plane", async () => {
    const server = new MockSocketServer((ctx) => ctx.ready());
    const http = installMocks(server);
    const { result } = renderHook(
      () => useChannel<string>({ channelId: "room" }),
      { wrapper: wrapperFor(makePortal()) },
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));

    let ack: { id: string; timestamp: number } | undefined;
    await act(async () => {
      ack = await result.current.send({ content: "hello" });
    });
    expect(ack?.id).toBeDefined();
    expect(http.publishCalls).toHaveLength(1);
    expect(http.publishCalls[0]?.body.content).toBe("hello");
  });
});
