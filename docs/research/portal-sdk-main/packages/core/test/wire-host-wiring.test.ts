import { afterEach, describe, expect, it, vi } from "vitest";

import { Portal } from "../src/index.js";
import { resetHttpClientFactory } from "../src/http/factory.js";
import { resetSocketFactory, setSocketFactory } from "../src/transport/factory.js";
import { MockSocketServer, type ConnectScript } from "./mock-server/index.js";

/**
 * End-to-end host wiring, through the real `fetch`-backed HTTP client (not
 * {@link MockHttpClient}, which implements `HttpClient` directly and never looks at
 * which host a request was built against). This is the seam where a self-consistent
 * host bug hides: every other test in this suite would pass whether these requests
 * hit the realtime host or the api host, because the mock never inspects the URL.
 */

const fetchMock = vi.fn();
const originalFetch = global.fetch;

function stubFetch(): void {
  fetchMock.mockImplementation((input: string | URL) => {
    const url = String(input);
    if (url.includes("/tokens/anonymous")) {
      return Promise.resolve(
        new Response(JSON.stringify({ token: "eyJhbGciOiJub25lIn0.e30.sig" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    if (url.includes("/messages")) {
      return Promise.resolve(
        new Response(JSON.stringify({ id: "m_srv", seq: 1, timestamp: 0 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    if (url.includes("/members")) {
      return Promise.resolve(
        new Response(JSON.stringify({ members: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify({ msgs: [], hasMore: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });
  global.fetch = fetchMock as unknown as typeof fetch;
}

function wire(script: ConnectScript): MockSocketServer {
  const server = new MockSocketServer(script);
  setSocketFactory(server.factory);
  return server;
}

afterEach(() => {
  resetSocketFactory();
  resetHttpClientFactory();
  fetchMock.mockReset();
  global.fetch = originalFetch;
});

describe("host wiring — token mode", () => {
  it("sends publish/history/members to the realtime host, never the api host", async () => {
    stubFetch();
    wire((ctx) => ctx.ready({ seq: 0, watermark: 0 }));
    const channel = new Portal({ apiKey: "pk", token: "jwt" }).channel("room-7");
    channel.acquire();
    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    // The default history option backfills on ready — a GET fires automatically.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await channel.send({ content: { text: "hi" } });
    await channel.members();

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.length).toBeGreaterThanOrEqual(3);
    for (const url of urls) {
      expect(url.startsWith("https://realtime.useportal.co/v1/channels/room-7/")).toBe(true);
    }
  });
});

describe("host wiring — anonymous mode", () => {
  it("mints on the api host while channel operations stay on the realtime host", async () => {
    stubFetch();
    wire((ctx) => ctx.ready({ seq: 0, watermark: 0 }));
    const channel = new Portal({ apiKey: "pk" }).channel("room-7");
    channel.acquire();
    await vi.waitFor(() => expect(channel.status).toBe("ready"));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    const mintUrls = urls.filter((url) => url.includes("/tokens/anonymous"));
    const channelUrls = urls.filter((url) => !url.includes("/tokens/anonymous"));

    expect(mintUrls).toEqual(["https://api.useportal.co/v1/tokens/anonymous"]);
    expect(channelUrls.length).toBeGreaterThan(0);
    for (const url of channelUrls) {
      expect(url.startsWith("https://realtime.useportal.co/v1/channels/room-7/")).toBe(true);
    }
  });
});
