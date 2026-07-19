import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AnonymousNotAllowedError,
  ChannelAtCapacityError,
  InvalidApiKeyError,
  NotMemberError,
  Portal,
  PortalError,
  TokenExpiredError,
  type ChannelStatus,
} from "../src/index.js";
import {
  resetHttpClientFactory,
  setHttpClientFactory,
} from "../src/http/factory.js";
import { resetSocketFactory, setSocketFactory } from "../src/transport/factory.js";
import { MockHttpClient } from "./mock-server/http.js";
import { MockSocketServer } from "./mock-server/index.js";

afterEach(() => {
  resetSocketFactory();
  resetHttpClientFactory();
});

/** Acquire a channel wired to `server`, capturing the terminal error via on("status"). */
function connect(server: MockSocketServer, token: string | (() => Promise<string>) = "jwt") {
  setSocketFactory(server.factory);
  setHttpClientFactory(new MockHttpClient().factory);
  const channel = new Portal({ apiKey: "pk", token }).channel("room");
  let blockedError: PortalError | undefined;
  const statuses: ChannelStatus[] = [];
  channel.on("status", (status, error) => {
    statuses.push(status);
    if (status === "blocked") blockedError = error;
  });
  channel.acquire();
  return { channel, statuses, getError: () => blockedError };
}

describe("upgrade refusals", () => {
  const cases: {
    code: string;
    ctor: new (...args: never[]) => PortalError;
    expectedCode: string;
  }[] = [
    { code: "invalid_api_key", ctor: InvalidApiKeyError, expectedCode: "invalid_api_key" },
    { code: "not_member", ctor: NotMemberError, expectedCode: "not_member" },
    {
      code: "anonymous_not_allowed",
      ctor: AnonymousNotAllowedError,
      expectedCode: "anonymous_not_allowed",
    },
    {
      code: "channel_at_capacity",
      ctor: ChannelAtCapacityError,
      expectedCode: "channel_at_capacity",
    },
    // Codes without a dedicated §8 class surface as a base PortalError carrying the code.
    { code: "banned", ctor: PortalError, expectedCode: "banned" },
    { code: "invalid_token", ctor: PortalError, expectedCode: "invalid_token" },
    { code: "unknown_channel", ctor: PortalError, expectedCode: "unknown_channel" },
    {
      code: "unsupported_version",
      ctor: PortalError,
      expectedCode: "unsupported_version",
    },
  ];

  for (const { code, ctor, expectedCode } of cases) {
    it(`maps "${code}" to a terminal blocked status`, async () => {
      const server = new MockSocketServer((ctx) => ctx.refuse(code));
      const { channel, getError } = connect(server);

      await vi.waitFor(() => expect(channel.status).toBe("blocked"));

      const error = getError();
      expect(error).toBeInstanceOf(ctor);
      expect(error?.code).toBe(expectedCode);
      // Terminal: the socket is closed and never retried.
      expect(server.socket?.closed).toBe(true);
      expect(server.socket?.reconnectCount).toBe(0);
    });
  }

  it("treats an unrecognised refusal code as terminal", async () => {
    const server = new MockSocketServer((ctx) => ctx.refuse("teapot"));
    const { channel, getError } = connect(server);

    await vi.waitFor(() => expect(channel.status).toBe("blocked"));
    expect(getError()).toBeInstanceOf(PortalError);
    expect(getError()?.code).toBe("teapot");
    expect(server.socket?.closed).toBe(true);
  });

  it("carries the refusal reason into a BlockedError-style message", async () => {
    const server = new MockSocketServer((ctx) => ctx.refuse("not_member", "invite only"));
    const { channel, getError } = connect(server);

    await vi.waitFor(() => expect(channel.status).toBe("blocked"));
    expect(getError()?.message).toContain("invite only");
  });
});

describe("token expiry", () => {
  it("refreshes a callback token once and retries", async () => {
    let calls = 0;
    const token = async () => `jwt_${++calls}`;
    const server = new MockSocketServer((ctx) => {
      if (ctx.attempt === 1) ctx.refuse("token_expired");
      else ctx.ready();
    });
    const { channel } = connect(server, token);

    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    expect(server.urls).toHaveLength(2);
    expect(server.socket?.reconnectCount).toBe(1);
    expect(new URL(server.urls[1]!).searchParams.get("token")).toBe("jwt_2");
  });

  it("gives up with TokenExpiredError after the one retry still fails", async () => {
    const token = async () => "stale";
    const server = new MockSocketServer((ctx) => ctx.refuse("token_expired"));
    const { channel, getError } = connect(server, token);

    await vi.waitFor(() => expect(channel.status).toBe("blocked"));

    expect(getError()).toBeInstanceOf(TokenExpiredError);
    expect(server.urls).toHaveLength(2);
    expect(server.socket?.closed).toBe(true);
  });

  it("cannot refresh a static string token — expiry is immediately terminal", async () => {
    const server = new MockSocketServer((ctx) => ctx.refuse("token_expired"));
    const { channel, getError } = connect(server, "static");

    await vi.waitFor(() => expect(channel.status).toBe("blocked"));

    expect(getError()).toBeInstanceOf(TokenExpiredError);
    expect(server.urls).toHaveLength(1);
    expect(server.socket?.reconnectCount).toBe(0);
  });
});

describe("status machine", () => {
  it("runs idle → connecting → ready and captures the connect snapshot", async () => {
    const server = new MockSocketServer((ctx) => ctx.ready());
    const { channel, statuses } = connect(server);

    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    expect(statuses).toEqual(["connecting", "ready"]);
    expect(channel.me).toEqual({ id: "u_test", anon: false, claims: {} });
    expect(channel.info).toEqual({ id: "room", mode: "standard" });
  });

  it("reports reconnecting on a transient drop (non-publisher)", async () => {
    const server = new MockSocketServer((ctx) => {
      if (ctx.attempt === 1) {
        ctx.ready({ me: { id: "u_test", anon: false, claims: {}, capabilities: {} } });
      }
    });
    const { channel } = connect(server);
    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    server.socket?.emit({ type: "closed" });
    expect(channel.status).toBe("reconnecting");
  });
});

describe("upgrade URL construction", () => {
  it("carries v, token, and key; omits last on the first attempt", async () => {
    const server = new MockSocketServer((ctx) => ctx.ready());
    const { channel } = connect(server);
    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    const url = new URL(server.urls[0]!);
    expect(url.searchParams.get("v")).toBe("1");
    expect(url.searchParams.get("token")).toBe("jwt");
    expect(url.searchParams.get("key")).toBe("pk");
    expect(url.searchParams.has("last")).toBe(false);
    expect(url.searchParams.has("leaf")).toBe(false);
  });

  it("echoes the leaf hint and last= seq on reconnect", async () => {
    const server = new MockSocketServer((ctx) => ctx.ready({ leaf: "leaf_9", seq: 42 }));
    const { channel } = connect(server);
    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    // Simulate the transport reconnecting after the snapshot.
    server.socket?.reconnect();
    await vi.waitFor(() => expect(server.urls).toHaveLength(2));

    const url = new URL(server.urls[1]!);
    expect(url.searchParams.get("leaf")).toBe("leaf_9");
    expect(url.searchParams.get("last")).toBe("42");
  });
});
