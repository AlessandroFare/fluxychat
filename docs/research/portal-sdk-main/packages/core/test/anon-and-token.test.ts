import { afterEach, describe, expect, it, vi } from "vitest";

import { InvalidApiKeyError, Portal, TokenExpiredError, type PortalError } from "../src/index.js";
import { resetHttpClientFactory, setHttpClientFactory } from "../src/http/factory.js";
import { resetSocketFactory, setSocketFactory } from "../src/transport/factory.js";
import { MockHttpClient } from "./mock-server/http.js";
import { MockSocketServer, type ConnectScript } from "./mock-server/index.js";

afterEach(() => {
  resetSocketFactory();
  resetHttpClientFactory();
});

function wire(script: ConnectScript, http: MockHttpClient = new MockHttpClient()) {
  const server = new MockSocketServer(script);
  setSocketFactory(server.factory);
  setHttpClientFactory(http.factory);
  return { server, http };
}

describe("anonymous mode (no token)", () => {
  it("mints one anonymous token and reuses it across two channels", async () => {
    const { http } = wire((ctx) => ctx.ready());
    const portal = new Portal({ apiKey: "pk" });
    const a = portal.channel("room-a");
    const b = portal.channel("room-b");
    a.acquire();
    b.acquire();

    await vi.waitFor(() => {
      expect(a.status).toBe("ready");
      expect(b.status).toBe("ready");
    });
    // One shared credential drives every connection.
    expect(http.mintCalls).toHaveLength(1);
    expect(http.mintCalls[0]?.anonId).toBeUndefined();
  });

  it("carries me.anon through from the ready frame", async () => {
    const { server } = wire((ctx) =>
      ctx.ready({
        me: { id: "anon_1", anon: true, claims: {}, capabilities: { publish: true } },
      }),
    );
    void server;
    const ch = new Portal({ apiKey: "pk" }).channel("room");
    ch.acquire();
    await vi.waitFor(() => expect(ch.status).toBe("ready"));
    expect(ch.me?.anon).toBe(true);
  });

  it("re-mints with the same anonId on a token_expired refusal, never surfacing TokenExpiredError", async () => {
    const script: ConnectScript = (ctx) => {
      if (ctx.attempt === 2) ctx.refuse("token_expired");
      else ctx.ready();
    };
    const { server, http } = wire(script);
    const ch = new Portal({ apiKey: "pk" }).channel("room");
    const errors: PortalError[] = [];
    ch.on("status", (_status, error) => {
      if (error) errors.push(error);
    });

    ch.acquire();
    await vi.waitFor(() => expect(ch.status).toBe("ready"));
    expect(http.mintCalls).toHaveLength(1);

    // Simulate a reconnect whose next upgrade is refused as expired: the SDK re-mints and retries.
    server.socket?.reconnect();
    await vi.waitFor(() => expect(http.mintCalls).toHaveLength(2));

    // The re-mint keeps the identity from the first token's `sub`.
    expect(http.mintCalls[1]?.anonId).toBe("anon_1");
    await vi.waitFor(() => expect(ch.status).toBe("ready"));
    expect(ch.status).not.toBe("blocked");
    expect(errors.some((e) => e instanceof TokenExpiredError)).toBe(false);
  });

  it("surfaces a mint failure as the route's error (blocked + InvalidApiKeyError)", async () => {
    const http = new MockHttpClient({ onMint: () => ({ ok: false, code: "invalid_api_key" }) });
    wire((ctx) => ctx.ready(), http);
    const ch = new Portal({ apiKey: "bad" }).channel("room");
    let blocked: PortalError | undefined;
    ch.on("status", (status, error) => {
      if (status === "blocked") blocked = error;
    });

    ch.acquire();
    await vi.waitFor(() => expect(ch.status).toBe("blocked"));
    expect(blocked).toBeInstanceOf(InvalidApiKeyError);
  });
});

describe("setToken", () => {
  it("re-acquires an active channel on an identity change (login)", async () => {
    const { server } = wire((ctx) => ctx.ready());
    const portal = new Portal({ apiKey: "pk" }); // anonymous
    const ch = portal.channel("room");
    ch.acquire();
    await vi.waitFor(() => expect(ch.status).toBe("ready"));
    const socketsBefore = server.sockets.length;

    portal.setToken("user-jwt"); // login → identity change → re-auth
    await vi.waitFor(() => expect(server.sockets.length).toBe(socketsBefore + 1));
    await vi.waitFor(() => expect(ch.status).toBe("ready"));

    // The fresh upgrade authenticates with the user token, not an anonymous one.
    const lastUrl = server.urls[server.urls.length - 1] ?? "";
    expect(lastUrl).toContain("token=user-jwt");
  });

  it("is a no-op when the token is unchanged", async () => {
    const { server } = wire((ctx) => ctx.ready());
    const portal = new Portal({ apiKey: "pk", token: "user-jwt" });
    const ch = portal.channel("room");
    ch.acquire();
    await vi.waitFor(() => expect(ch.status).toBe("ready"));
    const socketsBefore = server.sockets.length;

    portal.setToken("user-jwt"); // same identity → no re-auth
    await Promise.resolve();
    expect(server.sockets.length).toBe(socketsBefore);
  });

  it("does not re-acquire an idle handle; the new credential is used on the next acquire", async () => {
    const { server } = wire((ctx) => ctx.ready());
    const portal = new Portal({ apiKey: "pk" });
    const ch = portal.channel("room"); // created but never acquired
    portal.setToken("user-jwt");
    await Promise.resolve();
    // Nothing connected yet.
    expect(server.sockets).toHaveLength(0);

    ch.acquire();
    await vi.waitFor(() => expect(ch.status).toBe("ready"));
    expect(server.urls[server.urls.length - 1] ?? "").toContain("token=user-jwt");
  });
});

describe("inbox in anonymous mode", () => {
  it("mints, then synthesizes an empty ready inbox when refused", async () => {
    const { http } = wire((ctx) => ctx.refuse("anonymous_not_allowed"));
    const inbox = new Portal({ apiKey: "pk" }).inbox();
    await vi.waitFor(() => expect(inbox.status).toBe("ready"));
    expect(inbox.channels).toHaveLength(0);
    expect(inbox.counter).toBe(0);
    expect(http.mintCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("re-authenticates the inbox on login", async () => {
    const script: ConnectScript = (ctx) => {
      if (ctx.url.includes("token=user-jwt")) {
        ctx.inboxReady({
          entries: [{ id: "c1", unread: 1, muted: false, at: 1 }],
          items: [],
          counter: 1,
        });
      } else {
        ctx.refuse("anonymous_not_allowed");
      }
    };
    const portal = new Portal({ apiKey: "pk" });
    wire(script);
    const inbox = portal.inbox();
    await vi.waitFor(() => expect(inbox.status).toBe("ready")); // synthesized empty
    expect(inbox.channels).toHaveLength(0);

    portal.setToken("user-jwt");
    await vi.waitFor(() => expect(inbox.channels).toHaveLength(1));
    expect(inbox.counter).toBe(1);
  });
});
