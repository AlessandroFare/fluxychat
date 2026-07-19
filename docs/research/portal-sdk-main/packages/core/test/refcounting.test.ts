import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Portal } from "../src/index.js";
import { GRACE_MS } from "../src/channel.js";
import {
  resetHttpClientFactory,
  setHttpClientFactory,
} from "../src/http/factory.js";
import { resetSocketFactory, setSocketFactory } from "../src/transport/factory.js";
import { MockHttpClient } from "./mock-server/http.js";
import { MockSocketServer } from "./mock-server/index.js";

const config = { apiKey: "pk", token: "jwt" };

beforeEach(() => {
  setHttpClientFactory(new MockHttpClient().factory);
});

afterEach(() => {
  resetSocketFactory();
  resetHttpClientFactory();
  vi.useRealTimers();
});

describe("no network before first acquire", () => {
  it("neither construction nor channel() opens a socket or resolves the token", () => {
    const token = vi.fn(async () => "jwt");
    const server = new MockSocketServer(() => {});
    setSocketFactory(server.factory);

    const portal = new Portal({ apiKey: "pk", token });
    const channel = portal.channel("room");

    expect(server.sockets).toHaveLength(0);
    expect(token).not.toHaveBeenCalled();

    channel.acquire();
    expect(server.sockets).toHaveLength(1);
  });
});

describe("refcounting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("shares one socket across concurrent acquires", () => {
    const server = new MockSocketServer(() => {});
    setSocketFactory(server.factory);
    const channel = new Portal(config).channel("room");

    channel.acquire();
    channel.acquire();

    expect(server.sockets).toHaveLength(1);
  });

  it("reacquiring within the grace window keeps the same socket (no reconnect)", () => {
    const server = new MockSocketServer(() => {});
    setSocketFactory(server.factory);
    const channel = new Portal(config).channel("room");

    channel.acquire();
    channel.release();
    vi.advanceTimersByTime(GRACE_MS - 1);
    channel.acquire();
    vi.advanceTimersByTime(GRACE_MS * 2);

    expect(server.sockets).toHaveLength(1);
    expect(server.socket?.closed).toBe(false);
  });

  it("tears down after the grace window once the last user releases", () => {
    const server = new MockSocketServer(() => {});
    setSocketFactory(server.factory);
    const channel = new Portal(config).channel("room");

    channel.acquire();
    channel.release();
    expect(server.socket?.closed).toBe(false);

    vi.advanceTimersByTime(GRACE_MS);
    expect(server.socket?.closed).toBe(true);
  });

  it("survives a StrictMode acquire/release/acquire remount", () => {
    const server = new MockSocketServer(() => {});
    setSocketFactory(server.factory);
    const channel = new Portal(config).channel("room");

    // Mount → cleanup → mount, as React's StrictMode double-invokes effects.
    channel.acquire();
    channel.release();
    channel.acquire();
    vi.advanceTimersByTime(GRACE_MS * 2);

    expect(server.sockets).toHaveLength(1);
    expect(server.socket?.closed).toBe(false);
  });
});
